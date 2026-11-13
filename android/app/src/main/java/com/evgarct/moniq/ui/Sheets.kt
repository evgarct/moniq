package com.evgarct.moniq.ui

import android.content.Intent
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.data.TxInput
import com.evgarct.moniq.domain.dayCounts
import com.evgarct.moniq.domain.formatMoney
import com.evgarct.moniq.domain.parseDate
import com.evgarct.moniq.domain.selectableCategories
import com.evgarct.moniq.domain.spendableWallets
import com.evgarct.moniq.domain.txCurrency
import com.evgarct.moniq.domain.txTitle
import com.evgarct.moniq.wallet.Capture
import com.evgarct.moniq.domain.shortLabel
import com.evgarct.moniq.wallet.Notifier
import com.evgarct.moniq.wallet.WalletNotificationListenerService
import kotlinx.coroutines.launch
import java.time.LocalDate

private data class MenuItem(val label: String, val icon: String, val danger: Boolean = false, val more: Boolean = false, val separated: Boolean = false, val action: () -> Unit)

@Composable
private fun MenuRow(item: MenuItem) {
    val palette = LocalPalette.current
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill by animateColorAsState(if (pressed) palette.panel else Color.Transparent, tween(150), label = "menuFill")
    val scale by animateFloatAsState(if (pressed) .97f else 1f, tween(150), label = "menuScale")
    val tint = if (item.danger) palette.terraInk else palette.ink
    Column {
        if (item.separated) Box(Modifier.padding(top = 6.dp, bottom = 5.dp).fillMaxWidth().height(1.dp).background(palette.line))
        Row(
            Modifier.offset(x = (-12).dp).fillMaxWidth().height(52.dp).graphicsLayer {
                scaleX = scale
                scaleY = scale
            }.clip(RoundedCornerShape(14.dp)).background(fill).clickable(source, indication = null, onClick = item.action).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PathIcon(item.icon, color = tint)
            T(item.label, sans(17), Modifier.weight(1f).padding(start = 16.dp), tint, maxLines = 1)
            if (item.more) PathIcon(Glyph.CHEVRON, size = 18.dp, viewport = 18f, stroke = 1.6.dp)
        }
    }
}

/** Actions for one transaction; what is offered depends on its status and whether it repeats. */
@Composable
fun TxMenuSheet(state: AppState, snapshot: Snapshot) {
    val tx = state.menuTx?.let { shown -> snapshot.transactions.firstOrNull { it.id == shown.id } ?: shown }
    val open = state.menuOpen && tx != null
    var confirmDelete by remember(tx?.id, state.menuOpen) { mutableStateOf<String?>(null) }
    fun close() { state.menuOpen = false }

    Sheet(open = open, onDismiss = ::close) {
        if (tx == null) return@Sheet
        val schedule = snapshot.schedule(tx.scheduleId)
        val items = buildList {
            if (tx.status == "paid") {
                add(MenuItem("Mark as planned", Glyph.PLANNED) { state.repo.markPlanned(tx); close() })
            } else {
                add(MenuItem("Mark paid", Glyph.PAID) { state.repo.markPaid(tx); close() })
                if (schedule != null) add(MenuItem("Skip occurrence", Glyph.SKIP) { state.repo.skip(tx); close() })
                add(MenuItem("Reschedule", Glyph.RESCHEDULE, more = true) { state.rescheduleTx = tx; close() })
            }
            val date = parseDate(tx.occurredAt) ?: LocalDate.now()
            add(MenuItem(if (schedule != null && tx.status != "paid") "Edit occurrence" else "Edit", Glyph.EDIT) { close(); state.openAdd(AddRequest(date, edit = tx)) })
            if (schedule != null && tx.status != "paid") {
                add(MenuItem("Edit series", Glyph.EDIT) { close(); state.openAdd(AddRequest(date, series = schedule)) })
                val paused = schedule.state == "paused"
                add(MenuItem(if (paused) "Resume series" else "Pause series", if (paused) Glyph.PLAY else Glyph.PAUSE, separated = true) {
                    state.repo.setScheduleState(schedule, if (paused) "active" else "paused"); close()
                })
                add(MenuItem(if (confirmDelete == "series") "Tap again to delete the whole series" else "Delete series", Glyph.DELETE, danger = true) {
                    if (confirmDelete == "series") { state.repo.deleteSchedule(schedule); close() } else confirmDelete = "series"
                })
            } else {
                add(MenuItem(if (confirmDelete == "tx") "Tap again to delete" else "Delete", Glyph.DELETE, danger = true, separated = true) {
                    if (confirmDelete == "tx") { state.repo.delete(tx); close() } else confirmDelete = "tx"
                })
            }
        }
        Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 12.dp), verticalAlignment = Alignment.Bottom) {
                T(snapshot.txTitle(tx), serif(24, italic = true), Modifier.weight(1f).alignByBaseline().padding(end = 16.dp), maxLines = 1)
                T(formatMoney(tx.amount, snapshot.txCurrency(tx)), sans(17, 500), Modifier.alignByBaseline(), maxLines = 1)
            }
            items.forEach { MenuRow(it) }
        }
    }

    val reschedule = state.rescheduleTx
    val counts = remember(snapshot) { snapshot.dayCounts(LocalDate.now()) }
    DateSheet(
        open = reschedule != null, title = "Move to", selected = reschedule?.occurredAt?.let(::parseDate), counts = counts,
        onDismiss = { state.rescheduleTx = null },
    ) { date ->
        reschedule?.let { state.repo.reschedule(it, date.toString()) }
        state.rescheduleTx = null
    }
}

