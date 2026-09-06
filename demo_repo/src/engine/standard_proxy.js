import http from 'node:http';
import { LatencyTracker } from './latency_tracker.js';

/**
 * StandardProxy: Traditional round-robin reverse proxy.
 * Does not perform request hedging; subject to tail-latency stalls and stragglers.
 * Serves as the control group for benchmark comparisons.
 */
export class StandardProxy {
  constructor(port = 5001, upstreamNodes = []) {
    this.port = port;
    this.upstreamNodes = upstreamNodes; // Array of { id, port, name }
    this.rrIndex = 0;
    this.tracker = new LatencyTracker(1000);
    this.server = null;
    this.totalRequests = 0;
  }

  _getNextNode() {
    const node = this.upstreamNodes[this.rrIndex % this.upstreamNodes.length];
    this.rrIndex++;
    return node;
  }

  start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const start = performance.now();
        this.totalRequests++;

        const targetNode = this._getNextNode();
        const url = `http://localhost:${targetNode.port}${req.url}`;

        try {
          const upstreamRes = await fetch(url, {
            method: req.method,
            headers: {
              ...req.headers,
              host: `localhost:${targetNode.port}`
            }
          });

          const data = await upstreamRes.arrayBuffer();
          const elapsed = performance.now() - start;
          this.tracker.record(elapsed);

          res.writeHead(upstreamRes.status, {
            'Content-Type': upstreamRes.headers.get('content-type') || 'application/json',
            'X-Proxy-Type': 'Standard-RoundRobin',
            'X-Target-Node': targetNode.id,
            'X-Total-Latency-Ms': elapsed.toFixed(2)
          });
          res.end(Buffer.from(data));
        } catch (err) {
          const elapsed = performance.now() - start;
          this.tracker.record(elapsed);
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
      type: 'standard',
      port: this.port,
      totalRequests: this.totalRequests,
      latency: this.tracker.getStats()
    };
  }

  reset() {
    this.totalRequests = 0;
    this.tracker.reset();
  }

  stop() {
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}
