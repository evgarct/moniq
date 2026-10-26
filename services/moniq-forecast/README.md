# moniq-forecast

Small FastAPI service that runs a Chronos time-series model zero-shot. It only does model math: series in, quantiles out. Budgets, categories and the database stay in Moniq. See `docs/spending-forecast.md` for the full flow.

## API

`GET /health` returns `{"status": "ok", "model": "...", "loaded": true}`. No token needed.

`POST /forecast` (header `Authorization: Bearer <FORECAST_API_TOKEN>`)

```json
{
  "horizon": 12,
  "quantiles": [0.1, 0.5, 0.9],
  "series": [{ "id": "cat_food", "start": "2026-05-01", "values": [0, 340.5, 0, 1200] }]
}
```

Returns `forecasts[].quantiles["0.1" | "0.5" | "0.9"]`, one value per horizon day, with `start` set to the day after the last observation. Negative forecasts are clamped to 0. All series go through the model in one batch. Limits: horizon 1 to 31, series length at most 730, unique non-empty ids. Without a valid token the answer is 401; if the service has no token configured it answers 503 rather than running open.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `FORECAST_API_TOKEN` | required | Bearer secret shared with the Moniq cron |
| `FORECAST_MODEL` | `amazon/chronos-bolt-small` | Hugging Face model id |
| `FORECAST_THREADS` | `2` | torch CPU threads |
| `HF_HOME` | `/models` in Docker | where weights are cached (a named volume) |

## Run locally

```powershell
py -3.12 -m venv .venv
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv\Scripts\pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest
$env:FORECAST_API_TOKEN = "dev-token"
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

The unit tests use a fake pipeline. To also exercise the real model (downloads the weights once): `$env:RUN_MODEL_TESTS = "1"; .venv\Scripts\python -m pytest`.

## Deploy on the Oracle VM

The VM is ARM64 (Ampere); the Dockerfile uses the torch CPU index, which ships linux/arm64 wheels, so build on the VM itself. Follow the same pattern as the Hub Gateway: its own Compose project, no published ports, Caddy reaches it over a dedicated network.

1. DNS: add an `A` record `forecast.safronov.dev` pointing at the VM.
2. Copy this folder to `/opt/moniq-forecast`, create `.env` from `.env.example` (root-only, `chmod 600`) with a long random `FORECAST_API_TOKEN`.
3. `docker network create moniq-forecast-edge`, then attach the existing Caddy container: `docker network connect moniq-forecast-edge <caddy-container>`. Re-run the connect if a Floppy update recreates Caddy.
4. Back up the Caddyfile, add the block below, run `caddy validate` inside the Caddy container, then `caddy reload`. Leave every Floppy route untouched.

```
forecast.safronov.dev {
	reverse_proxy moniq-forecast:8000
}
```

5. `docker compose up -d --build`. The first start downloads the weights into the `hf_cache` volume; later restarts reuse them.
6. Check `curl https://forecast.safronov.dev/health`, then time a real `/forecast` call (target: under 10 s for all categories).

Never run `docker compose down -v` here: it deletes the cached weights.

## Switching or updating the model

Set `FORECAST_MODEL` in `.env` and run `docker compose up -d`. The code targets the `BaseChronosPipeline.predict_quantiles` API, which `amazon/chronos-bolt-*` models implement. `autogluon/chronos-2-small` uses a different input shape in some `chronos-forecasting` releases; verify `/forecast` against the pytest real-model check before switching production. To pick up a new `chronos-forecasting` release, bump the pin in `requirements.txt` and rebuild.
