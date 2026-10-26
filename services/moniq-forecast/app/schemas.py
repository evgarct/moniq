from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator

MAX_SERIES_LENGTH = 730
MAX_HORIZON = 31
MAX_SERIES = 200


class Series(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    start: date
    values: list[float] = Field(min_length=1, max_length=MAX_SERIES_LENGTH)

    @field_validator("values")
    @classmethod
    def values_must_be_finite(cls, values: list[float]) -> list[float]:
        for value in values:
            if value != value or value in (float("inf"), float("-inf")):
                raise ValueError("series values must be finite numbers")
        return values


class ForecastRequest(BaseModel):
    horizon: int = Field(ge=1, le=MAX_HORIZON)
    quantiles: list[float] = Field(default=[0.1, 0.5, 0.9], min_length=1, max_length=9)
    series: list[Series] = Field(min_length=1, max_length=MAX_SERIES)

    @field_validator("quantiles")
    @classmethod
    def quantiles_in_range(cls, quantiles: list[float]) -> list[float]:
        for q in quantiles:
            if not 0.0 < q < 1.0:
                raise ValueError("quantiles must be strictly between 0 and 1")
        return sorted(set(quantiles))

    @field_validator("series")
    @classmethod
    def series_ids_unique(cls, series: list[Series]) -> list[Series]:
        ids = [item.id for item in series]
        if len(ids) != len(set(ids)):
            raise ValueError("series ids must be unique")
        return series


class SeriesForecast(BaseModel):
    id: str
    start: date
    quantiles: dict[str, list[float]]


class ForecastResponse(BaseModel):
    model: str
    forecasts: list[SeriesForecast]
