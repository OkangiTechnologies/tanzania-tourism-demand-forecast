// ---------------------------------------------------------------------------
// App wiring
// ---------------------------------------------------------------------------

const MODEL_COLORS = { rnn: 'var(--rnn)', lstm: 'var(--lstm)', gru: 'var(--gru)' };
const MODEL_COLOR_HEX = { rnn: '#4C7EA8', lstm: '#C97A3D', gru: '#3F9C6D' };
const MODEL_LABELS = { rnn: 'RNN', lstm: 'LSTM', gru: 'GRU' };

function fmt(v, decimals = 0) {
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function metricsByModel() {
  const map = {};
  APP_DATA.metrics.forEach(row => { map[row.Model.toLowerCase()] = row; });
  return map;
}

// ---------------- Navigation ----------------
function initNav() {
  const items = document.querySelectorAll('.nav-item');
  items.forEach(btn => {
    btn.addEventListener('click', () => {
      items.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      window.dispatchEvent(new Event('resize')); // let charts relayout if needed
    });
  });
}

// ---------------- Overview ----------------
function renderOverview() {
  const M = metricsByModel();
  const best = APP_DATA.best_model.toLowerCase();
  const bestRow = M[best];

  document.getElementById('hero-stat').innerHTML = `
    <div class="num"><span class="accent">${MODEL_LABELS[best]}</span></div>
    <div class="label">best model · ${bestRow['MAPE (%)'].toFixed(1)}% MAPE on unseen days</div>
  `;

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="value">${MODEL_LABELS[best]}</div><div class="label">Winner by average rank across 4 metrics</div></div>
    <div class="stat-card"><div class="value">${bestRow['MAPE (%)'].toFixed(1)}%</div><div class="label">Mean absolute % error, held-out test</div></div>
    <div class="stat-card"><div class="value">${APP_DATA.daily.values.length}</div><div class="label">Daily observations (Aug 2018 – May 2019)</div></div>
    <div class="stat-card"><div class="value">${bestRow['Training Time (s)'].toFixed(0)}s</div><div class="label">Training time · ${bestRow['Epochs Run']} epochs</div></div>
  `;

  const dates = APP_DATA.daily.dates;
  const shortDates = dates.map(d => d.slice(0, 7));
  drawLineChart(document.getElementById('hero-chart'),
    [{ name: 'National daily demand', color: '#10293C', values: APP_DATA.daily.values, width: 1.75 }],
    shortDates, { height: 260, legend: false });
}

// ---------------- Explore ----------------
const EDA_CAPTIONS = [
  ['eda_trend', 'Trend & 7-day rolling average', 'Smooths day-to-day noise to reveal the underlying seasonal wave.'],
  ['eda_dow', 'Demand by day of week', 'Weekends consistently draw more visitors than midweek days.'],
  ['eda_monthly', 'Total monthly demand', 'A clear winter lull sits between two warmer-season peaks.'],
  ['eda_hist', 'Distribution of daily demand', 'Right-skewed, with a tail of high-demand weekend/holiday spikes.'],
  ['eda_decompose', 'Seasonal decomposition (period = 7)', 'Splits the series into trend, weekly seasonality, and residual noise.'],
  ['eda_acf_pacf', 'Autocorrelation (ACF / PACF)', 'The lag-7 pattern confirms weekly seasonality — why a 14-day window was chosen.'],
];

function renderExplore() {
  const gallery = document.getElementById('eda-gallery');
  gallery.innerHTML = EDA_CAPTIONS.map(([key, title, desc]) => `
    <div class="gallery-item">
      <img src="data:image/png;base64,${EDA_IMAGES[key]}" alt="${title}">
      <div class="gallery-caption"><h4>${title}</h4><p>${desc}</p></div>
    </div>
  `).join('');
}

// ---------------- Compare ----------------
function renderCompare() {
  const best = APP_DATA.best_model;
  const rows = APP_DATA.metrics;

  const thead = `<thead><tr>
    <th>Model</th><th>MAE</th><th>RMSE</th><th>MAPE</th><th>R²</th><th>Epochs</th><th>Train time</th>
  </tr></thead>`;
  const tbody = '<tbody>' + rows.map(r => {
    const isWinner = r.Model === best;
    return `<tr class="${isWinner ? 'winner' : ''}">
      <td>${r.Model}${isWinner ? '<span class="badge-win">best</span>' : ''}</td>
      <td>${fmt(r.MAE)}</td>
      <td>${fmt(r.RMSE)}</td>
      <td>${r['MAPE (%)'].toFixed(2)}%</td>
      <td>${r.R2.toFixed(3)}</td>
      <td>${r['Epochs Run']}</td>
      <td>${r['Training Time (s)'].toFixed(1)}s</td>
    </tr>`;
  }).join('') + '</tbody>';
  document.getElementById('metrics-table').innerHTML = thead + tbody;

  const cats = rows.map(r => r.Model);
  const colors = rows.map(r => MODEL_COLOR_HEX[r.Model.toLowerCase()]);
  const barSpecs = [
    ['MAE', r => r.MAE, v => fmt(v)],
    ['RMSE', r => r.RMSE, v => fmt(v)],
    ['MAPE (%)', r => r['MAPE (%)'], v => v.toFixed(1) + '%'],
    ['R²', r => r.R2, v => v.toFixed(2)],
  ];
  const barGrid = document.getElementById('bar-grid');
  barGrid.innerHTML = barSpecs.map(([label]) => `<div class="bar-card"><h4>${label}</h4><div class="bar-canvas"></div></div>`).join('');
  const cards = barGrid.querySelectorAll('.bar-canvas');
  barSpecs.forEach(([label, getter, formatter], i) => {
    drawBarChart(cards[i], cats, [{ colors, values: rows.map(getter) }],
      { height: 190, startAtZero: label !== 'R²', valueFormat: formatter });
  });

  const testDates = APP_DATA.test_dates.map(d => d.slice(5));
  const series = [
    { name: 'Actual', color: '#10293C', values: APP_DATA.test_actual, width: 2.5 },
    { name: 'RNN', color: MODEL_COLOR_HEX.rnn, values: APP_DATA.test_predictions.RNN, dashed: true },
    { name: 'LSTM', color: MODEL_COLOR_HEX.lstm, values: APP_DATA.test_predictions.LSTM, dashed: true },
    { name: 'GRU', color: MODEL_COLOR_HEX.gru, values: APP_DATA.test_predictions.GRU, dashed: true },
  ];
  drawLineChart(document.getElementById('actual-vs-pred-chart'), series, testDates, { height: 300 });
}

// ---------------- Forecast Lab ----------------
let activeModels = new Set(['gru']);

function renderModelChips() {
  const wrap = document.getElementById('model-chips');
  wrap.innerHTML = ['rnn', 'lstm', 'gru'].map(m =>
    `<button class="chip" data-model="${m}" data-active="${activeModels.has(m)}">${MODEL_LABELS[m]}</button>`
  ).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const m = chip.dataset.model;
      if (activeModels.has(m)) {
        if (activeModels.size > 1) activeModels.delete(m); // keep at least one selected
      } else {
        activeModels.add(m);
      }
      renderModelChips();
    });
  });
}

function runForecast() {
  const horizon = parseInt(document.getElementById('horizon-slider').value, 10);
  const daily = APP_DATA.daily;
  const tailN = 60;
  const histDates = daily.dates.slice(-tailN);
  const histValues = daily.values.slice(-tailN);
  const lastValue = histValues[histValues.length - 1];

  const futureDates = [];
  const lastDate = new Date(daily.dates[daily.dates.length - 1] + 'T00:00:00');
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    futureDates.push(d.toISOString().slice(0, 10));
  }

  const allDates = histDates.concat(futureDates).map(d => d.slice(5));
  const series = [{
    name: 'Observed (last 60 days)', color: '#10293C',
    values: histValues.concat(new Array(horizon).fill(null)), width: 2,
  }];

  const forecastsByModel = {};
  activeModels.forEach(m => {
    const fc = recursiveForecast(m, horizon);
    forecastsByModel[m] = fc;
    series.push({
      name: MODEL_LABELS[m] + ' forecast', color: MODEL_COLOR_HEX[m], dashed: true, showDots: true,
      values: new Array(tailN - 1).fill(null).concat([lastValue]).concat(fc),
    });
  });

  drawLineChart(document.getElementById('forecast-chart'), series, allDates,
    { height: 320, vlineIndex: tailN - 1 });

  const thead = `<thead><tr><th>Date</th>${[...activeModels].map(m => `<th>${MODEL_LABELS[m]}</th>`).join('')}</tr></thead>`;
  const tbody = '<tbody>' + futureDates.map((d, i) =>
    `<tr><td>${d}</td>${[...activeModels].map(m => `<td>${fmt(forecastsByModel[m][i])}</td>`).join('')}</tr>`
  ).join('') + '</tbody>';
  document.getElementById('forecast-table').innerHTML = thead + tbody;
}

function initForecastLab() {
  renderModelChips();
  const slider = document.getElementById('horizon-slider');
  const label = document.getElementById('horizon-value');
  slider.addEventListener('input', () => { label.textContent = slider.value + ' days'; });
  document.getElementById('run-forecast-btn').addEventListener('click', runForecast);
  runForecast(); // initial render with defaults
}

// ---------------- Conclusion ----------------
function renderConclusion() {
  const M = metricsByModel();
  const best = APP_DATA.best_model.toLowerCase();
  const others = ['rnn', 'lstm', 'gru'].filter(m => m !== best);
  const b = M[best];

  const summaryLine = `On the held-out chronological test set, <strong>${MODEL_LABELS[best]}</strong>
    achieved the best overall performance: MAE&nbsp;=&nbsp;${fmt(b.MAE)}, RMSE&nbsp;=&nbsp;${fmt(b.RMSE)},
    MAPE&nbsp;=&nbsp;${b['MAPE (%)'].toFixed(2)}%, R²&nbsp;=&nbsp;${b.R2.toFixed(3)}, trained in
    ${b['Training Time (s)'].toFixed(1)}s over ${b['Epochs Run']} epochs.`;

  const othersList = others.map(m => {
    const r = M[m];
    return `<li><strong>${MODEL_LABELS[m]}</strong>: MAE = ${fmt(r.MAE)}, RMSE = ${fmt(r.RMSE)},
      MAPE = ${r['MAPE (%)'].toFixed(2)}%, R² = ${r.R2.toFixed(3)}, trained in
      ${r['Training Time (s)'].toFixed(1)}s over ${r['Epochs Run']} epochs.</li>`;
  }).join('');

  document.getElementById('conclusion-content').innerHTML = `
    <h3>Result summary</h3>
    <p>${summaryLine}</p>
    <ul>${othersList}</ul>

    <h3>Why the winning model likely performed best</h3>
    <p>The three architectures only differ in their recurrent cell, so the gap comes down to how
    each handles the weekly seasonal pattern and longer trend found in the EDA. Simple RNN has no
    gating mechanism, so it struggles to retain information across the full 14-day window —
    gradients tend to vanish over more than a handful of steps. LSTM has the most gating
    machinery (input, forget, and output gates, plus a separate cell state) — powerful in
    principle, but also the most parameters to learn from only ~200 training samples, which can
    lead to slower, noisier convergence on a dataset this small. GRU merges the gating into fewer
    parameters while still controlling what information persists — a reasonable middle ground for
    a small, strongly seasonal dataset like this one.</p>

    <div class="caveat">This ranking is specific to this dataset's size (~300 daily points) and
    window length (14 days). On a longer, noisier, or multi-feature dataset, the ranking between
    LSTM and GRU can and often does flip — read this as "the winner won on this data," not as a
    universal claim about one architecture always beating the others.</div>

    <h3>Practical usefulness for the tourism sector</h3>
    <ul>
      <li><strong>Staffing & operations</strong> — schedule staff, guides, and transport capacity
        a week or two ahead instead of reacting after demand happens.</li>
      <li><strong>Infrastructure & crowd management</strong> — anticipate high-demand weekend
        days for proactive crowd control or extra facilities.</li>
      <li><strong>Marketing & pricing</strong> — target forecasted low-demand periods with
        promotions or dynamic pricing to smooth demand across the year.</li>
      <li><strong>Budget & policy planning</strong> — feed multi-week forecasts into seasonal
        budgeting and infrastructure investment decisions.</li>
    </ul>
  `;
}

// ---------------- Boot ----------------
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  renderOverview();
  renderExplore();
  renderCompare();
  initForecastLab();
  renderConclusion();
});
