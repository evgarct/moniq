from __future__ import annotations

from datetime import timedelta
from typing import Protocol

from .schemas import ForecastRequest, SeriesForecast


class QuantilePipeline(Protocol):
    """The slice of chronos-forecasting's pipeline API the service relies on."""

    def predict_quantiles(self, inputs, prediction_length, quantile_levels):  # noqa: ANN001
        ...


def load_pipeline(model_name: str, threads: int) -> QuantilePipeline:
    # Imported lazily so unit tests with a fake pipeline do not need torch.
    import torch
    from chronos import BaseChronosPipeline

    torch.set_num_threads(threads)
    return BaseChronosPipeline.from_pretrained(
        model_name,
        device_map="cpu",
        torch_dtype=torch.float32,
    )


def run_forecast(pipeline: QuantilePipeline, request: ForecastRequest) -> list[SeriesForecast]:
    import torch

    # One batch for every series; chronos pads ragged contexts itself.
    context = [torch.tensor(item.values, dtype=torch.float32) for item in request.series]
    # Positional: chronos-forecasting 1.x names this argument `context`, 2.x names it `inputs`.
    quantile_tensor, _mean = pipeline.predict_quantiles(
        context,
        prediction_length=request.horizon,
        quantile_levels=request.quantiles,
    )
    # Shape: (series, horizon, quantiles). Spend cannot be negative.
    quantile_values = quantile_tensor.clamp(min=0).tolist()

    forecasts: list[SeriesForecast] = []
    for item, per_series in zip(request.series, quantile_values, strict=True):
        per_quantile = {
            # repr round-trips a float exactly ("0.5", "0.5000001"), so close levels never share a key.
            repr(q): [float(day[index]) for day in per_series]
            for index, q in enumerate(request.quantiles)
        }
        forecasts.append(
            SeriesForecast(
                id=item.id,
                # The forecast begins on the day after the last observation.
                start=item.start + timedelta(days=len(item.values)),
                quantiles=per_quantile,
            )
        )
    return forecasts
