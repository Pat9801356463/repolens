# 🌐 SyncMesh
### Scalable P2P Swarm & Merkle-Tree Cluster File Synchronization Engine
> **Nutanix Hackathon @ IIT Guwahati — Track 2: File Sync Across Machines (Scalable to 100s of Machines)**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Node.js 22+](https://img.shields.io/badge/Runtime-Node.js_22+-green.svg)](https://nodejs.org/)
[![Domain: Distributed Systems](https://img.shields.io/badge/Domain-Distributed_Storage_%26_Clustering-purple.svg)]()

---

## 1. Problem Statement & Motivation

Nutanix Hackathon Problem Statement #2 asks:
> *"Develop mechanism to keep the files in sync across two machines. There is need to keep the files in multiple machines of a cluster in sync. Bring-in your ideas and build solution for this case. The solution should be scalable and performant and be able to deal with 100s of machines."*

### The Bottleneck of Traditional Centralized Sync ($O(N)$ Star):
In traditional cluster sync (like standard `rsync` loops or centralized master-worker topologies), the primary machine must upload data sequentially or via unicast to every single replica:
* For a **2 MB container layer across 100 machines**, the master node must upload **198 MB of data**.
* The master node's Network Interface Card (NIC) becomes saturated, CPU spikes, and synchronization takes up to **16+ seconds**.
* Modifying even a single 16 KB segment usually triggers a multi-megabyte re-transfer.

### The SyncMesh Innovation ($O(\log N)$ P2P Tree Swarm):
SyncMesh solves cluster-wide replication using **BitTorrent-inspired P2P Tree Distribution** and **Merkle Content-Defined Chunking**:
1. **Pipelined Tree Swarm:** Machines organize into a balanced $k$-ary distribution tree. When Node 0 pushes Chunk 0 to its children (Node 1 and Node 2), Node 1 immediately forwards Chunk 0 to Node 3 and Node 4 while Node 0 uploads Chunk 1!
2. **Master Egress Offload (97.98% Reduction):** The master only transmits each chunk to its immediate $k$ children ($k=2$), meaning master egress stays at a fixed $\approx 4\text{ MB}$ regardless of whether the cluster has 10 or 100 nodes!
3. **Merkle Delta-Chunking:** Files are sliced into content-addressable SHA-256 chunks. If 16 KB changes in a 2 MB file, only the 16 KB delta block is replicated across the cluster (**98.44% bandwidth saved**).
4. **Vector Clocks:** Multi-master concurrent writes are tracked with vector clocks to prevent silent split-brain overwrites.

---

## 2. Benchmark Results: 10, 50, and 100 Machines

| Cluster Scale | Metric | Centralized Star Sync ($O(N)$) | SyncMesh P2P Swarm ($O(\log N)$) | Improvement / Impact |
|:---:|:---|:---:|:---:|:---:|
| **10 Nodes** | Master Egress Bandwidth | **18.0 MB** | **4.0 MB** | **77.78% Egress Saved** |
| | Distribution Latency | **1,509.9 ms** | **340.8 ms** | **4.4x Faster** |
| **50 Nodes** | Master Egress Bandwidth | **98.0 MB** | **4.0 MB** | **95.92% Egress Saved** |
| | Distribution Latency | **8,220.8 ms** | **353.9 ms** | **23.2x Faster** |
| **100 Nodes** | Master Egress Bandwidth | **198.0 MB** | **4.0 MB** | **🚀 97.98% Egress Saved!** |
| | Distribution Latency | **16,609.4 ms** | **359.1 ms** | **🚀 46.2x Faster!** |
| **Delta Sync** | 16 KB Patch on 2 MB File | **198.0 MB** | **3.09 MB** | **🚀 98.44% Delta Bandwidth Saved!** |

---

## 3. System Architecture

```
                       ┌──────────────────────────────┐
                       │     Local File Mutation      │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │    Merkle Tree Engine        │
                       │    (32 KB SHA-256 Chunks)    │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │    Vector Clock Causality    │
                       │    { Node-000: Clock + 1 }   │
                       └──────────────┬───────────────┘
                                      │
             ┌────────────────────────┴────────────────────────┐
             │                                                 │
             ▼ Chunk 0                                         ▼ Chunk 0
    ┌─────────────────┐                               ┌─────────────────┐
    │     Node 1      │                               │     Node 2      │
    └────────┬────────┘                               └────────┬────────┘
             │                                                 │
      ┌──────┴──────┐                                   ┌──────┴──────┐
      ▼             ▼                                   ▼             ▼
┌───────────┐ ┌───────────┐                       ┌───────────┐ ┌───────────┐
│  Node 3   │ │  Node 4   │                       │  Node 5   │ │  Node 6   │
└───────────┘ └───────────┘                       └───────────┘ └───────────┘
```

---

## 4. Quickstart & Verification

### 1. Launch the 100-Node Visualizer Web Dashboard
```bash
npm start
```
Navigate to:
👉 **`http://localhost:3001`**

* Select between **`10 Nodes`**, **`50 Nodes`**, or **`100 Nodes`**.
* Click **`🚀 Sync P2P Tree ($O(\log N))$`** to watch chunks pipeline across the 100-node matrix.
* Click **`⚡ Delta Sync (1 Chunk)`** to test Merkle delta synchronization.
* Click **`⚖️ Star vs P2P`** to view real-time comparative metrics.

### 2. Run the Reproducible 100-Node Scaling Benchmark
```bash
npm run benchmark
```

---

## 5. Suggested 5-Minute Video Pitch Script for Nutanix Judges

* **Minute 0:00 - 0:45 (The Challenge):** Explain why standard file sync (`rsync`/centralized star) fails at scale: master node NIC saturation and $O(N)$ linear delays across 100 cluster nodes in Nutanix AOS/Files.
* **Minute 0:45 - 1:45 (The Architecture):** Introduce SyncMesh's 3 pillars:
  1. $O(\log N)$ P2P Tree Swarm distribution.
  2. Merkle Tree Content-Defined Chunking.
  3. Vector Clock causality tracking.
* **Minute 1:45 - 3:30 (Live Demo on Screen):**
  * Open `http://localhost:3001`.
  * Show the 100-node matrix.
  * Trigger P2P Sync: watch nodes pipeline and converge to 100/100 in milliseconds.
  * Trigger Delta Sync: show that only 1 chunk is sent.
  * Show the comparison bars: 97.98% master egress saved!
* **Minute 3:30 - 4:15 (The Empirical Numbers):**
  * Walk through the benchmark table for 10, 50, and 100 nodes (46.2x faster, 97.98% egress reduction).
* **Minute 4:15 - 5:00 (Nutanix Alignment & Conclusion):**
  * Highlight direct applications for Nutanix: distributed VM disk replication, container layer distribution in Nutanix Kubernetes Engine, and rapid cluster configuration fan-out.
