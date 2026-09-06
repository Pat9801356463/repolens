import http from 'node:http';

/**
 * MockCluster: Simulates a cluster of 3 enterprise backend nodes
 * (e.g. storage or microservice nodes) with configurable tail-latency chaos.
 */
export class MockCluster {
  constructor() {
    this.nodes = [
      { id: 'node-a', port: 4001, name: 'Cluster Node Alpha', isDegraded: false },
      { id: 'node-b', port: 4002, name: 'Cluster Node Beta', isDegraded: false },
      { id: 'node-c', port: 4003, name: 'Cluster Node Gamma', isDegraded: false }
    ];

    // Chaos configuration
    this.chaosConfig = {
      stragglerRate: 0.05,        // 5% of requests experience a tail-latency stall
      baseLatencyMin: 8,          // Minimum normal processing time in ms
      baseLatencyMax: 16,         // Maximum normal processing time in ms
      stragglerDelayMin: 600,     // Minimum stall duration in ms (e.g. GC pause)
      stragglerDelayMax: 1100,    // Maximum stall duration in ms
      targetedNodeStall: null     // If set to 'node-a', 'node-b', or 'node-c', that node is constantly stalled
    };

    // Node runtime telemetry
    this.stats = {
      'node-a': { requests: 0, stragglers: 0, totalMs: 0 },
      'node-b': { requests: 0, stragglers: 0, totalMs: 0 },
      'node-c': { requests: 0, stragglers: 0, totalMs: 0 }
    };

    this.servers = [];
  }

  setChaos(newConfig) {
    this.chaosConfig = { ...this.chaosConfig, ...newConfig };
  }

  getChaos() {
    return { ...this.chaosConfig };
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats() {
    for (const key of Object.keys(this.stats)) {
      this.stats[key] = { requests: 0, stragglers: 0, totalMs: 0 };
    }
  }

  start() {
    return Promise.all(
      this.nodes.map((node) => {
        return new Promise((resolve) => {
          const server = http.createServer((req, res) => {
            const start = performance.now();
            const nodeId = node.id;
            const stats = this.stats[nodeId];
            stats.requests++;

            // Check if this request should experience a tail-latency stall (straggler)
            const isTargetStall = this.chaosConfig.targetedNodeStall === nodeId;
            const isRandomStraggler = Math.random() < this.chaosConfig.stragglerRate;
            const isStraggler = isTargetStall || isRandomStraggler;

            let delayMs = Math.floor(
              this.chaosConfig.baseLatencyMin +
              Math.random() * (this.chaosConfig.baseLatencyMax - this.chaosConfig.baseLatencyMin)
            );

            if (isStraggler) {
              stats.stragglers++;
              const stallAddition = Math.floor(
                this.chaosConfig.stragglerDelayMin +
                Math.random() * (this.chaosConfig.stragglerDelayMax - this.chaosConfig.stragglerDelayMin)
              );
              delayMs += stallAddition;
            }

            // Support client cancellation (e.g. AbortController from proxy)
            let aborted = false;
            req.on('close', () => {
              if (!res.writableEnded) {
                aborted = true;
              }
            });

            setTimeout(() => {
              if (aborted) {
                return; // Client aborted; do not send response
              }

              const elapsed = performance.now() - start;
              stats.totalMs += elapsed;

              res.writeHead(200, {
                'Content-Type': 'application/json',
                'X-Cluster-Node': nodeId,
                'X-Processing-Time-Ms': elapsed.toFixed(2),
                'X-Was-Straggler': isStraggler ? 'true' : 'false'
              });

              res.end(
                JSON.stringify({
                  success: true,
                  node: nodeId,
                  nodeName: node.name,
                  latencyMs: parseFloat(elapsed.toFixed(2)),
                  isStraggler,
                  timestamp: Date.now(),
                  payload: `Data chunk from ${node.name} [CRC-32: ${Math.random().toString(36).substring(2, 8)}]`
                })
              );
            }, delayMs);
          });

          server.listen(node.port, () => {
            this.servers.push(server);
            resolve(node);
          });
        });
      })
    );
  }

  stop() {
    return Promise.all(
      this.servers.map((s) => new Promise((resolve) => s.close(resolve)))
    );
  }
}
