package com.evgarct.moniq.data

import org.json.JSONObject

/** One budget envelope of the latest Chronos run (`GET /api/finance/forecast`). */
data class EnvelopeForecast(
    val categoryId: String,
    val name: String,
    val icon: String?,
    val currency: String,
    val budget: Double,
    val spent: Double,
    val planned: Double,
    val p10: Double,
    val p50: Double,
    val p90: Double,
    val status: String, // over_likely | over | tight | ok
    val method: String, // chronos | baseline
)

data class Forecast(
    val month: String, // yyyy-MM-01
    val forecastDate: String, // yyyy-MM-dd, the day the cron read the ledger
    val envelopes: List<EnvelopeForecast>,
)

/** Null when the server has no forecast yet. Rows that fail to parse are dropped, not guessed. */
fun parseForecast(json: JSONObject): Forecast? {
    val month = json.optString("month").takeIf { it.isNotBlank() && it != "null" } ?: return null
    val forecastDate = json.optString("forecast_date").takeIf { it.isNotBlank() && it != "null" } ?: return null
    val rows = json.optJSONArray("forecasts") ?: return Forecast(month, forecastDate, emptyList())
    val envelopes = (0 until rows.length()).mapNotNull { index ->
        val row = rows.optJSONObject(index) ?: return@mapNotNull null
        runCatching {
            EnvelopeForecast(
                categoryId = row.getString("category_id"),
                name = row.optString("category_name"),
                icon = row.optString("category_icon").takeIf { it.isNotBlank() && it != "null" },
                currency = row.getString("currency"),
                budget = row.getDouble("budget"),
                spent = row.getDouble("spent_to_date"),
                planned = row.getDouble("planned_remaining"),
                p10 = row.getDouble("forecast_p10"),
                p50 = row.getDouble("forecast_p50"),
                p90 = row.getDouble("forecast_p90"),
                status = row.getString("status"),
                method = row.optString("method", "chronos"),
            )
        }.getOrNull()
    }
    return Forecast(month, forecastDate, envelopes)
}