@Composable
fun PrimaryAction(label: String, onClick: () -> Unit) {
    val palette = LocalPalette.current
    Box(Modifier.fillMaxWidth().height(56.dp).tap(haptic = true, onClick = onClick).background(palette.ink, RoundedCornerShape(28.dp)).padding(horizontal = 20.dp), contentAlignment = Alignment.Center) {
        T(label, sans(16, 600), color = palette.bg, maxLines = 1)
    }
}

@Composable
fun SecondaryAction(label: String, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().height(48.dp).tap(onClick = onClick), contentAlignment = Alignment.Center) {
        T(label, sans(15, 500), color = LocalPalette.current.terraInk, maxLines = 1)
    }
}

@Composable
private fun Toggle(on: Boolean, onChange: (Boolean) -> Unit) {
    val palette = LocalPalette.current
    val x by androidx.compose.animation.core.animateDpAsState(if (on) 22.dp else 2.dp, tween(450, easing = Motion.Spring), label = "toggle")
    val fill by animateColorAsState(if (on) palette.ink else palette.panel, tween(300), label = "toggleFill")
    Box(Modifier.size(50.dp, 30.dp).tap(scale = 1f, haptic = true) { onChange(!on) }.background(fill, RoundedCornerShape(15.dp))) {
        Box(Modifier.offset(x = x, y = 2.dp).size(26.dp).background(if (on) palette.bg else palette.sheet, CircleShape))
    }
}

