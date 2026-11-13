package com.evgarct.moniq.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.data.Account

/** Stroke glyphs drawn on a 20 or 24 unit grid, exactly as the canvas specifies them. */
object Glyph {
    const val CALENDAR = "M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3.5 10h17M8 3v4M16 3v4" // 24
    const val EYE = "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM9.2 12a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0" // 24
    const val SLASH = "M4.5 4.5l15 15" // 24
    const val BACK = "M19 12H5M11 6l-6 6 6 6" // 24
    const val CLOSE = "M6 6l12 12M18 6L6 18" // 24
    const val PLUS = "M12 5v14M5 12h14" // 24
    const val SEND = "M12 19V5M6 11l6-6 6 6" // 24
    const val BACKSPACE = "M21 5.5H9l-6 6.5 6 6.5h12zM17 9.5l-5 5M12 9.5l5 5" // 24
    const val ARROW_RIGHT = "M4 12h16M14 6l6 6-6 6" // 24
    const val CHECK = "M5.5 13.5l5 5L21 8" // 26
    const val CHEVRON = "M7 4.5l4.5 4.5L7 13.5" // 18
    const val CHEVRON_DOWN = "M4.5 7l4.5 4.5L13.5 7" // 18
    const val REPEAT = "M3 7V6a2 2 0 0 1 2-2h7M10 2l2 2-2 2M13 9v1a2 2 0 0 1-2 2H4M6 14l-2-2 2-2" // 16

    // 20-unit row glyphs
    const val CASH = "M2.5 5.5h15v9h-15zM10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
    const val SAVINGS = "M4 9a6 5 0 0 1 12 0c0 2-1 3.5-2.5 4.5V16h-2v-1.5h-3V16h-2v-2.5C5 12.5 4 11 4 9zM13 8h.01"
    const val GOAL = "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
    const val CARD = "M2.5 5h15v10h-15zM2.5 8.5h15"
    const val BANK = "M3 8l7-5 7 5M4 8h12M5.5 8v7M10 8v7M14.5 8v7M3 17h14"
    const val TREND = "M3 14l4.5-4.5 3 3L17 6M13 6h4v4"
    const val TRANSFER = "M4 7h12M13 4l3 3-3 3M16 13H4M7 10l-3 3 3 3"
    const val DOT = "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z"
    const val PAID = "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM7 10.2l2 2 4-4.2"
    const val PLANNED = "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM10 6v4l2.5 2"
    const val SKIP = "M5 4l8 6-8 6zM15 4v12"
    const val RESCHEDULE = "M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3M13 3v3"
    const val EDIT = "M4 16l1-4 8.5-8.5 3 3L8 15zM12 5l3 3"
    const val PAUSE = "M7 4v12M13 4v12"
    const val PLAY = "M6 4l9 6-9 6z"
    const val DELETE = "M4 6h12M8 6V4h4v2M5.5 6l1 11h7l1-11"
    const val BELL = "M5 14V9a5 5 0 0 1 10 0v5l1.5 2h-13zM8.5 17.5a1.6 1.6 0 0 0 3 0"
    const val SIGN_OUT = "M8 4H4v12h4M12 7l3 3-3 3M15 10H7"
    const val SHIELD = "M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5z"
}

@Composable
fun PathIcon(
    path: String,
    modifier: Modifier = Modifier,
    size: Dp = 20.dp,
    viewport: Float = 20f,
    stroke: Dp = 1.5.dp,
    color: Color = LocalPalette.current.mute,
) {
    // "|" separates independent shapes, each parsed from its own origin.
    val parsed: Path = remember(path) {
        Path().apply {
            path.split('|').forEach { part -> runCatching { addPath(PathParser().parsePathString(part).toPath()) } }
        }
    }
    Canvas(modifier.size(size)) {
        val factor = this.size.minDimension / viewport
        scale(factor, factor, pivot = androidx.compose.ui.geometry.Offset.Zero) {
            drawPath(parsed, color, style = Stroke(width = stroke.toPx() / factor, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

/** A category's own icon: the lucide glyph the web app shows, an emoji token, or a neutral ring. */
@Composable
fun CategoryGlyph(icon: String?, modifier: Modifier = Modifier, size: Dp = 20.dp, color: Color = LocalPalette.current.mute) {
    val token = icon?.trim()?.lowercase().orEmpty()
    when {
        token == "@transfer" -> PathIcon(Glyph.TRANSFER, modifier, size, color = color)
        token == "@debt" -> PathIcon(Glyph.BANK, modifier, size, color = color)
        CategoryIconPaths.containsKey(token) -> PathIcon(CategoryIconPaths.getValue(token), modifier, size, viewport = 24f, color = color)
        token.isNotEmpty() && token.none { it.isLetterOrDigit() && it.code < 128 } ->
            Box(modifier.size(size), contentAlignment = Alignment.Center) { T(icon!!.trim(), sans(14), color = color, maxLines = 1) }
        else -> PathIcon(Glyph.DOT, modifier, size, color = color)
    }
}

fun accountGlyph(account: Account): String = when (account.type) {
    "saving" -> Glyph.SAVINGS
    "credit_card" -> Glyph.CARD
    "debt" -> Glyph.BANK
    "pension" -> Glyph.BANK
    else -> Glyph.CASH
}
