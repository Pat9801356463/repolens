import http from 'node:http';
import { LatencyTracker } from './latency_tracker.js';
import { HedgeBudget } from './hedge_budget.js';

/**
 * HedgedProxy (TailSquash): High-Performance Speculative Hedged Reverse Proxy.
 * 
 * Dynamically tracks rolling P90 response latency. If a primary upstream node
 * does not return headers by the P90 threshold, a speculative duplicate request
 * is dispatched to an alternate node under a strict budget constraint.
 * The fastest node streams its response to the client while the slower node
 * connection is immediately aborted via AbortController.
 */
export class HedgedProxy {
  constructor(port = 5002, upstreamNodes = [], options = {}) {
    this.port = port;
    this.upstreamNodes = upstreamNodes; // Array of { id, port, name }
    this.rrIndex = 0;

    // Tuning options
    this.targetPercentile = options.targetPercentile || 90; // Trigger hedge at P90
    this.minHedgeDelayMs = options.minHedgeDelayMs || 15;     // Lower bound to prevent micro-jitter false alarms
    this.maxBudgetRatio = options.maxBudgetRatio || 0.08;    // Max 8% extra hedged requests allowed

    this.tracker = new LatencyTracker(1000, 25);
    this.budget = new HedgeBudget(this.maxBudgetRatio, 10000);

    this.server = null;

    // Telemetry
    this.metrics = {
      totalRequests: 0,
      hedgedDispatched: 0,
      hedgesWon: 0,
      primaryWonAfterHedge: 0,
      abortedCount: 0,
      budgetBlockedCount: 0
    };

    this.onTelemetryListener = null;
  }

  setTelemetryListener(fn) {
    this.onTelemetryListener = fn;
  }

  _pickNodes() {
    const len = this.upstreamNodes.length;
    const primaryIdx = this.rrIndex % len;
    this.rrIndex++;
    const secondaryIdx = (primaryIdx + 1) % len;
    return {
      primary: this.upstreamNodes[primaryIdx],
      secondary: this.upstreamNodes[secondaryIdx]
    };
  }

  getHedgeTriggerDelay() {
    const pVal = this.tracker.getPercentile(this.targetPercentile);
    return Math.max(this.minHedgeDelayMs, pVal);
  }

  start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const start = performance.now();
        this.metrics.totalRequests++;
        this.budget.recordRequest();

        const { primary, secondary } = this._pickNodes();
        const hedgeDelayMs = this.getHedgeTriggerDelay();

        const primaryCtrl = new AbortController();
        let secondaryCtrl = null;
        let hedgeFired = false;
        let hedgeTimer = null;

        // Function to perform an upstream fetch
        const executeFetch = async (targetNode, ctrl, isHedge) => {
          const nodeStart = performance.now();
          const url = `http://localhost:${targetNode.port}${req.url}`;

          const upstreamRes = await fetch(url, {
            method: req.method,
            headers: {
              ...req.headers,
              host: `localhost:${targetNode.port}`
            },
            signal: ctrl.signal
          });

          const data = await upstreamRes.arrayBuffer();
          return {
            res: upstreamRes,
            data,
            node: targetNode,
            isHedge,
            nodeElapsed: performance.now() - nodeStart
          };
        };

        // Primary promise
        const primaryPromise = executeFetch(primary, primaryCtrl, false);

        // Hedged promise (deferred until hedge timer fires)
        let secondaryPromise = null;

        const hedgeTriggerPromise = new Promise((resolveHedge) => {
          hedgeTimer = setTimeout(() => {
            if (this.budget.canHedge()) {
              hedgeFired = true;
              this.metrics.hedgedDispatched++;
              secondaryCtrl = new AbortController();
              secondaryPromise = executeFetch(secondary, secondaryCtrl, true);
              resolveHedge(secondaryPromise);
            } else {
              this.metrics.budgetBlockedCount++;
              resolveHedge(null);
            }
          }, hedgeDelayMs);
        });

        try {
          // Race to completion:
          // We race the primary against the hedge trigger (which starts the secondary request)
          const winner = await Promise.race([
            primaryPromise,
            hedgeTriggerPromise.then((p) => (p ? p : new Promise(() => {})))
          ]);

          // Clear the hedge timer so it doesn't fire if primary already finished
          clearTimeout(hedgeTimer);

          const totalElapsed = performance.now() - start;
          this.tracker.record(totalElapsed);

          // Abort the slower node immediately
          if (winner.isHedge) {
            this.metrics.hedgesWon++;
            this.metrics.abortedCount++;
            primaryCtrl.abort();
          } else if (hedgeFired && secondaryCtrl) {
            this.metrics.primaryWonAfterHedge++;
            this.metrics.abortedCount++;
            secondaryCtrl.abort();
          }

          res.writeHead(winner.res.status, {
            'Content-Type': winner.res.headers.get('content-type') || 'application/json',
            'X-Proxy-Type': 'TailSquash-Hedged',
            'X-Winner-Node': winner.node.id,
            'X-Was-Hedged': hedgeFired ? 'true' : 'false',
            'X-Hedge-Won': winner.isHedge ? 'true' : 'false',
            'X-Hedge-Delay-Ms': hedgeDelayMs.toFixed(2),
            'X-Total-Latency-Ms': totalElapsed.toFixed(2)
          });
          res.end(Buffer.from(winner.data));

          // Notify live telemetry stream if subscribed
          if (this.onTelemetryListener) {
            this.onTelemetryListener({
              type: 'hedged',
              latencyMs: parseFloat(totalElapsed.toFixed(2)),
              winnerNode: winner.node.id,
              wasHedged: hedgeFired,
              hedgeWon: winner.isHedge,
              hedgeDelayMs: parseFloat(hedgeDelayMs.toFixed(2)),
              timestamp: Date.now()
            });
          }
        } catch (err) {
          clearTimeout(hedgeTimer);
          if (primaryCtrl) primaryCtrl.abort();
          if (secondaryCtrl) secondaryCtrl.abort();

          const totalElapsed = performance.now() - start;
          this.tracker.record(totalElapsed);

          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
        }
      });

      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  getStats() {
    return {
      type: 'hedged',
      port: this.port,
      metrics: { ...this.metrics },
      budget: this.budget.getStats(),
      latency: this.tracker.getStats(),
      currentHedgeThresholdMs: parseFloat(this.getHedgeTriggerDelay().toFixed(2))
    };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      hedgedDispatched: 0,
      hedgesWon: 0,
      primaryWonAfterHedge: 0,
      abortedCount: 0,
      budgetBlockedCount: 0
    };
    this.tracker.reset();
    this.budget.reset();
  }

  stop() {
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}
