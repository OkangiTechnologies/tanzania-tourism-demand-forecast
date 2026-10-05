// ---------------------------------------------------------------------------
// Minimal, dependency-free SVG chart helpers.
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function niceNum(v) {
  if (v >= 1000) return Math.round(v / 1000) + 'k';
  return Math.round(v);
}

// series = [{ name, color, values: [num], dashed?: bool }]
// xLabels = array of strings (same length as each series.values, or use xIndex sampling)
function drawLineChart(container, series, xLabels, opts = {}) {
  container.innerHTML = '';
  const width = opts.width || container.clientWidth || 800;
  const height = opts.height || 340;
  const padL = 56, padR = 20, padT = 20, padB = 44;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
  container.appendChild(svg);

  let allVals = [];
  series.forEach(s => allVals = allVals.concat(s.values.filter(v => v !== null && v !== undefined && !Number.isNaN(v))));
  let yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const dataMin = yMin;
  const pad = (yMax - yMin) * 0.08 || 1;
  yMin -= pad; yMax += pad;
  if (dataMin >= 0 && yMin < 0) yMin = 0; // arrivals can't be negative — don't imply they can

  const n = xLabels.length;
  const xAt = i => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // gridlines + y axis labels
  const gridSteps = 4;
  for (let g = 0; g <= gridSteps; g++) {
    const v = yMin + (g / gridSteps) * (yMax - yMin);
    const y = yAt(v);
    svg.appendChild(svgEl('line', {
      x1: padL, x2: width - padR, y1: y, y2: y,
      stroke: '#E1E5E2', 'stroke-width': 1,
    }));
    const t = svgEl('text', { x: padL - 8, y: y + 4, 'text-anchor': 'end', class: 'chart-axis-label' });
    t.textContent = niceNum(v);
    svg.appendChild(t);
  }

  // x axis labels (sparse)
  const maxTicks = Math.min(7, n);
  const tickEvery = Math.max(1, Math.floor(n / maxTicks));
  for (let i = 0; i < n; i += tickEvery) {
    const t = svgEl('text', { x: xAt(i), y: height - padB + 20, 'text-anchor': 'middle', class: 'chart-axis-label' });
    t.textContent = xLabels[i];
    svg.appendChild(t);
  }

  // reference vline (e.g. "today" marker)
  if (opts.vlineIndex !== undefined) {
    const x = xAt(opts.vlineIndex);
    svg.appendChild(svgEl('line', {
      x1: x, x2: x, y1: padT, y2: padT + plotH,
      stroke: '#9AA6AC', 'stroke-width': 1, 'stroke-dasharray': '3,3',
    }));
  }

  series.forEach(s => {
    let pathD = '';
    let segStarted = false;
    s.values.forEach((v, i) => {
      if (v === null || v === undefined || Number.isNaN(v)) { segStarted = false; return; }
      pathD += `${segStarted ? 'L' : 'M'} ${xAt(i)} ${yAt(v)} `;
      segStarted = true;
    });
    const path = svgEl('path', {
      d: pathD.trim(), fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.25,
    });
    if (s.dashed) path.setAttribute('stroke-dasharray', '6,4');
    svg.appendChild(path);

    if (s.showDots) {
      s.values.forEach((v, i) => {
        if (v === null || v === undefined || Number.isNaN(v)) return;
        const c = svgEl('circle', { cx: xAt(i), cy: yAt(v), r: 3, fill: s.color });
        const title = svgEl('title', {});
        title.textContent = `${xLabels[i]}: ${Math.round(v).toLocaleString()}`;
        c.appendChild(title);
        svg.appendChild(c);
      });
    }
  });

  // legend
  if (opts.legend !== false && series.length > 1) {
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    series.forEach(s => {
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.innerHTML = `<i style="background:${s.color}${s.dashed ? ';opacity:.55' : ''}"></i>${s.name}`;
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }
}

// categories = [labels], groups = [{name, color, values}]
function drawBarChart(container, categories, groups, opts = {}) {
  container.innerHTML = '';
  const width = opts.width || container.clientWidth || 260;
  const height = opts.height || 220;
  const padL = 44, padR = 14, padT = 16, padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
  container.appendChild(svg);

  let allVals = [];
  groups.forEach(g => allVals = allVals.concat(g.values));
  let yMax = Math.max(...allVals) * 1.15;
  let yMin = opts.startAtZero === false ? Math.min(...allVals) * 0.9 : 0;

  const yAt = v => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  for (let g = 0; g <= 3; g++) {
    const v = yMin + (g / 3) * (yMax - yMin);
    const y = yAt(v);
    svg.appendChild(svgEl('line', { x1: padL, x2: width - padR, y1: y, y2: y, stroke: '#E1E5E2', 'stroke-width': 1 }));
  }

  const n = categories.length;
  const groupW = plotW / n;
  const barW = groupW * 0.5;

  categories.forEach((cat, i) => {
    const g = groups[0];
    const v = g.values[i];
    const x = padL + i * groupW + (groupW - barW) / 2;
    const y = yAt(v);
    const rect = svgEl('rect', {
      x, y, width: barW, height: (padT + plotH) - y,
      fill: g.colors ? g.colors[i] : g.color, rx: 3,
    });
    svg.appendChild(rect);

    const valLabel = svgEl('text', {
      x: x + barW / 2, y: y - 6, 'text-anchor': 'middle', class: 'chart-bar-value',
    });
    valLabel.textContent = opts.valueFormat ? opts.valueFormat(v) : niceNum(v);
    svg.appendChild(valLabel);

    const catLabel = svgEl('text', {
      x: x + barW / 2, y: height - padB + 18, 'text-anchor': 'middle', class: 'chart-axis-label',
    });
    catLabel.textContent = cat;
    svg.appendChild(catLabel);
  });
}
