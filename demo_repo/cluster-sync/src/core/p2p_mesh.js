import { EventEmitter } from 'node:events';

/**
 * P2PMeshEngine: Manages peer-to-peer tree distribution and chunk pipelining
 * across 10s to 100s of cluster nodes.
 */
export class P2PMeshEngine extends EventEmitter {
  constructor(branchingFactor = 2) {
    super();
    this.branchingFactor = branchingFactor; // Binary tree default (k=2)
  }

  /**
   * Computes the tree topology for N nodes (indices 0 to N-1).
   * For binary tree: parent of i is Math.floor((i - 1) / 2)
   * children of i are 2*i + 1 and 2*i + 2.
   */
  getTopology(nodeCount, rootNodeIndex = 0) {
    const topology = new Map();
    // Remap nodes so that rootNodeIndex is at index 0 of the tree
    const orderedNodes = [];
    orderedNodes.push(rootNodeIndex);
    for (let i = 0; i < nodeCount; i++) {
      if (i !== rootNodeIndex) orderedNodes.push(i);
    }

    const k = this.branchingFactor;
    for (let treeIdx = 0; treeIdx < orderedNodes.length; treeIdx++) {
      const nodeId = orderedNodes[treeIdx];
      const children = [];
      for (let c = 1; c <= k; c++) {
        const childTreeIdx = treeIdx * k + c;
        if (childTreeIdx < orderedNodes.length) {
          children.push(orderedNodes[childTreeIdx]);
        }
      }

      const parentTreeIdx = treeIdx > 0 ? Math.floor((treeIdx - 1) / k) : null;
      const parent = parentTreeIdx !== null ? orderedNodes[parentTreeIdx] : null;

      topology.set(nodeId, {
        nodeId,
        treeIdx,
        parent,
        children
      });
    }

    return topology;
  }

  /**
   * Simulates SyncMesh P2P Tree Swarm distribution of chunks.
   * Chunks are pipelined concurrently across the tree.
   * 
   * @param {number} nodeCount - Total nodes in the cluster (e.g. 100)
   * @param {number} sourceNodeId - Node originating the file update
   * @param {Array} chunkList - Array of chunk metadata { index, size, hash }
   * @param {Object} options - Network simulation params
   */
  async distributeP2P(nodeCount, sourceNodeId, chunkList, options = {}) {
    const { linkDelayMs = 2, bandwidthKbps = 100000 } = options;
    const topology = this.getTopology(nodeCount, sourceNodeId);

    // Node state: Set of received chunk indices
    const nodeReceivedChunks = Array.from({ length: nodeCount }, () => new Set());
    // Source already has all chunks
    for (const c of chunkList) {
      nodeReceivedChunks[sourceNodeId].add(c.index);
    }

    let masterEgressBytes = 0;
    let totalClusterBytes = 0;
    const events = [];
    const t0 = performance.now();

    // Pipelined queue of transfers: [ { from, to, chunk, readyTime } ]
    const inFlight = [];

    // Push initial transfers from source to its immediate children
    const sourceNode = topology.get(sourceNodeId);
    for (const chunk of chunkList) {
      for (const childId of sourceNode.children) {
        masterEgressBytes += chunk.size;
        totalClusterBytes += chunk.size;
        inFlight.push({
          from: sourceNodeId,
          to: childId,
          chunk,
          scheduledTime: 0
        });
      }
    }

    // Step-by-step parallel event simulation:
    // Track the available timestamp per node to accurately reflect concurrent NIC transfers
    const nodeBusyUntil = Array(nodeCount).fill(0);
    let maxClusterClockMs = 0;

    while (inFlight.length > 0) {
      // Sort by scheduled ready time to process chronologically
      inFlight.sort((a, b) => a.scheduledTime - b.scheduledTime);
      const current = inFlight.shift();

      const transferDuration = Math.max(
        linkDelayMs,
        (current.chunk.size * 8) / (bandwidthKbps / 1000)
      );

      // Earliest time this link can start: when data is ready AND sender NIC is free
      const startTime = Math.max(current.scheduledTime, nodeBusyUntil[current.from]);
      const finishTime = startTime + transferDuration;
      nodeBusyUntil[current.from] = finishTime;

      maxClusterClockMs = Math.max(maxClusterClockMs, finishTime);

      // Destination receives chunk
      nodeReceivedChunks[current.to].add(current.chunk.index);

      const evt = {
        from: current.from,
        to: current.to,
        chunkIndex: current.chunk.index,
        chunkSize: current.chunk.size,
        timestampMs: parseFloat(finishTime.toFixed(2))
      };
      events.push(evt);
      this.emit('transfer', evt);

      // Now that current.to has the chunk, it can pipeline it to its own children
      const toNodeInfo = topology.get(current.to);
      if (toNodeInfo && toNodeInfo.children.length > 0) {
        for (const grandchildId of toNodeInfo.children) {
          totalClusterBytes += current.chunk.size;
          inFlight.push({
            from: current.to,
            to: grandchildId,
            chunk: current.chunk,
            scheduledTime: finishTime
          });
        }
      }
    }

    const elapsedMs = performance.now() - t0;

    return {
      mode: 'P2P_MESH_TREE',
      nodeCount,
      chunkCount: chunkList.length,
      virtualTimeMs: parseFloat(maxClusterClockMs.toFixed(2)),
      actualExecutionMs: parseFloat(elapsedMs.toFixed(2)),
      masterEgressBytes,
      totalClusterBytes,
      eventCount: events.length,
      allNodesInSync: nodeReceivedChunks.every((set) => set.size === chunkList.length)
    };
  }

  /**
   * Simulates traditional Centralized Star topology (Source uploads to each node sequentially or via unicast).
   */
  async distributeCentralized(nodeCount, sourceNodeId, chunkList, options = {}) {
    const { linkDelayMs = 2, bandwidthKbps = 100000 } = options;

    let masterEgressBytes = 0;
    let virtualClockMs = 0;
    const t0 = performance.now();

    // Source sends all chunks to node 1, then node 2, etc. (or parallelized over shared source NIC)
    const targetNodes = [];
    for (let i = 0; i < nodeCount; i++) {
      if (i !== sourceNodeId) targetNodes.push(i);
    }

    for (const targetId of targetNodes) {
      for (const chunk of chunkList) {
        const transferDuration = Math.max(
          linkDelayMs,
          (chunk.size * 8) / (bandwidthKbps / 1000)
        );
        virtualClockMs += transferDuration;
        masterEgressBytes += chunk.size;
      }
    }

    const elapsedMs = performance.now() - t0;

    return {
      mode: 'CENTRALIZED_STAR',
      nodeCount,
      chunkCount: chunkList.length,
      virtualTimeMs: parseFloat(virtualClockMs.toFixed(2)),
      actualExecutionMs: parseFloat(elapsedMs.toFixed(2)),
      masterEgressBytes,
      totalClusterBytes: masterEgressBytes,
      allNodesInSync: true
    };
  }
}
