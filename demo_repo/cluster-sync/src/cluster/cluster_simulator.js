import { Chunker } from '../core/chunker.js';
import { VectorClock } from '../core/vector_clock.js';
import { P2PMeshEngine } from '../core/p2p_mesh.js';

/**
 * ClusterSimulator: Orchestrates a virtual cluster of 10 to 100 nodes,
 * supporting Delta Merkle syncing, vector clock conflict resolution, and P2P tree distribution.
 */
export class ClusterSimulator {
  constructor(nodeCount = 100, chunkSizeBytes = 32 * 1024) {
    this.nodeCount = nodeCount;
    this.chunker = new Chunker(chunkSizeBytes);
    this.meshEngine = new P2PMeshEngine(2); // Binary distribution tree
    this.nodes = [];
    this.lastSyncReport = null;

    this._initNodes();
  }

  _initNodes() {
    this.nodes = Array.from({ length: this.nodeCount }, (_, i) => ({
      id: i,
      name: `Node-${i.toString().padStart(3, '0')}`,
      status: 'idle', // 'idle' | 'syncing' | 'synced'
      files: new Map(), // filename -> { manifest, chunks: Map(idx -> chunk), clock: VectorClock }
      rxBytes: 0,
      txBytes: 0
    }));
  }

  setNodeCount(count) {
    this.nodeCount = count;
    this._initNodes();
  }

  /**
   * Initializes a file on a source node
   */
  createFileOnNode(sourceNodeId, filename, contentBuffer) {
    const node = this.nodes[sourceNodeId];
    if (!node) throw new Error(`Node ${sourceNodeId} does not exist`);

    const { manifest, chunks } = this.chunker.chunkFile(filename, contentBuffer);
    const clock = new VectorClock().increment(sourceNodeId);

    const chunkMap = new Map();
    for (const c of chunks) {
      chunkMap.set(c.index, c);
    }

    node.files.set(filename, {
      manifest,
      chunks: chunkMap,
      clock
    });

    node.status = 'synced';
    return { manifest, chunkCount: chunks.length, rootHash: manifest.rootHash };
  }

  /**
   * Appends or edits a file on a node to simulate Delta updates
   */
  modifyFileOnNode(sourceNodeId, filename, newBuffer) {
    const node = this.nodes[sourceNodeId];
    const existing = node.files.get(filename);
    const clock = existing ? existing.clock.clone().increment(sourceNodeId) : new VectorClock().increment(sourceNodeId);

    const { manifest, chunks } = this.chunker.chunkFile(filename, newBuffer);
    const chunkMap = new Map();
    for (const c of chunks) {
      chunkMap.set(c.index, c);
    }

    node.files.set(filename, {
      manifest,
      chunks: chunkMap,
      clock
    });

    return { manifest, chunkCount: chunks.length, rootHash: manifest.rootHash };
  }

  /**
   * Syncs a file across all nodes in the cluster
   */
  async syncFileAcrossCluster(filename, sourceNodeId = 0, mode = 'P2P_MESH_TREE') {
    const sourceNode = this.nodes[sourceNodeId];
    const fileEntry = sourceNode.files.get(filename);
    if (!fileEntry) throw new Error(`File ${filename} not found on source node ${sourceNodeId}`);

    const manifest = fileEntry.manifest;
    const chunkList = Array.from(fileEntry.chunks.values());

    // Mark nodes as syncing
    for (let i = 0; i < this.nodeCount; i++) {
      if (i !== sourceNodeId) this.nodes[i].status = 'syncing';
    }

    // Run distribution
    let result;
    if (mode === 'P2P_MESH_TREE') {
      result = await this.meshEngine.distributeP2P(this.nodeCount, sourceNodeId, chunkList);
    } else {
      result = await this.meshEngine.distributeCentralized(this.nodeCount, sourceNodeId, chunkList);
    }

    // Replicate files and verify integrity across all destination nodes
    for (let i = 0; i < this.nodeCount; i++) {
      if (i !== sourceNodeId) {
        const destNode = this.nodes[i];
        const destChunkMap = new Map();
        for (const c of chunkList) {
          destChunkMap.set(c.index, c);
        }

        // Verify reassembly integrity
        this.chunker.reassemble(manifest, chunkList);

        destNode.files.set(filename, {
          manifest,
          chunks: destChunkMap,
          clock: fileEntry.clock.clone()
        });
        destNode.status = 'synced';
      }
    }

    this.lastSyncReport = result;
    return result;
  }

  /**
   * Performs side-by-side comparison between Centralized Star and P2P Tree Swarm
   */
  async runComparison(filename, sourceNodeId = 0) {
    const sourceNode = this.nodes[sourceNodeId];
    const fileEntry = sourceNode.files.get(filename);
    const chunkList = Array.from(fileEntry.chunks.values());

    const centralized = await this.meshEngine.distributeCentralized(this.nodeCount, sourceNodeId, chunkList);
    const p2p = await this.meshEngine.distributeP2P(this.nodeCount, sourceNodeId, chunkList);

    const egressSavingsBytes = centralized.masterEgressBytes - p2p.masterEgressBytes;
    const egressSavingsPercent = ((egressSavingsBytes / centralized.masterEgressBytes) * 100).toFixed(2);
    const speedupFactor = (centralized.virtualTimeMs / Math.max(1, p2p.virtualTimeMs)).toFixed(1);

    return {
      nodeCount: this.nodeCount,
      fileSize: fileEntry.manifest.totalSize,
      chunkCount: chunkList.length,
      centralized: {
        timeMs: centralized.virtualTimeMs,
        masterEgressBytes: centralized.masterEgressBytes
      },
      p2p: {
        timeMs: p2p.virtualTimeMs,
        masterEgressBytes: p2p.masterEgressBytes,
        totalClusterBytes: p2p.totalClusterBytes
      },
      egressSavingsPercent: parseFloat(egressSavingsPercent),
      speedupFactor: parseFloat(speedupFactor)
    };
  }

  getClusterState() {
    return {
      nodeCount: this.nodeCount,
      nodes: this.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        status: n.status,
        fileCount: n.files.size
      })),
      lastSyncReport: this.lastSyncReport
    };
  }
}
