package com.evgarct.moniq.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.evgarct.moniq.MoniqApp
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.wallet.Capture
import com.evgarct.moniq.wallet.Notifier
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import kotlin.math.hypot

class MainActivity : FragmentActivity() {
    private lateinit var state: AppState
    private var unlocked by mutableStateOf(false)
    private var backgroundedAt = 0L

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(android.graphics.Color.TRANSPARENT, android.graphics.Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false
        val app = application as MoniqApp
        state = AppState(app)
        unlocked = !(state.biometricLock && canAuthenticate())
        handleIntent(intent)

        setContent {
            val reduce = rememberReduceMotion()
            val dark = isSystemInDarkTheme()
            CompositionLocalProvider(LocalPalette provides if (dark) DarkPalette else LightPalette, LocalReduceMotion provides reduce) {
                AppRoot(
                    state = state,
                    unlocked = unlocked,
                    canLock = canAuthenticate(),
                    onUnlock = ::promptUnlock,
                    onLightBars = { light ->
                        val controller = WindowCompat.getInsetsController(window, window.decorView)
                        controller.isAppearanceLightStatusBars = light
                        controller.isAppearanceLightNavigationBars = light
                    },
                    onSignedIn = ::askForNotifications,
                )
            }
        }
        if (!unlocked) promptUnlock()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        // A Wallet notification opens the chat, where Hermes's report about that payment sits.
        if (intent?.hasExtra(Notifier.EXTRA_CAPTURE) == true) state.chatOpen = true
    }

    override fun onStop() {
        super.onStop()
        backgroundedAt = System.currentTimeMillis()
    }

    override fun onStart() {
        super.onStart()
        if (::state.isInitialized && state.biometricLock && canAuthenticate() && backgroundedAt > 0 && System.currentTimeMillis() - backgroundedAt > 60_000) {
            unlocked = false
            promptUnlock()
        }
    }

    private fun canAuthenticate(): Boolean =
        BiometricManager.from(this).canAuthenticate(AUTHENTICATORS) == BiometricManager.BIOMETRIC_SUCCESS

    private fun promptUnlock() {
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                unlocked = true
            }
        })
        prompt.authenticate(
            BiometricPrompt.PromptInfo.Builder().setTitle("Unlock Moniq").setSubtitle("Confirm it is you").setAllowedAuthenticators(AUTHENTICATORS).build(),
        )
    }

    private fun askForNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private companion object {
        const val AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
    }
}

@Composable
private fun AppRoot(
    state: AppState,
    unlocked: Boolean,
    canLock: Boolean,
    onUnlock: () -> Unit,
    onLightBars: (Boolean) -> Unit,
    onSignedIn: () -> Unit,
) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val signedIn by state.repo.signedIn.collectAsStateWithLifecycle()
    val snapshot by state.repo.snapshot.collectAsStateWithLifecycle()
    val refreshing by state.repo.refreshing.collectAsStateWithLifecycle()
    val loadError by state.repo.loadError.collectAsStateWithLifecycle()
    val captures by state.app.captures.items.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val email = state.app.sessions.current?.email.orEmpty()

    // Login flood: a terracotta dot grows from the button, the app appears underneath, it fades.
    val veilScale = remember { Animatable(0f) }
    val veilAlpha = remember { Animatable(0f) }
    var veilOrigin by remember { mutableStateOf(Offset.Zero) }

    LifecycleResumeEffect(signedIn) {
        if (signedIn) {
            state.syncToday()
            scope.launch { state.repo.refresh(silent = state.repo.snapshot.value != null) }
        }
        onPauseOrDispose { }
    }
    LaunchedEffect(snapshot != null) { snapshot?.let(state.app.captures::seedCards) }

    val darkSurface = !signedIn || !unlocked || state.chatOpen || veilAlpha.value > .5f
    SideEffect { onLightBars(!darkSurface && !palette.dark) }

    Box(Modifier.fillMaxSize().background(if (signedIn) palette.bg else Color(0xFF191919))) {
        when {
            !signedIn -> LoginScreen(state) { origin ->
                scope.launch {
                    veilOrigin = origin
                    veilAlpha.snapTo(1f)
                    veilScale.snapTo(0f)
                    veilScale.animateTo(1f, tween(if (reduce) 0 else 700, easing = Motion.Veil))
                    state.repo.completeSignIn()
                    onSignedIn()
                    delay(60)
                    veilAlpha.animateTo(0f, tween(if (reduce) 0 else 550))
                }
            }
            !unlocked -> LockScreen(onUnlock)
            else -> {
                val data = snapshot
                if (data == null) LoadingScreen(loadError) { scope.launch { state.repo.refresh() } }
                else SignedInApp(state, data, captures, refreshing, email, canLock)
            }
        }

        if (veilAlpha.value > 0f) {
            androidx.compose.foundation.Canvas(Modifier.fillMaxSize().graphicsLayer { alpha = veilAlpha.value }) {
                val reach = hypot(maxOf(veilOrigin.x, size.width - veilOrigin.x), maxOf(veilOrigin.y, size.height - veilOrigin.y))
                drawCircle(Color(0xFFCC785C), radius = 20.dp.toPx() + reach * veilScale.value, center = veilOrigin)
            }
        }
    }
}

