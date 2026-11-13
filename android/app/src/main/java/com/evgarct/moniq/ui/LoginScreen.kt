package com.evgarct.moniq.ui

import android.graphics.RuntimeShader
import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val GRAIN_SHADER = """
uniform float2 resolution;
uniform float frame;
half4 main(float2 p) {
    float2 cell = floor(p / 1.5);
    float n = fract(sin(dot(cell + frame * 17.0, float2(12.9898, 78.233))) * 43758.5453);
    return half4(half3(n), 1.0);
}
"""

/** Living film grain over the photo: 12 new frames a second, about 6% strong, off with reduce motion. */
@Composable
private fun Grain(modifier: Modifier = Modifier) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val reduce = LocalReduceMotion.current
    val shader = remember { RuntimeShader(GRAIN_SHADER) }
    var frame by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(reduce) {
        while (!reduce) {
            delay(83)
            frame = (frame + 1f) % 240f
        }
    }
    Canvas(modifier) {
        shader.setFloatUniform("resolution", size.width, size.height)
        shader.setFloatUniform("frame", frame)
        drawRect(ShaderBrush(shader), alpha = .16f, blendMode = BlendMode.Overlay)
    }
}

@Composable
fun LoginScreen(state: AppState, onSignedIn: (Offset) -> Unit) {
    val reduce = LocalReduceMotion.current
    var sheetOpen by remember { mutableStateOf(false) }
    var buttonCenter by remember { mutableStateOf(Offset.Unspecified) }
    val ken = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) { if (!reduce) ken.animateTo(1f, tween(2600, easing = Motion.Ken)) }

    CompositionLocalProvider(LocalPalette provides DarkPalette) {
        Box(Modifier.fillMaxSize().background(Color(0xFF191919))) {
            Column(Modifier.fillMaxSize()) {
                Box(Modifier.fillMaxWidth().weight(.55f).clipToBounds()) {
                    Image(
                        painterResource(R.drawable.login_photo), contentDescription = null, contentScale = ContentScale.Crop,
                        alignment = Alignment.TopCenter,
                        modifier = Modifier.fillMaxSize().graphicsLayer {
                            val scale = 1.14f - .14f * ken.value
                            scaleX = scale
                            scaleY = scale
                            translationY = size.height * .03f * (1f - ken.value)
                        },
                    )
                    Grain(Modifier.fillMaxSize())
                    Image(
                        painterResource(R.drawable.logo_wordmark_light), contentDescription = "Moniq",
                        modifier = Modifier.windowInsetsPadding(WindowInsets.statusBars).padding(start = 24.dp, top = 28.dp).height(30.dp)
                            .rise(400, durationMs = 1200, distance = 0),
                    )
                }
                Column(
                    Modifier.fillMaxWidth().weight(.45f).windowInsetsPadding(WindowInsets.navigationBars).padding(start = 24.dp, end = 24.dp, top = 30.dp, bottom = 28.dp),
                    verticalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Column(Modifier.rise(350)) {
                            T("Feel grounded.", serif(54, lineHeight = .98f, tracking = -.025f), color = Night.ink)
                            T("Live freely.", serif(54, italic = true, lineHeight = .98f, tracking = -.025f), color = Night.terra)
                        }
                        T("Know where you stand. Make room for what matters.", sans(15, lineHeight = 1.5f), Modifier.rise(500), Night.mute)
                    }
                    Column(Modifier.rise(650), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(
                            Modifier.fillMaxWidth().height(56.dp)
                                .onGloballyPositioned { buttonCenter = it.boundsInRoot().center }
                                .tap(haptic = true) { sheetOpen = true }.background(Night.ink, RoundedCornerShape(28.dp)),
                            contentAlignment = Alignment.Center,
                        ) { T("Sign in with email", sans(16, 600), color = Color(0xFF191919)) }
                        Box(Modifier.fillMaxWidth().height(48.dp), contentAlignment = Alignment.Center) {
                            T("Use your Moniq account from moniq.fyi", sans(14), color = Night.mute)
                        }
                    }
                }
            }
            SignInSheet(state, sheetOpen, onDismiss = { sheetOpen = false }) {
                sheetOpen = false
                onSignedIn(buttonCenter)
            }
        }
    }
}

@Composable
private fun SignInSheet(state: AppState, open: Boolean, onDismiss: () -> Unit, onDone: () -> Unit) {
    val palette = LocalPalette.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val passwordFocus = remember { FocusRequester() }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun submit() {
        if (busy) return
        if (email.isBlank() || password.isEmpty()) {
            error = "Enter your email and password"
            return
        }
        busy = true
        error = null
        scope.launch {
            try {
                state.repo.prepareSignIn(email.trim(), password)
                focus.clearFocus()
                password = ""
                onDone()
            } catch (failure: Exception) {
                error = failure.message?.takeIf { it.isNotBlank() } ?: "Could not sign in"
            } finally {
                busy = false
            }
        }
    }

    Sheet(open = open, onDismiss = { if (!busy) onDismiss() }, scrim = .5f) {
        Column(Modifier.imePadding().padding(start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            SheetHeader("Sign in", onClose = { if (!busy) onDismiss() })
            Field(email, { email = it; error = null }, "Email", KeyboardType.Email, ImeAction.Next, ContentType.EmailAddress, onAction = { passwordFocus.requestFocus() })
            Spacer(Modifier.height(10.dp))
            Field(password, { password = it; error = null }, "Password", KeyboardType.Password, ImeAction.Go, ContentType.Password, secret = true, modifier = Modifier.focusRequester(passwordFocus), onAction = ::submit)
            Box(Modifier.fillMaxWidth().height(36.dp), contentAlignment = Alignment.CenterStart) {
                error?.let { T(it, sans(14), Modifier.rise(key = it, durationMs = 300, distance = 6), palette.terraInk, maxLines = 2) }
            }
            Box(Modifier.fillMaxWidth().height(56.dp).tap(enabled = !busy, haptic = true, onClick = ::submit).background(palette.ink, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
                if (busy) Spinner(color = palette.bg, track = palette.bg.copy(alpha = .2f)) else T("Continue", sans(16, 600), color = palette.bg)
            }
        }
    }
}

@Composable
private fun Field(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboard: KeyboardType,
    action: ImeAction,
    content: ContentType,
    modifier: Modifier = Modifier,
    secret: Boolean = false,
    onAction: () -> Unit,
) {
    val palette = LocalPalette.current
    Box(Modifier.fillMaxWidth().height(56.dp).background(palette.panel, RoundedCornerShape(28.dp)).padding(horizontal = 22.dp), contentAlignment = Alignment.CenterStart) {
        BasicTextField(
            value = value,
            onValueChange = onChange,
            modifier = modifier.fillMaxWidth().semantics { contentType = content },
            singleLine = true,
            textStyle = sans(16).merge(TextStyle(color = palette.ink)),
            cursorBrush = SolidColor(palette.terra),
            visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = action, autoCorrectEnabled = false),
            keyboardActions = KeyboardActions(onAny = { onAction() }),
            decorationBox = { inner ->
                if (value.isEmpty()) T(placeholder, sans(16), color = palette.mute, maxLines = 1)
                inner()
            },
        )
    }
}
