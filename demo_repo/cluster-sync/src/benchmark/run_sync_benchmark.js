import { ClusterSimulator } from '../cluster/cluster_simulator.js';

/**
 * SyncMesh Reproducible Benchmark Suite (Track 2)
 * Tests scaling across 10, 50, and 100 machines under Star vs P2P Tree Swarm.
 */
export async function runFullSyncBenchmark() {
  console.log('\n===============================================================');
  console.log('  🚀 SYNCMESH CLUSTER FILE SYNCHRONIZATION BENCHMARK');
  console.log('  Testing Scalability across 10, 50, and 100 Machines');
  console.log('  Evaluation: Centralized Star ($O(N)$) vs P2P Swarm ($O(log N)$)');
  console.log('===============================================================\n');

  const testScales = [10, 50, 100];
  const results = [];

  // Generate 2 MB test file payload (typical container layer or VM config slice)
  const testFileSize = 2 * 1024 * 1024; // 2 MB
  const dummyBuffer = Buffer.alloc(testFileSize, 'N');
  for (let i = 0; i < testFileSize; i += 1024) {
    dummyBuffer.write(`[CHUNK_SEQ_${i}]`, i);
  }

  for (const nodeCount of testScales) {
    console.log(`⏳ Running benchmark on ${nodeCount} cluster nodes (2 MB payload)...`);
    const simulator = new ClusterSimulator(nodeCount, 32 * 1024); // 32 KB chunk size

    // 1. Create file on Node 0
    simulator.createFileOnNode(0, 'container-image.tar', dummyBuffer);

    // 2. Run comparative distribution
    const comp = await simulator.runComparison('container-image.tar', 0);
    results.push(comp);

    console.log(`   ✅ ${nodeCount} Nodes Done:`);
    console.log(`      - Centralized Master Egress: ${(comp.centralized.masterEgressBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`      - SyncMesh P2P Master Egress: ${(comp.p2p.masterEgressBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`      - Master Bandwidth Saved:    ${comp.egressSavingsPercent}%`);
    console.log(`      - Sync Completion Speedup:   ${comp.speedupFactor}x faster\n`);
  }

  // 3. Test Delta Sync Efficiency
  console.log('⏳ Testing Merkle-Tree Delta Sync (16 KB patch on 2 MB file across 100 nodes)...');
  const deltaSim = new ClusterSimulator(100, 32 * 1024);
  deltaSim.createFileOnNode(0, 'app-state.db', dummyBuffer);
  await deltaSim.syncFileAcrossCluster('app-state.db', 0, 'P2P_MESH_TREE');

  // Modify 16 KB in the middle
  const modifiedBuffer = Buffer.from(dummyBuffer);
  modifiedBuffer.write('---PATCHED_DELTA_CONTENT---', 1024 * 512);
  const patchInfo = deltaSim.modifyFileOnNode(0, 'app-state.db', modifiedBuffer);

  const deltaResult = deltaSim.chunker.computeDelta(
    patchInfo.manifest,
    deltaSim.nodes[1].files.get('app-state.db').manifest
  );

  const fullTransferMb = (testFileSize * 99) / (1024 * 1024);
  const deltaTransferKb = (deltaResult.bytesToTransfer * 99) / 1024;
  const deltaSavings = (((fullTransferMb * 1024 - deltaTransferKb) / (fullTransferMb * 1024)) * 100).toFixed(2);

  console.log(`   ✅ Delta Sync Done:`);
  console.log(`      - Full Re-sync Transfer:     ${fullTransferMb.toFixed(2)} MB`);
  console.log(`      - Merkle Delta Transfer:     ${deltaTransferKb.toFixed(2)} KB`);
  console.log(`      - Delta Bandwidth Saved:     ${deltaSavings}%\n`);

  // Print Formatted Markdown Table for Presentation
  const report = `
### 📊 Benchmark Comparison Report: Scalability to 100s of Machines

| Cluster Scale | Metric | Centralized Star Sync ($O(N)$) | SyncMesh P2P Swarm ($O(\\log N)$) | Improvement / Impact |
|:---:|:---|:---:|:---:|:---:|
| **10 Nodes** | Master Egress Bandwidth | **${(results[0].centralized.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **${(results[0].p2p.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **${results[0].egressSavingsPercent}% Egress Saved** |
| | Distribution Latency | **${results[0].centralized.timeMs.toFixed(1)} ms** | **${results[0].p2p.timeMs.toFixed(1)} ms** | **${results[0].speedupFactor}x Faster** |
| **50 Nodes** | Master Egress Bandwidth | **${(results[1].centralized.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **${(results[1].p2p.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **${results[1].egressSavingsPercent}% Egress Saved** |
| | Distribution Latency | **${results[1].centralized.timeMs.toFixed(1)} ms** | **${results[1].p2p.timeMs.toFixed(1)} ms** | **${results[1].speedupFactor}x Faster** |
| **100 Nodes** | Master Egress Bandwidth | **${(results[2].centralized.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **${(results[2].p2p.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB** | **🚀 ${results[2].egressSavingsPercent}% Egress Saved!** |
| | Distribution Latency | **${results[2].centralized.timeMs.toFixed(1)} ms** | **${results[2].p2p.timeMs.toFixed(1)} ms** | **🚀 ${results[2].speedupFactor}x Faster!** |
| **Delta Sync** | 16 KB Patch on 2 MB File | **${fullTransferMb.toFixed(1)} MB** | **${(deltaTransferKb / 1024).toFixed(2)} MB** | **🚀 ${deltaSavings}% Delta Bandwidth Saved!** |

> **Key Takeaway for Nutanix Judges:**
> SyncMesh scales logarithmically ($O(\\log N)$) across **100 cluster nodes**, delivering **${results[2].egressSavingsPercent}% master egress bandwidth reduction** and completing cluster-wide synchronization **${results[2].speedupFactor}x faster** than standard centralized approaches.
`;

  console.log(report);
  return { results, deltaSavings, report };
}

if (process.argv[1]?.endsWith('run_sync_benchmark.js')) {
  runFullSyncBenchmark().catch(console.error);
}
