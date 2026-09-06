# ⚡ TailSquash
### Predictive Hedged-Request Reverse Proxy & Tail-Latency Elimination Fabric
> **Nutanix Hackathon @ IIT Guwahati — "Surprise Us!" Track**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Runtime: Node.js 22+](https://img.shields.io/badge/Runtime-Node.js_22+-green.svg)](https://nodejs.org/)
[![Architecture: Distributed Systems](https://img.shields.io/badge/Domain-Distributed_Systems_%2F_Cloud_Infra-purple.svg)]()

---

## 1. Executive Summary & Problem Context

In modern distributed cloud platforms and hyperconverged infrastructure (such as **Nutanix Prism, AOS distributed storage, and Kubernetes clusters**), user-facing transactions fan out across dozens or hundreds of internal microservice and storage nodes.

* **The Tail at Scale Problem:** Even when 95% of requests complete within 10–15ms, individual nodes intermittently experience micro-stalls (Java/Go garbage collection pauses, CPU throttling bursts, noisy neighbors, or I/O buffer flushes). A single slow node delays the entire user transaction.
* **The Compounding Penalty:** If a transaction touches 50 internal nodes and each node has just a 1% probability of a 1-second stall, over **40% of all user requests experience a 1-second delay**.
* **The TailSquash Solution:** TailSquash is an intelligent, low-overhead reverse proxy engine that dynamically tracks the rolling **P90 latency**. When an upstream node does not return headers within the P90 window, TailSquash speculatively dispatches a duplicate request (hedged request) to an alternate healthy replica node. Whichever finishes first is returned to the client, while the slower connection is terminated immediately via `AbortController`.

---

## 2. Key Benchmark Results

Under a high-concurrency load test with 5% artificial cluster stragglers (600–1100ms stalls):

| Metric | Standard Proxy (Baseline) | TailSquash (Hedged) | Improvement / Impact |
|:---|:---:|:---:|:---:|
| **P50 (Median)** | **33.28 ms** | **33.98 ms** | Latency Parity |
| **P90** | **57.83 ms** | **59.46 ms** | Optimal boundary |
| **P95** | **90.15 ms** | **66.10 ms** | Eliminated stall |
| **P99 (Critical Tail)** | **963.52 ms** | **75.92 ms** | **🚀 92.12% Reduction (12.7x Faster!)** |
| **P99.9 (Worst Case)** | **1,113.94 ms** | **736.28 ms** | Sub-second ceiling |
| **Hedge Traffic Overhead**| **0%** | **4.17%** | **Safe Budget (&lt; 5%)** |
| **Connections Aborted** | **0** | **25+** | **Zero Stale Server Work** |

---

## 3. System Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Client / Load Generator  │
                                  └──────────────┬────────────────┘
                                                 │ HTTP Request
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TAILSQUASH PROXY ENGINE                                        │
│                                                                                                  │
│   ┌─────────────────────────┐     ┌───────────────────────────┐    ┌─────────────────────────┐   │
│   │ Dynamic Latency Tracker │     │ Speculative Dispatcher    │    │ Hedge Budget Guard      │   │
│   │ (Rolling P90 Reservoir) │     │ (Primary + Hedged Race)   │    │ (Hard Cap < 8% Overhead)│   │
│   └────────────┬────────────┘     └─────────────┬─────────────┘    └────────────┬────────────┘   │
└────────────────┼────────────────────────────────┼───────────────────────────────┼────────────────┘
                 │                                │                               │
                 │ 1. Primary Request             │ 2. If time > P90:             │
                 ▼                                ▼    Speculative Hedge          ▼
     ┌───────────────────────┐        ┌───────────────────────┐       ┌───────────────────────┐
     │  Cluster Node Alpha   │        │   Cluster Node Beta   │       │  Cluster Node Gamma   │
     │      (Port 4001)      │        │      (Port 4002)      │       │      (Port 4003)      │
     └───────────────────────┘        └───────────────────────┘       └───────────────────────┘
                 │                                │
                 │ (Stalled: 1000ms GC pause)     │ (Healthy: Responds in 12ms!)
                 │                                ▼
                 │                  [ Node Beta Returns Winner ]
                 │                                │
                 ▼                                ▼
         [ Abort Signal ] ◄───────────────────────┴──────────────► [ Stream Response to Client ]
```

---

## 4. Core Engineering Innovations

1. **Adaptive Sliding-Window Reservoir:**
   Continuously computes rolling P50, P90, P95, and P99 response latencies without locking overhead, dynamically adapting to fluctuating network conditions.
2. **Speculative Dual-Dispatch with Zero Stale Work:**
   Uses native `AbortController` to terminate lagging upstream connections the microsecond a replica returns. Backend servers are spared from wasting CPU cycles on orphaned calculations.
3. **Hedge Budget Circuit Breaker:**
   Implements a token-bucket safety guard ensuring speculative requests never exceed a strict threshold (default 8%), preventing cascading retry storms during major cluster outages.
4. **Real-time Live Telemetry & Chaos Deck:**
   Built-in Server-Sent Events (SSE) stream and dark-mode monitoring dashboard providing side-by-side latency comparisons and interactive chaos injection.

---

## 5. Quickstart & Verification

### Prerequisites
* Node.js v18+ (tested on Node.js v22.16.0)

### 1. Launch the Interactive Web Dashboard & Mock Cluster
```bash
npm start
```
Open your browser and navigate to:
👉 **`http://localhost:3000`**

* Click **`⚡ Burst 50 Req`** to simulate concurrent client traffic.
* Click **`⚠️ Force 1000ms Stall`** to see TailSquash instantly rescue the request.
* Toggle **`▶ Start Auto Load`** for continuous real-time charts.

### 2. Run the Statistical CLI Benchmark Suite
```bash
npm run benchmark
```
This executes an automated 600-request high-concurrency load test and outputs statistical percentiles for both proxies.

---

## 6. Suggested 5-Minute Video & Presentation Pitch

* **Slide 1 (0:00 - 0:45) — The Problem:** Explain "The Tail at Scale" in distributed cloud infrastructure. Mention how 1 slow node degrades 50-node fanouts in systems like Nutanix AOS/Prism.
* **Slide 2 (0:45 - 1:30) — The Architecture:** Explain TailSquash's dynamic P90 threshold, speculative dual-dispatch, and the Hedge Budget Guard.
* **Slide 3 (1:30 - 3:30) — Live Demonstration:** Show the Web Dashboard running side-by-side with continuous traffic. Inject a 1000ms straggler; highlight how the standard proxy spikes while TailSquash stays completely flat.
* **Slide 4 (3:30 - 4:15) — Benchmark & Quantitative Proof:** Show the 92.1% P99 reduction table and the sub-5% overhead guarantee.
* **Slide 5 (4:15 - 5:00) — Enterprise Impact:** Conclude on enterprise cloud relevance (SLA guarantees, zero downtime, CPU savings).
