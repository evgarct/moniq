package com.evgarct.moniq.ui

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/** Motion vocabulary of the canvas; every duration and curve below is quoted from it. */
object Motion {
    val Out: Easing = CubicBezierEasing(.2f, .8f, .2f, 1f) // rise, press, grow
    val Sheet: Easing = CubicBezierEasing(.2f, .9f, .25f, 1f) // sheets, month reveal, toast
    val Spring: Easing = CubicBezierEasing(.3f, 1.25f, .4f, 1f) // sliding indicators, overshoots once
    val Reveal: Easing = CubicBezierEasing(.3f, .8f, .2f, 1f) // chat circle
    val Veil: Easing = CubicBezierEasing(.6f, 0f, .2f, 1f) // login flood
    val Ken: Easing = CubicBezierEasing(.2f, .7f, .2f, 1f)
    val Pop: Easing = CubicBezierEasing(.3f, 1.5f, .4f, 1f)
    val Quart: Easing = Easing { 1f - (1f - it) * (1f - it) * (1f - it) * (1f - it) }

    const val RISE = 750
    const val SHEET = 600
    const val INDICATOR = 550
    const val COUNT = 1200
    const val CHAT = 750
}

val LocalReduceMotion = staticCompositionLocalOf { false }

@Composable
fun rememberReduceMotion(): Boolean {
    val context = LocalContext.current
    return remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}

/** Fade in while travelling up 20dp, once per [key]. Rows pass their index as [delayMs] to cascade. */
fun Modifier.rise(delayMs: Int = 0, key: Any? = Unit, distance: Int = 20, durationMs: Int = Motion.RISE): Modifier = composed {
    val reduce = LocalReduceMotion.current
    val progress = remember(key) { Animatable(if (reduce) 1f else 0f) }
    val shift = with(LocalDensity.current) { distance.dp.toPx() }
    LaunchedEffect(key) {
        if (!reduce) {
            if (delayMs > 0) delay(delayMs.toLong())
            progress.animateTo(1f, tween(durationMs, easing = Motion.Out))
        }
    }
    graphicsLayer {
        alpha = progress.value
        translationY = (1f - progress.value) * shift
    }
}

/** A tap target that sinks to 95% while held, with no ripple. */
fun Modifier.tap(
    enabled: Boolean = true,
    scale: Float = .95f,
    haptic: Boolean = false,
    role: Role? = Role.Button,
    label: String? = null,
    onClick: () -> Unit,
): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val feedback = LocalHapticFeedback.current
    val size by animateFloatAsState(if (pressed && enabled) scale else 1f, tween(200, easing = Motion.Out), label = "press")
    this
        .graphicsLayer {
            scaleX = size
            scaleY = size
        }
        .clickable(interactionSource = source, indication = null, enabled = enabled, role = role, onClickLabel = label) {
            if (haptic) feedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onClick()
        }
}

/** Counts up to [target] over 1.2s with ease-out quart; later changes glide from the shown value. */
@Composable
fun animatedAmount(target: Double, key: Any? = Unit): State<Double> {
    val reduce = LocalReduceMotion.current
    val shown = remember(key) { mutableStateOf(if (reduce) target else 0.0) }
    val driver = remember(key) { Animatable(0f) }
    LaunchedEffect(key, target) {
        if (reduce) {
            shown.value = target
            return@LaunchedEffect
        }
        val from = shown.value
        driver.snapTo(0f)
        driver.animateTo(1f, tween(Motion.COUNT, easing = Motion.Quart)) {
            shown.value = from + (target - from) * value
        }
        shown.value = target
    }
    return shown
}

/** 2.8s breathing scale used by every terracotta "agent" dot. */
@Composable
fun breathing(): State<Float> {
    if (LocalReduceMotion.current) return remember { mutableStateOf(1f) }
    val transition = rememberInfiniteTransition(label = "breathe")
    return transition.animateFloat(1f, 1.12f, infiniteRepeatable(tween(1400, easing = CubicBezierEasing(.42f, 0f, .58f, 1f)), RepeatMode.Reverse), label = "breathe")
}

@Composable
fun haloProgress(): State<Float> {
    if (LocalReduceMotion.current) return remember { mutableStateOf(1f) }
    val transition = rememberInfiniteTransition(label = "halo")
    return transition.animateFloat(0f, 1f, infiniteRepeatable(tween(2800, easing = CubicBezierEasing(0f, 0f, .58f, 1f)), RepeatMode.Restart), label = "halo")
}

@Composable
fun spinning(): State<Float> {
    val transition = rememberInfiniteTransition(label = "spin")
    return transition.animateFloat(0f, 360f, infiniteRepeatable(tween(700, easing = LinearEasing)), label = "spin")
}
