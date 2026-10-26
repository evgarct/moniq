from __future__ import annotations

import logging
import os
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request

from .forecaster import load_pipeline, run_forecast
from .schemas import ForecastRequest, ForecastResponse

logger = logging.getLogger("moniq-forecast")

DEFAULT_MODEL = "amazon/chronos-bolt-small"


def _model_name() -> str:
    return os.environ.get("FORECAST_MODEL", DEFAULT_MODEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tests inject a fake pipeline before startup; production loads the real model once.
    if getattr(app.state, "pipeline", None) is None:
        threads = int(os.environ.get("FORECAST_THREADS", "2"))
        logger.info("loading model %s with %d threads", _model_name(), threads)
        app.state.pipeline = load_pipeline(_model_name(), threads)
    yield


app = FastAPI(title="moniq-forecast", lifespan=lifespan)


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.environ.get("FORECAST_API_TOKEN", "")
    if not expected:
        # Fail closed: an unconfigured service must not accept anonymous traffic.
        raise HTTPException(status_code=503, detail="service token is not configured")
    prefix = "Bearer "
    provided = authorization[len(prefix):] if authorization and authorization.startswith(prefix) else ""
    if not secrets.compare_digest(provided.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health(request: Request) -> dict:
    return {
        "status": "ok",
        "model": _model_name(),
        "loaded": getattr(request.app.state, "pipeline", None) is not None,
    }


@app.post("/forecast", response_model=ForecastResponse, dependencies=[Depends(require_token)])
def forecast(payload: ForecastRequest, request: Request) -> ForecastResponse:
    forecasts = run_forecast(request.app.state.pipeline, payload)
    return ForecastResponse(model=_model_name(), forecasts=forecasts)
