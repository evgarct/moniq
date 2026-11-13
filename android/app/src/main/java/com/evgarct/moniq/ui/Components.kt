package com.evgarct.moniq.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.domain.currencySymbol
import kotlinx.coroutines.launch

val LocalHideAmounts = staticCompositionLocalOf { false }

/** Balance "eye": amounts blur 10dp and fade over 450ms instead of being swapped for dots. */
@Composable
fun Modifier.amountVeil(): Modifier {
    val hidden = LocalHideAmounts.current
    val radius by animateDpAsState(if (hidden) 10.dp else 0.dp, tween(450, easing = Motion.Out), label = "blur")
    val fade by animateFloatAsState(if (hidden) .55f else 1f, tween(450, easing = Motion.Out), label = "fade")
    return if (radius > 0.dp) this.blur(radius).alpha(fade) else this
}

/** Amount with its currency in a fixed 18dp column, so digits and symbols align down a list. */
@Composable
fun MoneyText(
    amount: String,
    currency: String,
    modifier: Modifier = Modifier,
    style: TextStyle = sans(17, 500),
    color: Color = LocalPalette.current.ink,
    veil: Boolean = false,
) {
    Row(if (veil) modifier.amountVeil() else modifier, verticalAlignment = Alignment.Bottom) {
        T(amount, style, Modifier.alignByBaseline(), color, maxLines = 1)
        T(currencySymbol(currency), sans(12), Modifier.alignByBaseline().padding(start = 6.dp).width(18.dp), LocalPalette.current.mute, maxLines = 1)
    }
}

@Composable
fun BreathingDot(size: Dp, color: Color, modifier: Modifier = Modifier) {
    val scale by breathing()
    Box(
        modifier.size(size).graphicsLayer {
            scaleX = scale
            scaleY = scale
        }.background(color, CircleShape),
    )
}

@Composable
fun Spinner(color: Color, track: Color, modifier: Modifier = Modifier, size: Dp = 20.dp) {
    val angle by spinning()
    androidx.compose.foundation.Canvas(modifier.size(size).graphicsLayer { rotationZ = angle }) {
        val width = 2.dp.toPx()
        drawCircle(track, radius = this.size.minDimension / 2 - width / 2, style = androidx.compose.ui.graphics.drawscope.Stroke(width))
        drawArc(
            color, startAngle = -90f, sweepAngle = 90f, useCenter = false,
            topLeft = androidx.compose.ui.geometry.Offset(width / 2, width / 2),
            size = androidx.compose.ui.geometry.Size(this.size.width - width, this.size.height - width),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width, cap = androidx.compose.ui.graphics.StrokeCap.Round),
        )
    }
}

/**
 * Bottom sheet from the canvas: 32dp top corners, scrim fade 450ms, travel 600ms on the sheet
 * curve, drag down to dismiss. It stays composed until the exit has finished.
 */
@Composable
fun Sheet(
    open: Boolean,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    scrim: Float = .4f,
    heightFraction: Float? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val progress by animateFloatAsState(if (open) 1f else 0f, tween(if (reduce) 0 else Motion.SHEET, easing = Motion.Sheet), label = "sheet")
    val veil by animateFloatAsState(if (open) 1f else 0f, tween(if (reduce) 0 else 450), label = "scrim")
    if (!open && progress == 0f && veil == 0f) return

    BackHandler(enabled = open, onBack = onDismiss)
    val scope = rememberCoroutineScope()
    val drag = remember { Animatable(0f) }
    var sheetHeight by remember { mutableIntStateOf(0) }
    LaunchedEffect(open) { if (open) drag.snapTo(0f) }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        Box(
            Modifier.fillMaxSize().graphicsLayer { alpha = veil }.background(Color(0xFF141413).copy(alpha = scrim))
                .pointerInput(open) { if (open) awaitPointerEventScope { while (true) { awaitPointerEvent(); } } }
                .tap(enabled = open, scale = 1f, role = null, onClick = onDismiss),
        )
        val sized = if (heightFraction != null) Modifier.height(maxHeight * heightFraction) else Modifier
        Column(
            modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .then(sized)
                .onSizeChanged { sheetHeight = it.height }
                .graphicsLayer {
                    val height = if (sheetHeight > 0) sheetHeight.toFloat() else size.height
                    translationY = (1f - progress) * height * 1.04f + drag.value
                }
                .shadow(24.dp, RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp), clip = false)
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .background(palette.sheet)
                .draggable(
                    orientation = Orientation.Vertical,
                    state = rememberDraggableState { delta -> scope.launch { drag.snapTo((drag.value + delta).coerceAtLeast(0f)) } },
                    onDragStopped = { velocity ->
                        if (drag.value > sheetHeight * .22f || velocity > 1400f) onDismiss()
                        else drag.animateTo(0f, tween(350, easing = Motion.Sheet))
                    },
                )
                .pointerInput(Unit) { awaitPointerEventScope { while (true) { awaitPointerEvent() } } }
                .windowInsetsPadding(WindowInsets.navigationBars),
        ) {
            Box(Modifier.padding(top = 10.dp).align(Alignment.CenterHorizontally).size(36.dp, 4.dp).background(palette.line, RoundedCornerShape(2.dp)))
            content()
        }
    }
}

