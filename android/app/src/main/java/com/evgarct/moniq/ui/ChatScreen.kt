package com.evgarct.moniq.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.wallet.Capture
import kotlin.math.hypot

private val PRESETS = listOf(
    "What is coming in the next 3 days?" to "Next 3 days",
    "Where do I stand right now?" to "Where I stand",
    "How are my goals doing?" to "Goals",
    "Where did the money go this month?" to "This month",
)

/**
 * Hermes: always on the dark canvas. The screen opens as a circle growing out of the terracotta
 * dot in the tab bar (750ms) and closes back into it.
 */
@Composable
fun ChatScreen(state: AppState, captures: List<Capture>) {
    val reduce = LocalReduceMotion.current
    val progress by animateFloatAsState(if (state.chatOpen) 1f else 0f, tween(if (reduce) 0 else Motion.CHAT, easing = Motion.Reveal), label = "chatReveal")
    if (!state.chatOpen && progress == 0f) return
    BackHandler(enabled = state.chatOpen) { state.chatOpen = false }

    var draft by remember { mutableStateOf("") }
    val list = rememberLazyListState()
    val messages = state.messages
    val configured = state.app.net.hermesConfigured
    // What Hermes did with Google Wallet payments on its own, oldest first, above the conversation.
    val reports = remember(captures) { captures.filter { it.answeredAt > 0 && it.reason != null }.sortedBy { it.answeredAt }.takeLast(8) }
    val hasContent = messages.isNotEmpty() || reports.isNotEmpty()
    LaunchedEffect(state.chatOpen, reports.size, messages.size, messages.lastOrNull()?.text?.length, state.thinking) {
        if (hasContent) list.scrollToItem(reports.size + messages.size + 1)
    }

    fun send(text: String) {
        if (text.isBlank()) return
        state.askHermes(text)
        draft = ""
    }

    Column(
        Modifier
            .fillMaxSize()
            .drawWithContent {
                val origin = if (state.chatOrigin == Offset.Unspecified) Offset(size.width * .71f, size.height - 60.dp.toPx()) else state.chatOrigin
                val reach = hypot(maxOf(origin.x, size.width - origin.x), maxOf(origin.y, size.height - origin.y))
                val circle = Path().apply { addOval(Rect(origin, reach * progress)) }
                clipPath(circle) { this@drawWithContent.drawContent() }
            }
            .background(Night.bg)
            .tap(scale = 1f, role = null) { }
            .windowInsetsPadding(WindowInsets.statusBars)
            .windowInsetsPadding(WindowInsets.navigationBars.union(WindowInsets.ime)),
    ) {
        Row(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 20.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            BreathingDot(12.dp, Night.terra)
            Label("Hermes", Modifier.padding(start = 12.dp).weight(1f), Night.mute)
            if (messages.isNotEmpty()) {
                Box(Modifier.height(44.dp).tap(label = "New conversation", onClick = state::newChat).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                    T("New", sans(14, 500), color = Night.terraSoft)
                }
            }
            Box(Modifier.offset(x = 10.dp).size(44.dp).tap(label = "Close chat") { state.chatOpen = false }, contentAlignment = Alignment.Center) {
                PathIcon(Glyph.CLOSE, size = 24.dp, viewport = 24f, stroke = 1.6.dp, color = Night.ink)
            }
        }

        LazyColumn(Modifier.weight(1f).fillMaxWidth(), state = list, contentPadding = PaddingValues(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 20.dp)) {
            items(reports, key = { "report-${it.id}" }) { report ->
                Column(Modifier.fillMaxWidth().padding(top = 26.dp).rise(key = report.id)) {
                    val time = remember(report.answeredAt) {
                        java.time.Instant.ofEpochMilli(report.answeredAt).atZone(java.time.ZoneId.systemDefault())
                            .format(java.time.format.DateTimeFormatter.ofPattern("d MMM · HH:mm", java.util.Locale.ENGLISH))
                    }
                    Label("Google Wallet · $time", Modifier.padding(start = 24.dp, bottom = 8.dp), Night.mute)
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.padding(top = 8.dp).size(10.dp).background(if (report.state == "failed") Night.mute else Night.terra, CircleShape))
                        T(report.reason.orEmpty(), sans(16, lineHeight = 1.55f), Modifier.weight(1f), if (report.state == "failed") Night.mute else Night.ink)
                    }
                }
            }
            if (!hasContent) {
                item(key = "hero") {
                    Column(Modifier.rise(key = state.chatOpen)) {
                        T("Ask anything.", serif(46, lineHeight = 1f, tracking = -.025f), color = Night.ink)
                        T("See it clearly.", serif(46, italic = true, lineHeight = 1f, tracking = -.025f), color = Night.terra)
                        if (!configured) {
                            T("Hermes is not configured in this build. Add hermes.api.url and hermes.api.key to local.properties.", sans(15), Modifier.padding(top = 20.dp), Night.mute)
                        }
                    }
                }
                itemsIndexed(PRESETS, key = { _, preset -> preset.first }) { index, preset ->
                    Row(
                        Modifier.padding(top = if (index == 0) 34.dp else 0.dp).fillMaxWidth().rise(150 + index * 70, key = state.chatOpen)
                            .drawBehind { drawLine(Night.line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }
                            .tap(scale = .98f, enabled = configured) { send(preset.first) }.padding(vertical = 17.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        T((index + 1).toString().padStart(2, '0'), serif(17, italic = true), Modifier.alignByBaseline(), Night.terraSoft)
                        T(preset.first, serif(24, lineHeight = 1.15f, tracking = -.01f), Modifier.weight(1f).alignByBaseline(), Night.ink)
                    }
                }
            }
            items(messages, key = { it.id }) { message ->
                if (message.mine) {
                    Box(Modifier.fillMaxWidth().padding(top = 26.dp).rise(key = message.id), contentAlignment = Alignment.CenterEnd) {
                        T(message.text, serif(24, italic = true, lineHeight = 1.15f), Modifier.widthIn(max = 310.dp), Night.stone, align = TextAlign.End)
                    }
                } else {
                    Row(Modifier.fillMaxWidth().padding(top = 26.dp).rise(key = message.id), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Box(Modifier.padding(top = 8.dp).size(10.dp).background(Night.terra, CircleShape))
                        Column(Modifier.weight(1f)) {
                            T(message.text, sans(16, lineHeight = 1.55f), color = if (message.failed) Night.mute else Night.ink)
                            if (message.done && message.facts.isNotEmpty()) {
                                Column(Modifier.padding(top = 16.dp).rise(key = "facts-${message.id}")) {
                                    message.facts.forEach { (label, value) ->
                                        Row(
                                            Modifier.fillMaxWidth().drawBehind { drawLine(Night.line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx()) }.padding(vertical = 12.dp),
                                            horizontalArrangement = Arrangement.spacedBy(16.dp),
                                        ) {
                                            T(label, sans(14), Modifier.weight(1f), Night.mute)
                                            T(value, sans(14, 500), color = Night.ink, maxLines = 2, align = TextAlign.End)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if (state.thinking) {
                item(key = "thinking") {
                    Row(Modifier.padding(start = 24.dp, top = 26.dp).height(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        repeat(3) { TypingDot(it * 150) }
                        state.toolLabel?.let { T(it, sans(13), Modifier.padding(start = 8.dp).rise(key = it, durationMs = 300, distance = 6), Night.mute, maxLines = 1) }
                    }
                }
            }
            item(key = "tail") { Box(Modifier.height(1.dp)) }
        }

        if (hasContent) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PRESETS.forEach { (question, short) ->
                    Box(
                        Modifier.height(44.dp).tap(enabled = !state.thinking && configured) { send(question) }
                            .border(1.dp, Night.ink.copy(alpha = .3f), RoundedCornerShape(22.dp)).padding(horizontal = 16.dp),
                        contentAlignment = Alignment.Center,
                    ) { T(short, sans(14, 500), color = Night.ink, maxLines = 1) }
                }
            }
        }

        Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f).height(56.dp).background(Night.field, RoundedCornerShape(28.dp)).padding(horizontal = 22.dp), contentAlignment = Alignment.CenterStart) {
                BasicTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = configured,
                    textStyle = sans(16).merge(TextStyle(color = Night.ink)),
                    cursorBrush = SolidColor(Night.terra),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send(draft) }),
                    decorationBox = { inner ->
                        if (draft.isEmpty()) T("Ask about your money", sans(16), color = Night.ink.copy(alpha = .6f), maxLines = 1)
                        inner()
                    },
                )
            }
            Box(Modifier.size(56.dp).tap(enabled = configured && !state.thinking, haptic = true, label = "Send") { send(draft) }.background(Night.terra, CircleShape), contentAlignment = Alignment.Center) {
                PathIcon(Glyph.SEND, size = 24.dp, viewport = 24f, stroke = 1.8.dp, color = androidx.compose.ui.graphics.Color(0xFF191919))
            }
        }
    }
}

@Composable
private fun TypingDot(delayMs: Int) {
    val transition = rememberInfiniteTransition(label = "typing")
    val phase by transition.animateFloat(
        0f, 0f,
        infiniteRepeatable(keyframes {
            durationMillis = 1200
            0f at 0
            1f at 480
            0f at 960
            0f at 1200
        }, RepeatMode.Restart, initialStartOffset = androidx.compose.animation.core.StartOffset(delayMs)),
        label = "typingPhase",
    )
    Box(
        Modifier.size(7.dp).graphicsLayer {
            alpha = .25f + phase * .75f
            translationY = -3.dp.toPx() * phase
        }.background(Night.terra, CircleShape),
    )
}
