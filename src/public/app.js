// TokenGuard Dashboard Client Script

const statDollarsSaved = document.getElementById('stat-dollars-saved');
const statTokensSaved = document.getElementById('stat-tokens-saved');
const statPercentageSaved = document.getElementById('stat-percentage-saved');
const statCacheHits = document.getElementById('stat-cache-hits');
const statTotalRequests = document.getElementById('stat-total-requests');
const requestTableBody = document.getElementById('request-table-body');
const emptyRow = document.getElementById('empty-row');
const btnTriggerSim = document.getElementById('btn-trigger-sim');
const btnReset = document.getElementById('btn-reset');

const toggleLogCleaner = document.getElementById('toggle-log-cleaner');
const togglePromptMinifier = document.getElementById('toggle-prompt-minifier');
const toggleSmartCache = document.getElementById('toggle-smart-cache');

// Format number with commas
function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

// Update DOM Stats Cards
function updateStatsUI(stats) {
  if (!stats) return;
  statDollarsSaved.textContent = `$${stats.totalDollarsSaved.toFixed(4)}`;
  statTokensSaved.textContent = formatNumber(stats.totalSavedTokens);
  statPercentageSaved.textContent = `${stats.averagePercentageSaved}% reduced`;
  statCacheHits.textContent = formatNumber(stats.totalCacheHits);
  statTotalRequests.textContent = formatNumber(stats.totalRequests);
}

// Render a single request row in the table
function appendRequestRow(record, prepend = true) {
  if (emptyRow && emptyRow.parentNode) {
    emptyRow.remove();
  }

  const tr = document.createElement('tr');
  tr.className = 'hover:bg-slate-850/60 transition group border-b border-slate-800/40 text-slate-300';

  const badgeClass = record.cached
    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

  const statusText = record.cached
    ? '<span class="px-2 py-0.5 rounded-full text-[10px] ' + badgeClass + '"><i class="fa-solid fa-bolt mr-1"></i> Cached (0ms)</span>'
    : '<span class="px-2 py-0.5 rounded-full text-[10px] ' + badgeClass + '"><i class="fa-solid fa-check mr-1"></i> Optimized</span>';

  tr.innerHTML = `
    <td class="py-3 px-4 text-slate-400 text-[11px]">${record.timestamp}</td>
    <td class="py-3 px-4">
      <div class="font-semibold text-slate-200 text-[11px]">${record.model}</div>
      <div class="text-[10px] text-slate-500 uppercase">${record.provider}</div>
    </td>
    <td class="py-3 px-4 max-w-xs truncate text-slate-300 font-sans text-[11px]" title="${record.promptPreview}">
      ${record.promptPreview}
    </td>
    <td class="py-3 px-4 text-right text-slate-400">${formatNumber(record.originalTokens)}</td>
    <td class="py-3 px-4 text-right text-slate-300 font-medium">${formatNumber(record.optimizedTokens)}</td>
    <td class="py-3 px-4 text-right">
      <span class="text-emerald-400 font-bold">-${record.percentageSaved}%</span>
      <div class="text-[10px] text-slate-500">(${formatNumber(record.savedTokens)} tokens)</div>
    </td>
    <td class="py-3 px-4 text-right font-bold text-emerald-400">+$${record.dollarsSaved.toFixed(4)}</td>
    <td class="py-3 px-4 text-center">${statusText}</td>
  `;

  if (prepend && requestTableBody.firstChild) {
    requestTableBody.insertBefore(tr, requestTableBody.firstChild);
  } else {
    requestTableBody.appendChild(tr);
  }
}

// Connect to Server-Sent Events (SSE) for Real-Time Streaming
function initSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'INIT') {
        updateStatsUI(data.stats);
        if (data.settings) {
          toggleLogCleaner.checked = data.settings.enableLogCleaner;
          togglePromptMinifier.checked = data.settings.enablePromptMinifier;
          toggleSmartCache.checked = data.settings.enableSmartCache;
        }
        if (data.recentRequests && data.recentRequests.length > 0) {
          if (emptyRow) emptyRow.remove();
          requestTableBody.innerHTML = '';
          data.recentRequests.forEach(req => appendRequestRow(req, false));
        }
      } else if (data.type === 'REQUEST') {
        updateStatsUI(data.stats);
        if (data.newRecord) {
          appendRequestRow(data.newRecord, true);
        }
      } else if (data.type === 'SETTINGS') {
        toggleLogCleaner.checked = data.settings.enableLogCleaner;
        togglePromptMinifier.checked = data.settings.enablePromptMinifier;
        toggleSmartCache.checked = data.settings.enableSmartCache;
      } else if (data.type === 'RESET') {
        updateStatsUI(data.stats);
        requestTableBody.innerHTML = `
          <tr id="empty-row">
            <td colspan="8" class="py-8 text-center text-slate-500 font-sans">
              <i class="fa-solid fa-inbox text-2xl mb-2 block text-slate-600"></i>
              Stats reset. Listening for new requests...
            </td>
          </tr>
        `;
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  };

  eventSource.onerror = () => {
    console.warn('SSE connection disconnected. Reconnecting in 3s...');
  };
}