@Composable
fun SheetHeader(title: String, onClose: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().height(52.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        T(title, serif(24, italic = true), Modifier.weight(1f), maxLines = 1)
        Box(Modifier.offset(x = 10.dp).size(44.dp).tap(label = "Close", onClick = onClose), contentAlignment = Alignment.Center) {
            PathIcon(Glyph.CLOSE, size = 24.dp, viewport = 24f, stroke = 1.6.dp, color = LocalPalette.current.ink)
        }
    }
}

/** Pill selector with a sliding indicator that overshoots once (the canvas's "spring"). */
@Composable
fun Segmented(
    options: List<String>,
    selected: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 44.dp,
    inset: Dp = 3.dp,
    indicator: Color = LocalPalette.current.ink,
    onIndicator: Color = LocalPalette.current.bg,
    textStyle: TextStyle = sans(14, 500),
    durationMs: Int = 500,
    raised: Boolean = false,
) {
    val palette = LocalPalette.current
    BoxWithConstraints(modifier.height(height).background(palette.panel, RoundedCornerShape(height / 2))) {
        val cell = (maxWidth - inset * 2) / options.size
        val x by animateDpAsState(inset + cell * selected, tween(if (LocalReduceMotion.current) 0 else durationMs, easing = Motion.Spring), label = "segment")
        Box(
            Modifier.offset(x = x, y = inset).size(cell, height - inset * 2)
                .then(if (raised) Modifier.shadow(2.dp, RoundedCornerShape(height / 2)) else Modifier)
                .background(indicator, RoundedCornerShape(height / 2)),
        )
        Row(Modifier.fillMaxSize().padding(horizontal = inset)) {
            options.forEachIndexed { index, label ->
                val tint by androidx.compose.animation.animateColorAsState(if (index == selected) onIndicator else palette.ink, tween(300), label = "segmentText")
                Box(Modifier.weight(1f).fillMaxSize().tap(scale = 1f, haptic = true) { onSelect(index) }, contentAlignment = Alignment.Center) {
                    T(label, textStyle, color = tint, maxLines = 1)
                }
            }
        }
    }
}

/** A label/value line of a form sheet: 46dp tall, the value is what you tap. */
@Composable
fun FormRow(label: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, value: @Composable () -> Unit) {
    Row(
        modifier.fillMaxWidth().height(46.dp).then(if (onClick != null) Modifier.tap(scale = .98f, onClick = onClick) else Modifier),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        T(label, sans(14), color = LocalPalette.current.mute, maxLines = 1)
        value()
    }
}

@Composable
fun StatusBarSpacer() {
    Box(Modifier.fillMaxWidth().windowInsetsPadding(WindowInsets.statusBars))
}

@Composable
fun SectionHeading(number: String?, title: String, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
        if (number != null) T(number, serif(17, italic = true), Modifier.alignByBaseline(), LocalPalette.current.terraInk)
        Label(title, Modifier.alignByBaseline())
    }
}
