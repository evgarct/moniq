package com.evgarct.moniq.ui

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.evgarct.moniq.R

/** Design tokens from the Moniq Android v1 canvas. Dark is its own set, not an inversion. */
@Immutable
data class Palette(
    val bg: Color,
    val ink: Color,
    val mute: Color,
    val line: Color,
    val panel: Color,
    val stone: Color,
    val terra: Color,
    val terraInk: Color,
    val bar: Color,
    val barInk: Color,
    val barHi: Color,
    val sheet: Color,
    val dark: Boolean,
)

val LightPalette = Palette(
    bg = Color(0xFFF5F6F4), ink = Color(0xFF191919), mute = Color(0xFF6A6964), line = Color(0x24191919),
    panel = Color(0xFFEAEAE5), stone = Color(0xFFE8DED3), terra = Color(0xFFCC785C), terraInk = Color(0xFFA8553A),
    bar = Color(0xFF191919), barInk = Color(0xFFF5F6F4), barHi = Color(0x29F5F6F4), sheet = Color(0xFFFBFBF9), dark = false,
)

val DarkPalette = Palette(
    bg = Color(0xFF141413), ink = Color(0xFFF1F0EC), mute = Color(0xFFA6A49D), line = Color(0x29F5F6F4),
    panel = Color(0xFF222220), stone = Color(0xFF2B2925), terra = Color(0xFFD98B6F), terraInk = Color(0xFFE3A088),
    bar = Color(0xFFF1F0EC), barInk = Color(0xFF191919), barHi = Color(0x1F191919), sheet = Color(0xFF1C1C1A), dark = true,
)

/** The chat and the login are always on the dark canvas, whatever the system theme. */
object Night {
    val bg = Color(0xFF141413)
    val ink = Color(0xFFF5F6F4)
    val mute = Color(0xFFB5B3AC)
    val line = Color(0x29F5F6F4)
    val field = Color(0x1AF5F6F4)
    val terra = Color(0xFFCC785C)
    val terraSoft = Color(0xFFD98B6F)
    val stone = Color(0xFFE8DED3)
}

val LocalPalette = staticCompositionLocalOf { LightPalette }

private fun inter(weight: Int) = Font(
    R.font.inter, FontWeight(weight), FontStyle.Normal,
    variationSettings = FontVariation.Settings(FontVariation.weight(weight), FontVariation.Setting("opsz", 16f)),
)

val Sans = FontFamily(inter(400), inter(500), inter(600))

val Serif = FontFamily(
    Font(R.font.newsreader, FontWeight.Normal, FontStyle.Normal, variationSettings = FontVariation.Settings(FontVariation.weight(400), FontVariation.Setting("opsz", 36f))),
    Font(R.font.newsreader_italic, FontWeight.Normal, FontStyle.Italic, variationSettings = FontVariation.Settings(FontVariation.weight(400), FontVariation.Setting("opsz", 36f))),
)

private const val NUMERALS = "lnum, tnum"

fun sans(size: Int, weight: Int = 400, lineHeight: Float = 1.4f): TextStyle = TextStyle(
    fontFamily = Sans, fontWeight = FontWeight(weight), fontSize = size.sp, lineHeight = (size * lineHeight).sp, fontFeatureSettings = NUMERALS,
)

fun serif(size: Int, italic: Boolean = false, lineHeight: Float = 1.15f, tracking: Float = 0f): TextStyle = TextStyle(
    fontFamily = Serif, fontWeight = FontWeight.Normal, fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
    fontSize = size.sp, lineHeight = (size * lineHeight).sp, letterSpacing = tracking.em, fontFeatureSettings = NUMERALS,
)

/** 11sp tracked caps: section labels and eyebrow lines. */
val LabelStyle: TextStyle = TextStyle(
    fontFamily = Sans, fontWeight = FontWeight(500), fontSize = 11.sp, lineHeight = 15.sp, letterSpacing = 0.14.em,
)

@Composable
fun T(
    text: String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = LocalPalette.current.ink,
    maxLines: Int = Int.MAX_VALUE,
    align: TextAlign? = null,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = style.merge(TextStyle(color = color, textAlign = align ?: TextAlign.Unspecified)),
        maxLines = maxLines,
        overflow = if (maxLines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis,
        softWrap = maxLines != 1,
    )
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, color: Color = LocalPalette.current.mute) {
    T(text.uppercase(), LabelStyle, modifier, color, maxLines = 1)
}
