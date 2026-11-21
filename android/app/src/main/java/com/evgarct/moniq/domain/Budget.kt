package com.evgarct.moniq.domain

import com.evgarct.moniq.data.EnvelopeForecast
import com.evgarct.moniq.data.Forecast
import java.time.LocalDate

/**
 * Plain-language reading of a Chronos forecast. The screen shows the median (p50) against the
 * budget; the p10..p90 range only turns into words where it changes the story. Money is compared
 * after rounding to cents, and amounts in different currencies are never added together.
 */

/** Forecasts are estimates: shown in whole units, unlike ledger amounts which keep their cents. */
fun estimate(value: Double, currency: String): String = formatMoney(kotlin.math.round(value), currency)

fun Forecast.isFor(today: LocalDate): Boolean = month == today.withDayOfMonth(1).iso()

fun EnvelopeForecast.over(): Double = roundMoney(p50 - budget)

fun EnvelopeForecast.isOver(): Boolean = roundMoney(p50) > roundMoney(budget)

/** Over budget only in a heavy-spending case: the median fits, the high end does not. */
fun EnvelopeForecast.isRisky(): Boolean = !isOver() && method == "chronos" && roundMoney(p90) > roundMoney(budget)

/** Share of the budget the median uses, for the progress line (1 = the whole budget). */
fun EnvelopeForecast.fill(): Float = if (budget <= 0) 1f else (p50 / budget).toFloat().coerceIn(0f, 1f)

fun EnvelopeForecast.caption(): String {
    val pace = if (method == "baseline") " · by pace" else ""
    return when {
        isOver() -> "${estimate(over(), currency)} over$pace"
        status == "tight" -> "At the limit$pace"
        isRisky() -> "${estimate(budget - p50, currency)} left, unless a big week comes"
        else -> "${estimate(budget - p50, currency)} left$pace"
    }
}

/** The single Today line; null when nothing is expected to run over. */
fun Forecast.todayLine(): String? {
    val worst = envelopes.filter { it.isOver() }.maxByOrNull { it.over() / it.budget.coerceAtLeast(1.0) } ?: return null
    return "${worst.name} ends ~${estimate(worst.over(), worst.currency)} over."
}

fun daysLeft(today: LocalDate): Int = today.lengthOfMonth() - today.dayOfMonth

/**
 * Chronos's one sentence, split so the screen can tint the amount. `lead` comes first, `amount`
 * is the tinted phrase (may be empty), `tail` finishes the sentence.
 */
data class ChronosLine(val lead: String, val amount: String, val tail: String)

fun Forecast.chronosLine(today: LocalDate): ChronosLine {
    val left = daysLeft(today)
    val opening = when (left) {
        0 -> "Last day of the month."
        1 -> "One day left."
        else -> "$left days left."
    }
    val over = envelopes.filter { it.isOver() }
    if (over.isEmpty()) {
        val risky = envelopes.firstOrNull { it.isRisky() }
        return if (risky != null) ChronosLine("$opening Every budget should hold, ", "", "though ${risky.name} could tip over in a big week.")
        else ChronosLine("$opening Every budget should hold.", "", "")
    }
    val currencies = envelopes.map { it.currency }.distinct()
    if (currencies.size == 1) {
        val currency = currencies.first()
        val total = roundMoney(envelopes.sumOf { it.p50 } - envelopes.sumOf { it.budget })
        val biggest = over.maxBy { it.over() }
        if (total > 0) {
            val share = if (over.size == 1 && biggest.over() >= total) "all of it in ${biggest.name}." else "most of it in ${biggest.name}."
            return ChronosLine("$opening You will likely end ", "${estimate(total, currency)} over", ", $share")
        }
        return ChronosLine("$opening Overall you stay within plan, but ", "${biggest.name} runs over", ".")
    }
    // Several currencies: name the envelope instead of adding money that cannot be added.
    val biggest = over.maxBy { it.over() / it.budget.coerceAtLeast(1.0) }
    return ChronosLine("$opening ${biggest.name} will likely end ", "${estimate(biggest.over(), biggest.currency)} over", ".")
}

/** Questions for Hermes that follow from what the forecast says. */
fun Forecast.suggestedQuestions(): List<String> {
    val over = envelopes.filter { it.isOver() }.maxByOrNull { it.over() }
    val risky = envelopes.firstOrNull { it.isRisky() }
    return buildList {
        if (over != null) add("What can I hold back in ${over.name}?")
        add(if (risky != null) "How likely is ${risky.name} to run over?" else "How sure is Chronos about this?")
    }
}