@Composable
private fun SignedInApp(state: AppState, snapshot: Snapshot, captures: List<Capture>, refreshing: Boolean, email: String, canLock: Boolean) {
    val wallet = snapshot.account(state.walletId)
    BackHandler(enabled = wallet != null && !state.chatOpen) { state.walletId = null }
    val screen = if (wallet != null) "wallet:${wallet.id}" else "tab:${state.tab}"

    Box(Modifier.fillMaxSize()) {
        AnimatedContent(
            targetState = screen,
            transitionSpec = {
                val toWallet = targetState.startsWith("wallet")
                val fromWallet = initialState.startsWith("wallet")
                when {
                    // Wallet history lifts out of its Balance row and settles back into it.
                    toWallet -> (fadeIn(tween(350, 90)) + slideInVertically(tween(500, easing = Motion.Sheet)) { it / 10 } + scaleIn(tween(500, easing = Motion.Sheet), initialScale = .97f)) togetherWith
                        (fadeOut(tween(200)) + scaleOut(tween(350), targetScale = .98f))
                    fromWallet -> (fadeIn(tween(350, 60)) + scaleIn(tween(450, easing = Motion.Sheet), initialScale = .98f)) togetherWith
                        (fadeOut(tween(220)) + slideOutVertically(tween(400, easing = Motion.Sheet)) { it / 10 })
                    // Tabs: shared axis X.
                    else -> {
                        val forward = targetState > initialState
                        (fadeIn(tween(300, 90)) + slideInHorizontally(tween(450, easing = Motion.Sheet)) { if (forward) it / 8 else -it / 8 }) togetherWith
                            (fadeOut(tween(150)) + slideOutHorizontally(tween(300, easing = Motion.Sheet)) { if (forward) -it / 8 else it / 8 })
                    }
                }
            },
            label = "screen",
            modifier = Modifier.fillMaxSize(),
        ) { target ->
            when {
                target.startsWith("wallet") -> {
                    val shown = snapshot.account(target.removePrefix("wallet:"))
                    if (shown != null) WalletScreen(state, snapshot, shown) { state.walletId = null } else Box(Modifier.fillMaxSize())
                }
                target == "tab:1" -> BalanceScreen(state, snapshot)
                else -> TodayScreen(state, snapshot, refreshing, email)
            }
        }

        // Edge-to-edge: scrolled content passes under the status bar, so the bar gets its own ground.
        Box(Modifier.align(Alignment.TopCenter).fillMaxWidth().background(LocalPalette.current.bg.copy(alpha = .94f))) { StatusBarSpacer() }

        TabBar(state, Modifier.align(Alignment.BottomCenter))
        ToastHost(state, Modifier.align(Alignment.BottomCenter))

        TxMenuSheet(state, snapshot)
        AddSheet(state, snapshot)
        SettingsSheet(state, snapshot, captures, email, canLock)
        ChatScreen(state, captures)
    }
}

