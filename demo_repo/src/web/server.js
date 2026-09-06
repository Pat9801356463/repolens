import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockCluster } from '../cluster/mock_nodes.js';
import { StandardProxy } from '../engine/standard_proxy.js';
import { HedgedProxy } from '../engine/hedged_proxy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

export class WebAppServer {
  constructor(port = 3000) {
    this.port = port;
    this.cluster = new MockCluster();
    this.stdProxy = null;
    this.hedgedProxy = null;
    this.server = null;
    this.sseClients = new Set();
    this.trafficInterval = null;
  }

  async init() {
    // 1. Start cluster nodes (4001, 4002, 4003)
    await this.cluster.start();

    // 2. Start Standard Proxy (5001)
    this.stdProxy = new StandardProxy(5001, this.cluster.nodes);
    await this.stdProxy.start();

    // 3. Start Hedged Proxy (5002)
    this.hedgedProxy = new HedgedProxy(5002, this.cluster.nodes, {
      targetPercentile: 90,
      minHedgeDelayMs: 15,
      maxBudgetRatio: 0.08
    });
    await this.hedgedProxy.start();

    // Subscribe to hedged telemetry
    this.hedgedProxy.setTelemetryListener((data) => {
      this.broadcastSSE('telemetry', data);
    });
  }

  broadcastSSE(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      client.write(message);
    }
  }

  serveStatic(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };

    const contentType = mimeTypes[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Server Error: ${err.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }

  async executeDualRequest() {
    const t0 = performance.now();
    let stdRes, hedgeRes;
    let stdMs = 0, hedgeMs = 0;

    // Standard proxy request
    try {
      const s0 = performance.now();
      const res1 = await fetch(`http://localhost:${this.stdProxy.port}/data`);
      await res1.json();
      stdMs = performance.now() - s0;
      stdRes = { success: true, latency: stdMs, status: res1.status };
    } catch (e) {
      stdRes = { success: false, error: e.message, latency: 1500 };
    }

    // Hedged proxy request
    try {
      const h0 = performance.now();
      const res2 = await fetch(`http://localhost:${this.hedgedProxy.port}/data`);
      const body2 = await res2.json();
      hedgeMs = performance.now() - h0;
      hedgeRes = {
        success: true,
        latency: hedgeMs,
        wasHedged: res2.headers.get('x-was-hedged') === 'true',
        hedgeWon: res2.headers.get('x-hedge-won') === 'true',
        winnerNode: res2.headers.get('x-winner-node'),
        status: res2.status,
        body: body2
      };
    } catch (e) {
      hedgeRes = { success: false, error: e.message, latency: 1500 };
    }

    const eventPayload = {
      timestamp: Date.now(),
      standardLatency: parseFloat(stdMs.toFixed(2)),
      hedgedLatency: parseFloat(hedgeMs.toFixed(2)),
      wasHedged: hedgeRes.wasHedged || false,
      hedgeWon: hedgeRes.hedgeWon || false,
      winnerNode: hedgeRes.winnerNode || 'unknown',
      latencySavedMs: parseFloat(Math.max(0, stdMs - hedgeMs).toFixed(2))
    };

    this.broadcastSSE('request_pair', eventPayload);
    return eventPayload;
  }

  start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);
        const pathname = parsedUrl.pathname;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // SSE Endpoint
        if (pathname === '/api/stream') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });
          res.write('\n');
          this.sseClients.add(res);

          req.on('close', () => {
            this.sseClients.delete(res);
          });
          return;
        }

        // API: System Status & Stats
        if (pathname === '/api/status' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              cluster: {
                nodes: this.cluster.nodes,
                chaos: this.cluster.getChaos(),
                stats: this.cluster.getStats()
              },
              standardProxy: this.stdProxy.getStats(),
              hedgedProxy: this.hedgedProxy.getStats(),
              autoTrafficActive: this.trafficInterval !== null
            })
          );
          return;
        }

        // API: Update Chaos Config
        if (pathname === '/api/chaos' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const config = JSON.parse(body);
              this.cluster.setChaos(config);
              this.broadcastSSE('chaos_updated', this.cluster.getChaos());
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, chaos: this.cluster.getChaos() }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // API: Single Request Pair Test
        if (pathname === '/api/test/single' && req.method === 'POST') {
          const result = await this.executeDualRequest();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
          return;
        }

        // API: Batch Run
        if (pathname === '/api/test/batch' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            const { count = 50, delayBetweenMs = 40 } = body ? JSON.parse(body) : {};
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ started: true, count }));

            for (let i = 0; i < count; i++) {
              await this.executeDualRequest();
              if (delayBetweenMs > 0) {
                await new Promise((r) => setTimeout(r, delayBetweenMs));
              }
            }
          });
          return;
        }

        // API: Toggle Continuous Background Traffic
        if (pathname === '/api/traffic/toggle' && req.method === 'POST') {
          if (this.trafficInterval) {
            clearInterval(this.trafficInterval);
            this.trafficInterval = null;
          } else {
            this.trafficInterval = setInterval(() => {
              this.executeDualRequest().catch(() => {});
            }, 120);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ active: this.trafficInterval !== null }));
          return;
        }

        // API: Reset Metrics
        if (pathname === '/api/reset' && req.method === 'POST') {
          this.stdProxy.reset();
          this.hedgedProxy.reset();
          this.cluster.resetStats();
          this.broadcastSSE('stats_reset', {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Static Files Serving
        let reqPath = pathname === '/' ? '/index.html' : pathname;
        let safePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
        if (!safePath.startsWith(PUBLIC_DIR)) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('Forbidden');
          return;
        }

        this.serveStatic(req, res, safePath);
      });

      this.server.listen(this.port, () => {
        console.log(`\n======================================================`);
        console.log(`  🌟 TAILSQUASH WEB DASHBOARD RUNNING AT:`);
        console.log(`     👉 http://localhost:${this.port}`);
        console.log(`======================================================\n`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.trafficInterval) clearInterval(this.trafficInterval);
    if (this.server) await new Promise((r) => this.server.close(r));
    if (this.stdProxy) await this.stdProxy.stop();
    if (this.hedgedProxy) await this.hedgedProxy.stop();
    if (this.cluster) await this.cluster.stop();
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('server.js')) {
  const app = new WebAppServer(3000);
  app.init().then(() => app.start()).catch(console.error);
}
