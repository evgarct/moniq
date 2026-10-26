import os

import pytest

torch = pytest.importorskip("torch")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

TOKEN = "test-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


class FakePipeline:
    """Deterministic stand-in: forecasts the series mean, with a spread and a negative p10."""

    def predict_quantiles(self, inputs, prediction_length, quantile_levels):
        batch = []
        for series in inputs:
            mean = float(series.mean())
            per_day = [[mean + (q - 0.5) * 2 * mean - 5 * (q < 0.2) for q in quantile_levels]] * prediction_length
            batch.append(per_day)
        tensor = torch.tensor(batch, dtype=torch.float32)
        return tensor, tensor[..., 0]


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("FORECAST_API_TOKEN", TOKEN)
    app.state.pipeline = FakePipeline()
    with TestClient(app) as test_client:
        yield test_client
    app.state.pipeline = None


def body(**overrides):
    payload = {
        "horizon": 5,
        "quantiles": [0.1, 0.5, 0.9],
        "series": [{"id": "cat_food", "start": "2026-05-01", "values": [50.0] * 60}],
    }
    payload.update(overrides)
    return payload


def test_health_needs_no_token(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["loaded"] is True


def test_forecast_requires_token(client):
    assert client.post("/forecast", json=body()).status_code == 401
    assert client.post("/forecast", json=body(), headers={"Authorization": "Bearer nope"}).status_code == 401


def test_fails_closed_without_configured_token(client, monkeypatch):
    monkeypatch.delenv("FORECAST_API_TOKEN", raising=False)
    assert client.post("/forecast", json=body(), headers=AUTH).status_code == 503


def test_constant_series_median_is_close_and_nothing_negative(client):
    response = client.post("/forecast", json=body(), headers=AUTH)
    assert response.status_code == 200
    data = response.json()
    forecast = data["forecasts"][0]
    assert forecast["id"] == "cat_food"
    # 60 observations starting 2026-05-01 end on 2026-06-29, so the forecast starts the day after.
    assert forecast["start"] == "2026-06-30"
    assert len(forecast["quantiles"]["0.5"]) == 5
    assert all(abs(v - 50) < 1 for v in forecast["quantiles"]["0.5"])
    assert all(v >= 0 for values in forecast["quantiles"].values() for v in values)


def test_all_series_go_through_one_batch(client):
    calls = []
    original = app.state.pipeline.predict_quantiles

    def spy(inputs, prediction_length, quantile_levels):
        calls.append(len(inputs))
        return original(inputs, prediction_length, quantile_levels)

    app.state.pipeline.predict_quantiles = spy
    series = [
        {"id": "a", "start": "2026-05-01", "values": [10.0] * 40},
        {"id": "b", "start": "2026-06-01", "values": [0.0, 5.0] * 20},
    ]
    response = client.post("/forecast", json=body(series=series), headers=AUTH)
    assert response.status_code == 200
    assert calls == [2]
    assert [item["id"] for item in response.json()["forecasts"]] == ["a", "b"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"horizon": 0},
        {"horizon": 32},
        {"series": []},
        {"series": [{"id": "x", "start": "2026-05-01", "values": []}]},
        {"series": [{"id": "x", "start": "2026-05-01", "values": [1.0] * 731}]},
        {"series": [{"id": "x", "start": "2026-05-01", "values": [1.0]}] * 2},
        {"quantiles": [0.0, 0.5]},
    ],
)
def test_invalid_payload_is_rejected(client, overrides):
    assert client.post("/forecast", json=body(**overrides), headers=AUTH).status_code == 422


@pytest.mark.skipif(not os.environ.get("RUN_MODEL_TESTS"), reason="downloads the real model")
def test_real_model_constant_series(monkeypatch):
    monkeypatch.setenv("FORECAST_API_TOKEN", TOKEN)
    app.state.pipeline = None
    with TestClient(app) as test_client:
        response = test_client.post("/forecast", json=body(horizon=12), headers=AUTH)
    app.state.pipeline = None
    assert response.status_code == 200
    median = response.json()["forecasts"][0]["quantiles"]["0.5"]
    assert all(abs(v - 50) < 10 for v in median)
