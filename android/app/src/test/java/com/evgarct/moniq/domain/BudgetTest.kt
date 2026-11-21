package com.evgarct.moniq.domain

import com.evgarct.moniq.data.EnvelopeForecast
import com.evgarct.moniq.data.Forecast
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class BudgetTest {
    /** Amounts are grouped with no-break spaces; compare with plain ones for readability. */
    private fun plain(text: String?) = text?.replace(NBSP, ' ')

    private fun envelope(
        name: String, budget: Double, p50: Double, p90: Double = p50, status: String = "ok",
        currency: String = "CZK", method: String = "chronos",
    ) = EnvelopeForecast(
        categoryId = name, name = name, icon = null, currency = currency, budget = budget, spent = 0.0, planned = 0.0,
        p10 = p50, p50 = p50, p90 = p90, status = status, method = method,
    )

    // The real reading from 20 Nov 2026.
    private val november = Forecast(
        month = "2026-11-01",
        forecastDate = "2026-11-20",
        envelopes = listOf(
            envelope("Enjoy Life", 49900.0, 58109.96, 72595.46, "over_likely"),
            envelope("Core Bills", 41500.0, 41069.45, 41185.46, "tight"),
            envelope("Living Costs", 9000.0, 7496.0, 16473.67, "ok"),
        ),
    )
    private val today = LocalDate.of(2026, 11, 21)

    @Test fun headlineAddsSameCurrencyAndNamesTheCause() {
        val line = november.chronosLine(today)
        assertEquals("9 days left. You will likely end ", line.lead)
        assertEquals("6 275 Kč over", plain(line.amount))
        assertEquals(", all of it in Enjoy Life.", line.tail)
    }

    @Test fun captionsFollowTheStatus() {
        assertEquals("8 210 Kč over", plain(november.envelopes[0].caption()))
        assertEquals("At the limit", plain(november.envelopes[1].caption()))
        assertEquals("1 504 Kč left, unless a big week comes", plain(november.envelopes[2].caption()))
    }

    @Test fun exactlyOnBudgetIsNotOver() {
        val onLine = envelope("Rent", 1000.0, 1000.004)
        assertFalse(onLine.isOver())
    }

    @Test fun neverAddsDifferentCurrencies() {
        val mixed = november.copy(envelopes = listOf(envelope("Trips", 500.0, 650.0, currency = "EUR"), envelope("Food", 9000.0, 8000.0)))
        val line = mixed.chronosLine(today)
        assertEquals("9 days left. Trips will likely end ", line.lead)
        assertEquals("150 € over", plain(line.amount))
    }

    @Test fun todayLineOnlyWhenSomethingRunsOver() {
        assertEquals("Enjoy Life ends ~8 210 Kč over.", plain(november.todayLine()))
        assertNull(november.copy(envelopes = november.envelopes.drop(1)).todayLine())
    }

    @Test fun questionsFollowTheForecast() {
        assertEquals(listOf("What can I hold back in Enjoy Life?", "How likely is Living Costs to run over?"), november.suggestedQuestions())
    }

    @Test fun forecastBelongsToItsMonth() {
        assertTrue(november.isFor(today))
        assertFalse(november.isFor(LocalDate.of(2026, 12, 1)))
    }
}
