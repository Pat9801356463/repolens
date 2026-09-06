import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClusterSimulator } from '../cluster/cluster_simulator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

export class SyncMeshWebServer {
  constructor(port = 3001) {
    this.port = port;
    this.simulator = new ClusterSimulator(100, 32 * 1024);
    this.server = null;
    this.sseClients = new Set();
    this.activeFilename = 'nutanix-workload.tar';

    // Hook mesh events to broadcast to UI
    this.simulator.meshEngine.on('transfer', (evt) => {
      this.broadcastSSE('chunk_transfer', evt);
    });

    // Seed initial file
    this._seedInitialFile();
  }

  _seedInitialFile() {
    const size = 1024 * 1024; // 1 MB initial file
    const buf = Buffer.alloc(size, 'S');
    for (let i = 0; i < size; i += 2048) {
      buf.write(`[BLOB_SEGMENT_${i}]`, i);
    }
    this.simulator.createFileOnNode(0, this.activeFilename, buf);
  }

  broadcastSSE(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.sseClients) {
      client.write(msg);
    }
  }

  serveStatic(req, res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
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

  start() {
    return new Promise((resolve) => {
      this.server = http.createServer(async (req, res) => {
        const parsedUrl = new URL(req.url, `http://localhost:${this.port}`);
        const pathname = parsedUrl.pathname;

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

        // GET /api/state: full cluster state
        if (pathname === '/api/state' && req.method === 'GET') {
          const state = this.simulator.getClusterState();
          const node0File = this.simulator.nodes[0].files.get(this.activeFilename);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...state,
            activeFilename: this.activeFilename,
            activeFile: node0File ? {
              manifest: node0File.manifest,
              chunkCount: node0File.chunks.size,
              clock: node0File.clock.toJSON()
            } : null
          }));
          return;
        }

        // POST /api/scale: change node count (10, 50, 100)
        if (pathname === '/api/scale' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            const { nodeCount = 100 } = body ? JSON.parse(body) : {};
            this.simulator.setNodeCount(nodeCount);
            this._seedInitialFile();
            this.broadcastSSE('cluster_scaled', { nodeCount });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, nodeCount }));
          });
          return;
        }

        // POST /api/sync: trigger P2P or Centralized sync
        if (pathname === '/api/sync' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            const { mode = 'P2P_MESH_TREE' } = body ? JSON.parse(body) : {};
            this.broadcastSSE('sync_started', { mode });

            const result = await this.simulator.syncFileAcrossCluster(this.activeFilename, 0, mode);
            this.broadcastSSE('sync_completed', result);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          });
          return;
        }

        // POST /api/delta: modify a chunk on Node 0 and trigger delta sync
        if (pathname === '/api/delta' && req.method === 'POST') {
          const node0 = this.simulator.nodes[0];
          const fileEntry = node0.files.get(this.activeFilename);
          const buf = this.simulator.chunker.reassemble(
            fileEntry.manifest,
            Array.from(fileEntry.chunks.values())
          );

          // Edit middle 16 KB
          buf.write(`[DELTA_MUTATION_TS_${Date.now()}]`, 1024 * 64);
          const patchInfo = this.simulator.modifyFileOnNode(0, this.activeFilename, buf);

          // Calculate delta vs Node 1
          const deltaDiff = this.simulator.chunker.computeDelta(
            patchInfo.manifest,
            this.simulator.nodes[1].files.get(this.activeFilename)?.manifest
          );

          // Sync delta
          const syncRes = await this.simulator.syncFileAcrossCluster(this.activeFilename, 0, 'P2P_MESH_TREE');

          this.broadcastSSE('delta_synced', { deltaDiff, syncRes });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, deltaDiff, syncRes }));
          return;
        }

        // POST /api/compare: run side-by-side comparison
        if (pathname === '/api/compare' && req.method === 'POST') {
          const comparison = await this.simulator.runComparison(this.activeFilename, 0);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(comparison));
          return;
        }

        // POST /api/reset
        if (pathname === '/api/reset' && req.method === 'POST') {
          this.simulator._initNodes();
          this._seedInitialFile();
          this.broadcastSSE('cluster_reset', {});
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Serve static assets
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
        console.log(`  🌟 SYNCMESH CLUSTER DASHBOARD RUNNING AT:`);
        console.log(`     👉 http://localhost:${this.port}`);
        console.log(`======================================================\n`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      return new Promise((resolve) => this.server.close(resolve));
    }
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('server.js')) {
  const app = new SyncMeshWebServer(3001);
  app.start().catch(console.error);
}
