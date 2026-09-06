// TailSquash Dashboard Client Logic

let timelineChart = null;
let percentileChart = null;
const MAX_TIMELINE_POINTS = 35;
let timelineLabels = [];
let standardData = [];
let hedgedData = [];

// Initialize Charts
function initCharts() {
  const ctxTimeline = document.getElementById('timelineChart').getContext('2d');
  timelineChart = new Chart(ctxTimeline, {
    type: 'line',
    data: {
      labels: timelineLabels,
      datasets: [
        {
          label: 'Standard Proxy (Baseline)',
          data: standardData,
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2
        },
        {
          label: 'TailSquash Hedged',
          data: hedgedData,
          borderColor: '#00f2fe',
          backgroundColor: 'rgba(0, 242, 254, 0.15)',
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          display: false
        },
        y: {
          title: { display: true, text: 'Latency (ms)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
          min: 0,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });

  const ctxPercentile = document.getElementById('percentileChart').getContext('2d');
  percentileChart = new Chart(ctxPercentile, {
    type: 'bar',
    data: {
      labels: ['P50 (Median)', 'P90', 'P95', 'P99 (Tail)', 'P99.9'],
      datasets: [
        {
          label: 'Baseline Proxy',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#f43f5e',
          borderRadius: 6
        },
        {
          label: 'TailSquash Hedged',
          data: [0, 0, 0, 0, 0],
          backgroundColor: '#10b981',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          title: { display: true, text: 'Latency (ms)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
          min: 0
        },
        x: {
          ticks: { color: '#cbd5e1' },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#cbd5e1' }
        }
      }
    }
  });
}

// Add data point to timeline chart
function addTimelinePoint(stdMs, hedgeMs) {
  const timeStr = new Date().toLocaleTimeString();
  timelineLabels.push(timeStr);
  standardData.push(stdMs);
  hedgedData.push(hedgeMs);

  if (timelineLabels.length > MAX_TIMELINE_POINTS) {
    timelineLabels.shift();
    standardData.shift();
    hedgedData.shift();
  }

  timelineChart.update('none');
}

// Update DOM Metrics from /api/status
async function fetchFullStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    renderStatus(data);
  } catch (err) {
    console.error('Failed to fetch status:', err);
  }
}

function renderStatus(data) {
  const stdLat = data.standardProxy.latency;
  const hedgeLat = data.hedgedProxy.latency;
  const metrics = data.hedgedProxy.metrics;
  const budget = data.hedgedProxy.budget;

  // 1. P99 Values
  document.getElementById('stdP99Val').textContent = `${stdLat.p99.toFixed(1)} ms`;
  document.getElementById('hedgeP99Val').textContent = `${hedgeLat.p99.toFixed(1)} ms`;

  const badge = document.getElementById('p99SavingsBadge');
  if (stdLat.p99 > 0 && stdLat.p99 > hedgeLat.p99) {
    const savings = (((stdLat.p99 - hedgeLat.p99) / stdLat.p99) * 100).toFixed(0);
    badge.textContent = `${savings}% Faster`;
    badge.className = 'badge badge-success';
  } else {
    badge.textContent = '-- % Faster';
  }

  // 2. Budget & Overhead
  const total = data.hedgedProxy.totalRequests || 0;
  const hedgedCount = metrics.hedgedDispatched || 0;
  const overheadRatio = total > 0 ? (hedgedCount / total) * 100 : 0;

  document.getElementById('overheadPercentVal').textContent = `${overheadRatio.toFixed(1)}%`;
  document.getElementById('hedgedCountVal').textContent = hedgedCount;
  document.getElementById('totalReqVal').textContent = total;

  const budgetBar = document.getElementById('budgetProgressBar');
  const budgetPercent = Math.min(100, (overheadRatio / (budget.maxAllowedPercent || 8)) * 100);
  budgetBar.style.width = `${budgetPercent}%`;

  // 3. Speculative Wins & Aborts
  document.getElementById('hedgesWonVal').textContent = metrics.hedgesWon;
  document.getElementById('hedgeWinsBadge').textContent = `${metrics.hedgesWon} Rescued`;
  document.getElementById('abortedVal').textContent = metrics.abortedCount;

  // 4. Dynamic Hedge Cutoff
  document.getElementById('dynamicHedgeCutoff').textContent = `~${data.hedgedProxy.currentHedgeThresholdMs.toFixed(1)} ms (P90)`;

  // 5. Percentile Bar Chart Update
  if (percentileChart) {
    percentileChart.data.datasets[0].data = [stdLat.p50, stdLat.p90, stdLat.p95, stdLat.p99, stdLat.p999 || stdLat.p99];
    percentileChart.data.datasets[1].data = [hedgeLat.p50, hedgeLat.p90, hedgeLat.p95, hedgeLat.p99, hedgeLat.p999 || hedgeLat.p99];
    percentileChart.update('none');
  }

  // 6. Cluster Node Topology Stats
  const nodeStats = data.cluster.stats;
  if (nodeStats['node-a']) {
    document.getElementById('nodeAReqs').textContent = nodeStats['node-a'].requests;
    document.getElementById('nodeAStalls').textContent = nodeStats['node-a'].stragglers;
  }
  if (nodeStats['node-b']) {
    document.getElementById('nodeBReqs').textContent = nodeStats['node-b'].requests;
    document.getElementById('nodeBStalls').textContent = nodeStats['node-b'].stragglers;
  }
  if (nodeStats['node-c']) {
    document.getElementById('nodeCReqs').textContent = nodeStats['node-c'].requests;
    document.getElementById('nodeCStalls').textContent = nodeStats['node-c'].stragglers;
  }

  // 7. Auto Traffic Button State
  const btnTraffic = document.getElementById('btnToggleTraffic');
  const btnText = document.getElementById('btnTrafficText');
  if (data.autoTrafficActive) {
    btnTraffic.classList.remove('btn-primary');
    btnTraffic.classList.add('btn-chaos');
    btnText.textContent = 'Stop Auto Load';
  } else {
    btnTraffic.classList.remove('btn-chaos');
    btnTraffic.classList.add('btn-primary');
    btnText.textContent = 'Start Auto Load';
  }
}

// Append to telemetry event log
function appendLog(item) {
  const logStream = document.getElementById('logStream');
  const div = document.createElement('div');

  if (item.wasHedged && item.hedgeWon) {
    div.className = 'log-item rescued';
    div.innerHTML = `
      <span>⚡ <strong>SPECULATIVE RESCUE:</strong> Node ${item.winnerNode.toUpperCase()} won in ${item.hedgedLatency}ms</span>
      <span>Saved +${item.latencySavedMs}ms (Primary stalled)</span>
    `;
  } else if (item.standardLatency > 300) {
    div.className = 'log-item straggler-hit';
    div.innerHTML = `
      <span>🚨 <strong>BASELINE STALL:</strong> Standard took ${item.standardLatency}ms</span>
      <span>TailSquash finished in ${item.hedgedLatency}ms</span>
    `;
  } else {
    div.className = 'log-item';
    div.innerHTML = `
      <span>Req #${Math.floor(Math.random()*9000)+1000}: Std ${item.standardLatency}ms | Hedge ${item.hedgedLatency}ms</span>
      <span>Parity</span>
    `;
  }

  logStream.insertBefore(div, logStream.firstChild);
  if (logStream.children.length > 50) {
    logStream.removeChild(logStream.lastChild);
  }
}

// Connect to Server-Sent Events (SSE)
function setupSSE() {
  const evtSource = new EventSource('/api/stream');

  evtSource.addEventListener('request_pair', (e) => {
    const data = JSON.parse(e.data);
    addTimelinePoint(data.standardLatency, data.hedgedLatency);
    appendLog(data);
    fetchFullStatus();
  });

  evtSource.addEventListener('stats_reset', () => {
    timelineLabels = [];
    standardData = [];
    hedgedData = [];
    timelineChart.data.labels = [];
    timelineChart.data.datasets[0].data = [];
    timelineChart.data.datasets[1].data = [];
    timelineChart.update();
    fetchFullStatus();
  });
}

// Setup Event Listeners
function setupControls() {
  // Toggle Traffic
  document.getElementById('btnToggleTraffic').addEventListener('click', async () => {
    await fetch('/api/traffic/toggle', { method: 'POST' });
    fetchFullStatus();
  });

  // Burst 50
  document.getElementById('btnBurst').addEventListener('click', async () => {
    const btn = document.getElementById('btnBurst');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ In Flight...</span>';
    await fetch('/api/test/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 50, delayBetweenMs: 50 })
    });
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡ Burst 50 Req</span>';
    }, 2800);
  });

  // Single Step
  document.getElementById('btnSingle').addEventListener('click', async () => {
    await fetch('/api/test/single', { method: 'POST' });
  });

  // Reset Stats
  document.getElementById('btnReset').addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST' });
  });

  // Straggler Slider
  const slider = document.getElementById('stragglerSlider');
  const sliderDisplay = document.getElementById('stragglerRateDisplay');
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    sliderDisplay.textContent = `${val.toFixed(1)}%`;
  });
  slider.addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value) / 100;
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stragglerRate: val, targetedNodeStall: null })
    });
  });

  // Force 1000ms Stall
  document.getElementById('btnInjectStall').addEventListener('click', async () => {
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stragglerRate: 1.0, stragglerDelayMin: 1000, stragglerDelayMax: 1200 })
    });
    // Trigger 1 request to see the instant dramatic contrast
    await fetch('/api/test/single', { method: 'POST' });
    // Restore rate to 5% after 2 seconds
    setTimeout(async () => {
      await fetch('/api/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stragglerRate: 0.05, stragglerDelayMin: 600, stragglerDelayMax: 1100 })
      });
    }, 2000);
  });

  // Degrade Node Beta
  document.getElementById('btnDegradeNode').addEventListener('click', async () => {
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetedNodeStall: 'node-b' })
    });
    const cardB = document.getElementById('cardNodeB');
    cardB.style.borderColor = '#f43f5e';
    cardB.style.background = 'rgba(244, 63, 94, 0.15)';
  });

  // Reset Chaos
  document.getElementById('btnResetChaos').addEventListener('click', async () => {
    await fetch('/api/chaos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stragglerRate: 0.05, stragglerDelayMin: 600, stragglerDelayMax: 1100, targetedNodeStall: null })
    });
    slider.value = 5;
    sliderDisplay.textContent = '5.0%';
    const cardB = document.getElementById('cardNodeB');
    cardB.style.borderColor = 'rgba(255, 255, 255, 0.07)';
    cardB.style.background = 'rgba(255, 255, 255, 0.03)';
  });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  initCharts();
  setupSSE();
  setupControls();
  fetchFullStatus();
  setInterval(fetchFullStatus, 2000);
});