/** Floating bar: the two tabs in an ink pill, Hermes as a breathing dot, and Add. */
@Composable
private fun TabBar(state: AppState, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    Row(
        modifier.windowInsetsPadding(WindowInsets.navigationBars).padding(start = 20.dp, end = 20.dp, bottom = 20.dp).fillMaxWidth().rise(350, durationMs = 800),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BoxWithConstraints(Modifier.weight(1f).height(60.dp).shadow(14.dp, RoundedCornerShape(30.dp)).background(palette.bar, RoundedCornerShape(30.dp)).padding(5.dp)) {
            val half = maxWidth / 2
            val x by animateDpAsState(half * state.tab, tween(if (LocalReduceMotion.current) 0 else Motion.INDICATOR, easing = Motion.Spring), label = "tab")
            Box(Modifier.offset(x = x).size(half, 50.dp).background(palette.barHi, RoundedCornerShape(25.dp)))
            Row(Modifier.fillMaxSize()) {
                listOf("Today", "Balance").forEachIndexed { index, label ->
                    Box(
                        Modifier.weight(1f).fillMaxSize().tap(scale = .97f, haptic = true) {
                            state.walletId = null
                            if (index == 0 && state.tab == 0) state.pickDate(LocalDate.now())
                            state.tab = index
                        },
                        contentAlignment = Alignment.Center,
                    ) { T(label, sans(15, 500), color = palette.barInk, maxLines = 1) }
                }
            }
        }
        val halo by haloProgress()
        Box(
            Modifier.size(60.dp).shadow(12.dp, CircleShape).background(palette.stone, CircleShape)
                .onGloballyPositioned { state.chatOrigin = it.boundsInRoot().center }
                .tap(haptic = true, label = "Ask Hermes") { state.chatOpen = true },
            contentAlignment = Alignment.Center,
        ) {
            Box(Modifier.size(22.dp).graphicsLayer {
                val scale = 1f + 1.3f * halo
                scaleX = scale
                scaleY = scale
                alpha = .5f * (1f - halo)
            }.background(palette.terra, CircleShape))
            BreathingDot(22.dp, palette.terra)
        }
        Box(
            Modifier.size(60.dp).shadow(14.dp, CircleShape).background(palette.bar, CircleShape)
                .tap(haptic = true, label = "Add transaction") { state.openAdd(AddRequest(if (state.tab == 0) state.selectedDate else LocalDate.now())) },
            contentAlignment = Alignment.Center,
        ) { PathIcon(Glyph.PLUS, size = 24.dp, viewport = 24f, stroke = 1.8.dp, color = palette.barInk) }
    }
}

@Composable
private fun ToastHost(state: AppState, modifier: Modifier = Modifier) {
    val palette = LocalPalette.current
    var message by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        state.repo.toasts.collect { text ->
            message = text
            visible = true
            launch {
                delay(2700)
                if (message == text) visible = false
            }
        }
    }
    val alpha by animateFloatAsState(if (visible) 1f else 0f, tween(350), label = "toastAlpha")
    val shift by animateDpAsState(if (visible) 0.dp else 14.dp, tween(500, easing = Motion.Sheet), label = "toastShift")
    if (alpha == 0f) return
    Box(
        modifier.windowInsetsPadding(WindowInsets.navigationBars).padding(bottom = 96.dp, start = 20.dp, end = 20.dp).offset(y = shift).graphicsLayer { this.alpha = alpha },
    ) {
        Row(
            Modifier.background(palette.ink, RoundedCornerShape(24.dp)).padding(horizontal = 18.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(Modifier.size(8.dp).background(palette.terra, CircleShape))
            T(message, sans(14, 500), color = palette.bg, maxLines = 2)
        }
    }
}

@Composable
private fun LoadingScreen(error: String?, onRetry: () -> Unit) {
    val palette = LocalPalette.current
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        if (error == null) {
            BreathingDot(22.dp, palette.terra)
            Spacer(Modifier.height(24.dp))
            T("Gathering your money.", serif(28, lineHeight = 1.1f), Modifier.rise())
        } else {
            T("Moniq is out of reach.", serif(28, lineHeight = 1.1f), Modifier.rise())
            Spacer(Modifier.height(8.dp))
            T(error, sans(15), color = palette.mute, align = androidx.compose.ui.text.style.TextAlign.Center)
            Spacer(Modifier.height(20.dp))
            Box(Modifier.height(48.dp).tap(onClick = onRetry).padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
                T("Try again", sans(15, 500), color = palette.terraInk)
            }
        }
    }
}

@Composable
private fun LockScreen(onUnlock: () -> Unit) {
    Column(Modifier.fillMaxSize().background(Color(0xFF191919)).padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        BreathingDot(22.dp, Night.terra)
        Spacer(Modifier.height(28.dp))
        T("Moniq is locked.", serif(30, lineHeight = 1.1f), color = Night.ink)
        Spacer(Modifier.height(20.dp))
        Box(Modifier.height(52.dp).tap(onClick = onUnlock).background(Night.ink, RoundedCornerShape(26.dp)).padding(horizontal = 28.dp), contentAlignment = Alignment.Center) {
            T("Unlock", sans(16, 600), color = Color(0xFF191919))
        }
    }
}
