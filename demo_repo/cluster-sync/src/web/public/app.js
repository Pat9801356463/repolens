// SyncMesh Frontend Controller

let currentNodeCount = 100;
let nodeElements = [];

// Initialize Node Matrix Grid
function renderNodeGrid(count) {
  currentNodeCount = count;
  document.getElementById('activeNodeCount').textContent = count;
  const grid = document.getElementById('nodesGrid');
  grid.innerHTML = '';
  nodeElements = [];

  // Adjust grid columns based on count
  if (count <= 16) {
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
  } else if (count <= 50) {
    grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
  } else {
    grid.style.gridTemplateColumns = 'repeat(10, 1fr)';
  }

  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'node-cell';
    cell.id = `node-${i}`;

    const numStr = i.toString().padStart(3, '0');
    cell.innerHTML = `<span>N${numStr}</span>`;

    if (i === 0) {
      cell.classList.add('source');
    }

    grid.appendChild(cell);
    nodeElements.push(cell);
  }
}

// Fetch Full Cluster State
async function fetchState() {
  try {
    const res = await fetch('/api/state');
    const data = await res.json();
    updateUIFromState(data);
  } catch (err) {
    console.error('Failed to fetch cluster state:', err);
  }
}

function updateUIFromState(data) {
  if (data.nodeCount !== currentNodeCount) {
    renderNodeGrid(data.nodeCount);
  }

  let syncedCount = 0;
  for (let i = 0; i < data.nodes.length; i++) {
    const n = data.nodes[i];
    const el = nodeElements[i];
    if (!el) continue;

    el.className = 'node-cell';
    if (i === 0) {
      el.classList.add('source');
      syncedCount++;
    } else if (n.status === 'synced') {
      el.classList.add('synced');
      syncedCount++;
    } else if (n.status === 'syncing') {
      el.classList.add('syncing');
    }
  }

  // Update Convergence Meter
  document.getElementById('nodesSyncedVal').textContent = `${syncedCount} / ${data.nodeCount}`;
  const pct = ((syncedCount / data.nodeCount) * 100).toFixed(0);
  document.getElementById('syncProgressBar').style.width = `${pct}%`;
  document.getElementById('convergenceBadge').textContent = `${pct}% Converged`;

  if (data.activeFile) {
    document.getElementById('metaFilename').textContent = data.activeFilename;
    document.getElementById('metaChunks').textContent = `${data.activeFile.chunkCount} chunks (32 KB each)`;
    const snippet = data.activeFile.manifest.rootHash.substring(0, 8) + '...' + data.activeFile.manifest.rootHash.substring(56);
    document.getElementById('merkleHashSnippet').textContent = snippet;
  }
}

// Append to Log Feed
function appendLog(text, className = '') {
  const stream = document.getElementById('logStream');
  const div = document.createElement('div');
  div.className = `log-item ${className}`;
  div.innerHTML = `<span>${text}</span><span>${new Date().toLocaleTimeString()}</span>`;
  stream.insertBefore(div, stream.firstChild);

  if (stream.children.length > 50) {
    stream.removeChild(stream.lastChild);
  }
}

// Setup Server-Sent Events (SSE)
function setupSSE() {
  const evtSource = new EventSource('/api/stream');

  evtSource.addEventListener('chunk_transfer', (e) => {
    const evt = JSON.parse(e.data);
    const targetCell = nodeElements[evt.to];
    if (targetCell && evt.to !== 0) {
      targetCell.classList.remove('idle');
      targetCell.classList.add('synced');
    }
    appendLog(`📡 Chunk #${evt.chunkIndex} relayed: Node ${evt.from} ➔ Node ${evt.to} [${evt.chunkSize / 1024} KB]`, 'transfer');
  });

  evtSource.addEventListener('sync_started', () => {
    for (let i = 1; i < nodeElements.length; i++) {
      nodeElements[i].className = 'node-cell syncing';
    }
    appendLog('🚀 Sync initiated. Pipelining chunks through P2P distribution tree...');
  });

  evtSource.addEventListener('sync_completed', (e) => {
    const res = JSON.parse(e.data);
    for (let i = 1; i < nodeElements.length; i++) {
      nodeElements[i].className = 'node-cell synced';
    }
    appendLog(`✅ Sync Complete across all ${res.nodeCount} nodes! Virtual time: ${res.virtualTimeMs}ms`, 'transfer');
    fetchState();
  });

  evtSource.addEventListener('delta_synced', (e) => {
    const data = JSON.parse(e.data);
    appendLog(`⚡ Merkle Delta Synced! Only ${data.deltaDiff.missingChunkIndices.length} changed chunk(s) transmitted across cluster.`, 'delta');
    fetchState();
  });

  evtSource.addEventListener('cluster_reset', () => {
    renderNodeGrid(currentNodeCount);
    appendLog('↺ Cluster state reset.');
    fetchState();
  });
}

// Setup UI Buttons
function setupControls() {
  // P2P Tree Sync Button
  document.getElementById('btnP2PSync').addEventListener('click', async () => {
    const btn = document.getElementById('btnP2PSync');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Pipelining...</span>';
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'P2P_MESH_TREE' })
    });
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">🚀</span><span>Sync P2P Tree ($O(\\log N)$)</span>';
    }, 1200);
  });

  // Delta Sync Button
  document.getElementById('btnDeltaSync').addEventListener('click', async () => {
    const btn = document.getElementById('btnDeltaSync');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Delta Syncing...</span>';
    await fetch('/api/delta', { method: 'POST' });
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡ Delta Sync (1 Chunk)</span>';
    }, 1000);
  });

  // Compare Button
  document.getElementById('btnCompare').addEventListener('click', async () => {
    const res = await fetch('/api/compare', { method: 'POST' });
    const comp = await res.json();
    document.getElementById('starEgressVal').textContent = `${(comp.centralized.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB`;
    document.getElementById('p2pEgressVal').textContent = `${(comp.p2p.masterEgressBytes / (1024 * 1024)).toFixed(1)} MB`;
    document.getElementById('egressSavedBadge').textContent = `${comp.egressSavingsPercent}% Saved`;
    document.getElementById('speedupVal').textContent = `${comp.speedupFactor}x`;
    document.getElementById('speedupBadge').textContent = `${comp.speedupFactor}x Faster`;
    appendLog(`⚖️ Comparison Run: P2P saved ${comp.egressSavingsPercent}% master bandwidth and finished ${comp.speedupFactor}x faster!`);
  });

  // Reset Button
  document.getElementById('btnReset').addEventListener('click', async () => {
    await fetch('/api/reset', { method: 'POST' });
  });

  // Scale Buttons
  const scaleBtns = document.querySelectorAll('.scale-btn');
  scaleBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
      scaleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const count = parseInt(btn.getAttribute('data-scale'), 10);
      await fetch('/api/scale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeCount: count })
      });
      fetchState();
    });
  });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  renderNodeGrid(100);
  setupSSE();
  setupControls();
  fetchState();
});
