// ---------------------------------------------------------------------------
// Inference engine: hand-implemented forward pass for SimpleRNN / LSTM / GRU,
// numerically verified against the real trained Keras models (see project
// notebook, Stage 5/9). No ML library needed in the browser — just the exact
// linear-algebra Keras itself performs, run on the real trained weights.
// ---------------------------------------------------------------------------

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// vec (n) @ mat (n x m) -> vec (m)
function vecMatMul(vec, mat) {
  const n = vec.length, m = mat[0].length;
  const out = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += vec[i] * mat[i][j];
    out[j] = s;
  }
  return out;
}

function addVec(a, b) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + b[i];
  return out;
}

// ---- Simple RNN cell step: h_t = tanh(x_t.W + h_{t-1}.U + b) ----
function stepRNN(xScalar, h, W) {
  const xVec = [xScalar];
  const z = addVec(addVec(vecMatMul(xVec, W.kernel), vecMatMul(h, W.recurrent_kernel)), W.bias);
  const hNew = new Float64Array(z.length);
  for (let i = 0; i < z.length; i++) hNew[i] = Math.tanh(z[i]);
  return hNew;
}

// ---- LSTM cell step (Keras gate order i,f,c,o) ----
function stepLSTM(xScalar, state, W) {
  const { h, c } = state;
  const units = W.units;
  const xVec = [xScalar];
  const z = addVec(addVec(vecMatMul(xVec, W.kernel), vecMatMul(h, W.recurrent_kernel)), W.bias);
  const i = new Float64Array(units), f = new Float64Array(units),
        cTilde = new Float64Array(units), o = new Float64Array(units);
  for (let k = 0; k < units; k++) {
    i[k] = sigmoid(z[k]);
    f[k] = sigmoid(z[units + k]);
    cTilde[k] = Math.tanh(z[2 * units + k]);
    o[k] = sigmoid(z[3 * units + k]);
  }
  const cNew = new Float64Array(units), hNew = new Float64Array(units);
  for (let k = 0; k < units; k++) {
    cNew[k] = f[k] * c[k] + i[k] * cTilde[k];
    hNew[k] = o[k] * Math.tanh(cNew[k]);
  }
  return { h: hNew, c: cNew };
}

// ---- GRU cell step (Keras reset_after=True, gate order z,r,h) ----
function stepGRU(xScalar, h, W) {
  const units = W.units;
  const xVec = [xScalar];
  // bias is shape (2, 3*units): [input_bias, recurrent_bias]
  const inputBias = W.bias[0], recurrentBias = W.bias[1];
  const matrixX = addVec(vecMatMul(xVec, W.kernel), inputBias);
  const matrixInner = addVec(vecMatMul(h, W.recurrent_kernel), recurrentBias);

  const hNew = new Float64Array(units);
  for (let k = 0; k < units; k++) {
    const xz = matrixX[k], xr = matrixX[units + k], xh = matrixX[2 * units + k];
    const rz = matrixInner[k], rr = matrixInner[units + k], rh = matrixInner[2 * units + k];
    const z = sigmoid(xz + rz);
    const r = sigmoid(xr + rr);
    const hh = Math.tanh(xh + r * rh);
    hNew[k] = z * h[k] + (1 - z) * hh;
  }
  return hNew;
}

// Dense output layer: y = h . W + b
function denseOut(h, denseKernel, denseBias) {
  let s = denseBias[0];
  for (let i = 0; i < h.length; i++) s += h[i] * denseKernel[i][0];
  return s;
}

// Run a model over a window of scaled inputs, return the next scaled prediction.
function predictNextScaled(modelKey, scaledWindow) {
  const W = APP_DATA.models[modelKey];
  const units = W.units;

  if (modelKey === 'rnn') {
    let h = new Float64Array(units);
    for (const x of scaledWindow) h = stepRNN(x, h, W);
    return denseOut(h, W.dense_kernel, W.dense_bias);
  }
  if (modelKey === 'lstm') {
    let state = { h: new Float64Array(units), c: new Float64Array(units) };
    for (const x of scaledWindow) state = stepLSTM(x, state, W);
    return denseOut(state.h, W.dense_kernel, W.dense_bias);
  }
  if (modelKey === 'gru') {
    let h = new Float64Array(units);
    for (const x of scaledWindow) h = stepGRU(x, h, W);
    return denseOut(h, W.dense_kernel, W.dense_bias);
  }
  throw new Error('Unknown model: ' + modelKey);
}

function scaleValue(v) {
  return (v - APP_DATA.data_min) / (APP_DATA.data_max - APP_DATA.data_min);
}
function unscaleValue(v) {
  return v * (APP_DATA.data_max - APP_DATA.data_min) + APP_DATA.data_min;
}

// Recursive multi-step forecast, identical logic to notebook Stage 9.
function recursiveForecast(modelKey, horizonDays) {
  const window = APP_DATA.window;
  const rawValues = APP_DATA.daily.values;
  let scaledWindow = rawValues.slice(-window).map(scaleValue);

  const forecastScaled = [];
  for (let step = 0; step < horizonDays; step++) {
    const nextScaled = predictNextScaled(modelKey, scaledWindow);
    forecastScaled.push(nextScaled);
    scaledWindow = scaledWindow.slice(1).concat([nextScaled]);
  }
  return forecastScaled.map(unscaleValue);
}
