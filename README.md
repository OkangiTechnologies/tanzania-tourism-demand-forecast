# Comparative Analysis of RNN, LSTM and GRU for Tourism Demand Prediction

## Start here
Open **`interface/index.html`** by double-clicking it — no install, no server, no
internet connection required. It's a standalone dashboard covering the whole
project, including a **live forecasting tool that runs the actual trained
models in your browser**.

## Contents
- **`interface/`** — the interactive dashboard (see below).
- `tourism_rnn_lstm_gru.ipynb` — the full, pre-executed notebook (all 10 stages,
  real outputs and plots included, verified duplicate-free and error-free).
  Open it and "Run All" to reproduce everything, or just read it as-is.
- `train_df.csv`, `test_df.csv`, `submission.csv` — the original uploaded
  competition files.
- `daily_cleaned.csv` — the cleaned national daily tourism-demand series.
- `metrics.csv` — final MAE / RMSE / MAPE / R2 / training-time table.
- `future_forecast.csv` — the 14-day forward forecast from the best model.
- `models/` — the three saved trained models (`.keras` files).
- `*.png` — every chart generated in the notebook, saved individually.

## About the interface
`interface/index.html` is a hand-built dashboard — not Streamlit, not a
generic template — with five sections reachable from the sidebar:

- **Overview** — the headline result and the full national demand curve.
- **Explore the Data** — the six EDA charts from the notebook, with captions.
- **Compare Models** — the metrics table, per-metric bar charts, and an
  actual-vs-predicted overlay for the held-out test window.
- **Forecast Lab** — pick any combination of RNN / LSTM / GRU and a horizon
  (1–30 days), then run a **real recursive forecast**. This isn't a canned
  animation: the trained weights from the notebook were exported and a
  hand-written JavaScript implementation of the SimpleRNN / LSTM / GRU forward
  pass computes the forecast live in your browser. That JS implementation was
  numerically verified line-for-line against the original Python/Keras output
  before being wired into the UI (bit-exact match on the 14-day GRU forecast).
- **Conclusion** — the same result summary and reasoning as the notebook's
  final stage, generated dynamically from the actual metrics.

Everything (data, model weights, chart images) is embedded directly in the
JS/HTML files, so the whole thing works fully offline — no fetch requests,
no CDN dependencies, no CORS issues from opening it as a local file.

## Headline result
Based on the held-out chronological test set (never seen during training or
validation), **GRU was the best-performing model** on every metric (MAE,
RMSE, MAPE, R2), narrowly ahead of plain RNN, with LSTM performing worst on
this particular ~300-day dataset.

## What "tourism demand" means in this project
The raw data is panel data: daily arrivals for 432 individual tourist-site
combinations. This project aggregates that into a single **national daily
total** series (sum across all sites per day) and forecasts that. See Stage 1
of the notebook, or the Overview tab of the interface, for the full
explanation of this choice.

## Reproducing / re-running the notebook
The notebook is self-contained per stage (each stage reloads what it needs
from disk), so you can run it top-to-bottom in one go. It uses Python,
pandas, NumPy, Matplotlib, scikit-learn, statsmodels, and TensorFlow/Keras —
install those in your environment before running.