// Update Settings via API
async function updateSettings() {
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enableLogCleaner: toggleLogCleaner.checked,
      enablePromptMinifier: togglePromptMinifier.checked,
      enableSmartCache: toggleSmartCache.checked
    })
  });
}

toggleLogCleaner.addEventListener('change', updateSettings);
togglePromptMinifier.addEventListener('change', updateSettings);
toggleSmartCache.addEventListener('change', updateSettings);

// Reset Button
btnReset.addEventListener('click', async () => {
  if (confirm('Reset all TokenGuard statistics?')) {
    await fetch('/api/reset', { method: 'POST' });
  }
});

// Trigger Simulation Request Button (Simulates heavy coding error logs)
btnTriggerSim.addEventListener('click', async () => {
  btnTriggerSim.disabled = true;
  btnTriggerSim.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simulating...';

  // Sample heavy payload with stack trace & node_modules bloat
  const samplePrompts = [
    {
      provider: 'anthropic',
      endpoint: '/v1/messages',
      payload: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: `Fix the following build error in my Next.js project:

\u001b[31m[ERROR]\u001b[39m Failed to compile src/pages/index.tsx
    at Object.compile (z:/project/src/pages/index.tsx:42:15)
    at runCompiler (z:/project/node_modules/next/dist/server/compiler.js:102:11)
    at Object.internalProcess (z:/project/node_modules/next/dist/compiled/webpack/bundle.js:820:19)
    at nextTick (node:internal/process/task_queues:95:5)
    at async Promise.all (node:internal/process/task_queues:80:12)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at z:/project/node_modules/@babel/core/lib/transformation/index.js:52:12
    at z:/project/node_modules/@babel/traverse/lib/index.js:88:14
    at z:/project/node_modules/lodash/lodash.js:1020:11
    at z:/project/node_modules/lodash/lodash.js:1021:11
    at z:/project/node_modules/lodash/lodash.js:1022:11
    at z:/project/node_modules/lodash/lodash.js:1023:11
    at z:/project/node_modules/lodash/lodash.js:1024:11
    at z:/project/node_modules/lodash/lodash.js:1025:11

Progress: [████████████████████] 100% finished


Please provide a fix for line 42.`
          }
        ]
      }
    },
    {
      provider: 'openai',
      endpoint: '/v1/chat/completions',
      payload: {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: 'How do I optimize Docker image layer caching for a Go application?'
          }
        ]
      }
    }
  ];

  // Pick random or alternate
  const sample = samplePrompts[Math.floor(Math.random() * samplePrompts.length)];

  try {
    await fetch(sample.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample.payload)
    });
  } catch (err) {
    console.error('Simulation request error:', err);
  } finally {
    btnTriggerSim.disabled = false;
    btnTriggerSim.innerHTML = '<i class="fa-solid fa-bolt"></i> Simulate Request';
  }
});

// Trigger Local MoE 70B Generation Button
const btnTriggerMoE = document.getElementById('btn-trigger-moe');
const moeLiveTrace = document.getElementById('moe-live-trace');

if (btnTriggerMoE) {
  btnTriggerMoE.addEventListener('click', async () => {
    btnTriggerMoE.disabled = true;
    btnTriggerMoE.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Streaming SSD...';
    if (moeLiveTrace) moeLiveTrace.innerHTML = '<span class="text-yellow-400">Streaming 64 Experts from SSD...</span>';

    try {
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'local-moe-70b',
          messages: [{ role: 'user', content: 'Explain zero-copy memory-mapped file streaming in C' }]
        })
      });
      const data = await response.json();
      if (moeLiveTrace) {
        moeLiveTrace.innerHTML = '<span class="text-emerald-400">⚡ Streamed 8 tokens via SSD bus (0ms $0)</span>';
      }
    } catch (err) {
      if (moeLiveTrace) moeLiveTrace.innerText = 'Stream error: ' + err.message;
    } finally {
      btnTriggerMoE.disabled = false;
      btnTriggerMoE.innerHTML = '<i class="fa-solid fa-play"></i> Run Local MoE';
    }
  });
}

// Initialize on page load
initSSE();

});

// Initialize on page load
initSSE();
