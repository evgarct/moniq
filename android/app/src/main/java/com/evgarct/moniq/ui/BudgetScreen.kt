package com.evgarct.moniq.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.evgarct.moniq.data.EnvelopeForecast
import com.evgarct.moniq.data.Forecast
import com.evgarct.moniq.domain.caption
import com.evgarct.moniq.domain.chronosLine
import com.evgarct.moniq.domain.fill
import com.evgarct.moniq.domain.formatAmount
import com.evgarct.moniq.domain.isFor
import com.evgarct.moniq.domain.isOver
import com.evgarct.moniq.domain.monthName
import com.evgarct.moniq.domain.parseDate
import com.evgarct.moniq.domain.shortLabel
import com.evgarct.moniq.domain.suggestedQuestions
import kotlinx.coroutines.delay
import java.time.LocalDate
import kotlin.math.cos
import kotlin.math.round
import kotlin.math.sin

/**
 * Budget: one sentence from Chronos, the envelopes as rows like goals on Balance, and questions
 * Hermes can answer about them. The range of the forecast stays in words where it matters.
 */
@Composable
fun BudgetScreen(state: AppState) {
    val palette = LocalPalette.current
    val forecast by state.repo.forecast.collectAsStateWithLifecycle()
    val today = remember { LocalDate.now() }
    val current = forecast?.takeIf { it.isFor(today) }

    CompositionLocalProvider(LocalHideAmounts provides state.hideAmounts) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 150.dp)) {
            item(key = "top") {
                Column {
                    StatusBarSpacer()
                    Row(Modifier.fillMaxWidth().padding(top = 20.dp).height(44.dp), verticalAlignment = Alignment.CenterVertically) { BrandMark() }
                    Spacer(Modifier.height(36.dp))
                    Column(Modifier.rise()) {
                        T("Budget", serif(38, lineHeight = 1.04f, tracking = -.02f))
                        T("how ${today.monthName()} lands.", serif(38, italic = true, lineHeight = 1.04f, tracking = -.02f), color = palette.terra, maxLines = 1)
                    }
                }
            }

            item(key = "chronos") { ChronosReading(current, today, Modifier.padding(top = 40.dp).rise(100)) }

            if (current != null) {
                itemsIndexed(current.envelopes, key = { _, envelope -> envelope.categoryId }) { index, envelope ->
                    EnvelopeRow(envelope, index, Modifier.padding(top = if (index == 0) 40.dp else 24.dp).rise(200 + index * 100))
                }
                if (state.app.net.hermesConfigured) {
                    item(key = "ask") {
                        Column(Modifier.padding(top = 40.dp).rise(200 + current.envelopes.size * 100)) {
                            current.suggestedQuestions().forEach { question ->
                                Row(
                                    Modifier.fillMaxWidth().heightIn(min = 52.dp)
                                        .drawBehind { drawLine(palette.line, Offset.Zero, Offset(size.width, 0f), 1.dp.toPx()) }
                                        .tap(scale = .98f, label = question) {
                                            state.chatOpen = true
                                            state.askHermes(question)
                                        },
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    T(question, serif(19, lineHeight = 1.2f), Modifier.weight(1f).padding(vertical = 12.dp, horizontal = 0.dp))
                                    PathIcon(Glyph.CHEVRON, Modifier.padding(start = 12.dp), size = 18.dp, viewport = 18f, stroke = 1.6.dp, color = palette.terraInk)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ChronosReading(forecast: Forecast?, today: LocalDate, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        ChronosSigil(Modifier.padding(top = 3.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            val text = if (forecast == null) {
                buildAnnotatedString { append("No reading for ${today.monthName()} yet. Chronos looks at your spending every evening.") }
            } else {
                val line = forecast.chronosLine(today)
                buildAnnotatedString {
                    append(line.lead)
                    withStyle(SpanStyle(color = palette.terraInk)) { append(line.amount) }
                    append(line.tail)
                }
            }
            BasicText(text, style = serif(22, lineHeight = 1.3f).merge(androidx.compose.ui.text.TextStyle(color = palette.ink)))
            val read = forecast?.forecastDate?.let(::parseDate)?.shortLabel()
            T(if (read != null) "Chronos · $read" else "Chronos", sans(13), color = palette.mute, maxLines = 1)
        }
    }
}

/** Chronos's mark: a time ring with a terracotta dot going round it every 12 seconds. */
@Composable
fun ChronosSigil(modifier: Modifier = Modifier, size: Dp = 24.dp) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val turn by rememberInfiniteTransition(label = "chronos").animateFloat(
        initialValue = 0f, targetValue = if (reduce) 0f else 1f,
        animationSpec = infiniteRepeatable(tween(12_000, easing = LinearEasing), RepeatMode.Restart), label = "orbit",
    )
    Canvas(modifier.size(size).semantics { contentDescription = "Chronos" }) {
        val radius = this.size.minDimension * 9f / 24f
        val center = Offset(this.size.width / 2, this.size.height / 2)
        drawCircle(palette.mute, radius = radius, center = center, style = Stroke(1.25.dp.toPx()))
        drawCircle(palette.ink, radius = 1.6.dp.toPx(), center = center)
        val angle = (turn * 2 * Math.PI - Math.PI / 2).toFloat()
        drawCircle(palette.terra, radius = 2.6.dp.toPx(), center = Offset(center.x + radius * cos(angle), center.y + radius * sin(angle)))
    }
}

@Composable
private fun EnvelopeRow(envelope: EnvelopeForecast, index: Int, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val over = envelope.isOver()
    val grown = remember(envelope.categoryId) { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(envelope.categoryId) {
        if (!reduce) {
            delay(400L + index * 100L)
            grown.animateTo(1f, tween(Motion.COUNT, easing = Motion.Out))
        }
    }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            T(envelope.name, sans(17, 500), Modifier.weight(1f).padding(end = 12.dp).alignByBaseline(), maxLines = 1)
            Row(Modifier.alignByBaseline().amountVeil(), verticalAlignment = Alignment.Bottom) {
                T(formatAmount(round(envelope.p50)), sans(17, 500), Modifier.alignByBaseline(), maxLines = 1)
                T(" of ${formatAmount(round(envelope.budget))}", sans(12), Modifier.alignByBaseline(), palette.mute, maxLines = 1)
            }
        }
        Box(
            Modifier.fillMaxWidth().height(2.dp).background(palette.line).drawBehind {
                drawLine(if (over) palette.terra else palette.ink, Offset(0f, size.height / 2), Offset(size.width * envelope.fill() * grown.value, size.height / 2), size.height)
            },
        )
        T(envelope.caption(), sans(13), Modifier.amountVeil(), if (over) palette.terraInk else palette.mute, maxLines = 1)
    }
}