/** Profile: Google Wallet capture, its card rules and log, the lock, and signing out. */
@Composable
fun SettingsSheet(state: AppState, snapshot: Snapshot?, captures: List<Capture>, email: String, canLock: Boolean) {
    val palette = LocalPalette.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var listening by remember { mutableStateOf(Notifier.listenerEnabled(context)) }
    var cards by remember(state.settingsOpen, captures) { mutableStateOf(state.app.captures.cards()) }
    var confirmSignOut by remember(state.settingsOpen) { mutableStateOf(false) }
    var linking by remember { mutableStateOf<Capture?>(null) }
    LifecycleResumeEffect(Unit) {
        listening = Notifier.listenerEnabled(context)
        onPauseOrDispose { }
    }
    LaunchedEffect(state.settingsOpen) { if (state.settingsOpen) listening = Notifier.listenerEnabled(context) }

    Sheet(open = state.settingsOpen, onDismiss = { state.settingsOpen = false }, heightFraction = .86f) {
        Column(Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
            SheetHeader("You", onClose = { state.settingsOpen = false })
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
                T(email, sans(15), color = palette.mute, maxLines = 1)

                SectionHeading("01", "Google Wallet", Modifier.padding(top = 32.dp, bottom = 12.dp))
                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
                    PathIcon(Glyph.BELL)
                    Column(Modifier.weight(1f).padding(start = 14.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        T(if (listening) "Recording card payments" else "Capture is off", sans(17, 500))
                        T(
                            if (listening) "Hermes records each payment from a linked card on its own and tells you what it did."
                            else "Allow notification access so Moniq can read Wallet payments.",
                            sans(14), color = palette.mute,
                        )
                    }
                }
                if (!listening) {
                    Spacer(Modifier.height(10.dp))
                    PrimaryAction("Allow notification access") {
                        context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                }
                if (cards.isNotEmpty()) {
                    Label("Cards", Modifier.padding(top = 20.dp, bottom = 4.dp))
                    cards.toSortedMap().forEach { (last4, walletId) ->
                        Row(Modifier.fillMaxWidth().height(50.dp), verticalAlignment = Alignment.CenterVertically) {
                            PathIcon(Glyph.CARD)
                            T("••$last4", sans(17, 500), Modifier.padding(start = 14.dp))
                            T(snapshot?.account(walletId)?.name ?: "Wallet removed", sans(15), Modifier.weight(1f).padding(horizontal = 12.dp), palette.mute, maxLines = 1)
                            Box(Modifier.size(44.dp).offset(x = 10.dp).tap(label = "Forget card") {
                                state.app.captures.forgetCard(last4)
                                cards = state.app.captures.cards()
                            }, contentAlignment = Alignment.Center) { PathIcon(Glyph.CLOSE, size = 18.dp, viewport = 24f, stroke = 1.6.dp) }
                        }
                    }
                }
                val recent = captures.take(6)
                if (recent.isNotEmpty()) {
                    Label("Latest", Modifier.padding(top = 20.dp, bottom = 4.dp))
                    recent.forEach { capture ->
                        val status = when (capture.state) {
                            "recorded" -> "In chat"
                            "queued" -> "Hermes…"
                            "ignored" -> "Link card"
                            else -> "No answer"
                        }
                        // The only thing ever asked of the user: once, which wallet a new card pays from.
                        val linkable = capture.state == "ignored" && capture.last4 != null
                        Row(
                            Modifier.fillMaxWidth().height(50.dp).then(if (linkable) Modifier.tap(scale = .98f) { linking = capture } else Modifier),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            T(capture.merchant.ifBlank { "Wallet payment" }, sans(16, 500), Modifier.weight(1f).padding(end = 12.dp), maxLines = 1)
                            if (capture.amount != null && capture.currency != null) T(formatMoney(capture.amount, capture.currency), sans(15), Modifier.padding(end = 12.dp), maxLines = 1)
                            T(status, sans(13, 500), Modifier.width(78.dp), if (linkable) palette.terraInk else palette.mute, maxLines = 1, align = androidx.compose.ui.text.style.TextAlign.End)
                        }
                    }
                }

                SectionHeading("02", "Privacy", Modifier.padding(top = 32.dp, bottom = 12.dp))
                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
                    PathIcon(Glyph.SHIELD)
                    Column(Modifier.weight(1f).padding(start = 14.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        T("Lock with fingerprint", sans(17, 500))
                        T(if (canLock) "Ask every time Moniq opens." else "Set up a screen lock on this phone first.", sans(14), color = palette.mute)
                    }
                    Toggle(state.biometricLock && canLock) { if (canLock) state.setBiometric(it) else state.repo.toast("No screen lock on this phone") }
                }
                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp), verticalAlignment = Alignment.CenterVertically) {
                    PathIcon(Glyph.EYE, viewport = 24f)
                    T("Hide amounts on Balance", sans(17, 500), Modifier.weight(1f).padding(start = 14.dp, end = 12.dp))
                    Toggle(state.hideAmounts) { state.toggleHide() }
                }

                Spacer(Modifier.height(28.dp))
                Row(
                    Modifier.fillMaxWidth().height(52.dp).drawBehind { drawLine(palette.line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.tap(scale = .98f) {
                        if (confirmSignOut) {
                            state.settingsOpen = false
                            state.newChat()
                            scope.launch { state.repo.signOut() }
                        } else confirmSignOut = true
                    },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PathIcon(Glyph.SIGN_OUT, color = palette.terraInk)
                    T(if (confirmSignOut) "Tap again to sign out" else "Sign out", sans(17), Modifier.padding(start = 16.dp), palette.terraInk)
                }
            }
        }
    }

    val pending = linking
    PickerSheet(
        open = pending != null && state.settingsOpen,
        title = "Card ••${pending?.last4.orEmpty()} pays from",
        options = snapshot?.spendableWallets().orEmpty().map { PickerOption(it.id, it.name, formatMoney(it.balance, it.currency), accountGlyph(it)) },
        selected = null,
        onDismiss = { linking = null },
    ) { walletId ->
        val capture = pending ?: return@PickerSheet
        capture.last4?.let { state.app.captures.rememberCard(it, walletId) }
        // The payment that revealed the card goes to Hermes now; later ones go on their own.
        state.app.captures.update(capture.id) { it.copy(state = "queued", reason = null, walletId = walletId) }
        WalletNotificationListenerService.enqueue(state.app, capture.id)
        cards = state.app.captures.cards()
        linking = null
    }
}
