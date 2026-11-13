package com.evgarct.moniq.ui

import android.content.Context
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import com.evgarct.moniq.MoniqApp
import com.evgarct.moniq.data.Net
import com.evgarct.moniq.data.Schedule
import com.evgarct.moniq.data.Tx
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.time.LocalDate

/** What the Add sheet was opened for. */
data class AddRequest(
    val date: LocalDate,
    val edit: Tx? = null,
    val series: Schedule? = null,
    val token: Long = System.nanoTime(),
)

data class ChatMessage(
    val id: Long,
    val mine: Boolean,
    val text: String,
    val facts: List<Pair<String, String>> = emptyList(),
    val done: Boolean = true,
    val failed: Boolean = false,
)

/** UI state that outlives a screen: navigation, open overlays and the Hermes conversation. */
@Stable
class AppState(val app: MoniqApp) {
    val repo get() = app.repo
    private val prefs = app.getSharedPreferences("ui", Context.MODE_PRIVATE)

    var tab by mutableStateOf(0)
    var walletId by mutableStateOf<String?>(null)
    var selectedDate by mutableStateOf(LocalDate.now())
    var windowStart by mutableStateOf(LocalDate.now())
    var calendarOpen by mutableStateOf(false)
    var hideAmounts by mutableStateOf(prefs.getBoolean("hide", false))
        private set

    var add by mutableStateOf<AddRequest?>(null)
    var addOpen by mutableStateOf(false)
    var menuTx by mutableStateOf<Tx?>(null)
    var menuOpen by mutableStateOf(false)
    var rescheduleTx by mutableStateOf<Tx?>(null)
    var settingsOpen by mutableStateOf(false)

    var chatOpen by mutableStateOf(false)
    var chatOrigin by mutableStateOf(Offset.Unspecified)

    var biometricLock by mutableStateOf(prefs.getBoolean("biometric", false))
        private set

    fun toggleHide() {
        hideAmounts = !hideAmounts
        prefs.edit().putBoolean("hide", hideAmounts).apply()
    }

    fun setBiometric(enabled: Boolean) {
        biometricLock = enabled
        prefs.edit().putBoolean("biometric", enabled).apply()
    }

    fun openAdd(request: AddRequest) {
        add = request
        addOpen = true
    }

    fun openMenu(tx: Tx) {
        menuTx = tx
        menuOpen = true
    }

    fun pickDate(date: LocalDate) {
        val today = LocalDate.now()
        selectedDate = date
        if (date.isBefore(windowStart) || date.isAfter(windowStart.plusDays(3))) {
            windowStart = if (!date.isBefore(today) && !date.isAfter(today.plusDays(3))) today else date
        }
    }

    /** Called when the app returns to the foreground: "today" may have moved on. */
    fun syncToday() {
        val today = LocalDate.now()
        if (windowStart.isBefore(today) && selectedDate.isBefore(today)) {
            windowStart = today
            selectedDate = today
        }
    }

    // ── Hermes ──────────────────────────────────────────────────────────────────────────────

    val messages = mutableStateListOf<ChatMessage>()
    var thinking by mutableStateOf(false)
    var toolLabel by mutableStateOf<String?>(null)
    private var hermesSession: String? = null
    private var turn: Job? = null
    private var nextId = 1L

    fun askHermes(question: String) {
        val text = question.trim()
        if (text.isEmpty() || thinking) return
        messages += ChatMessage(nextId++, mine = true, text = text)
        val answerId = nextId++
        thinking = true
        toolLabel = null
        turn = repo.scope.launch {
            val raw = StringBuilder()
            var started = false
            var failure: String? = null
            fun publish(done: Boolean) {
                val (body, facts) = splitFacts(raw.toString(), done)
                val message = ChatMessage(answerId, mine = false, text = body, facts = if (done) facts else emptyList(), done = done, failed = failure != null)
                val index = messages.indexOfFirst { it.id == answerId }
                if (index >= 0) messages[index] = message else messages += message
            }
            val firstTurn = hermesSession == null
            val session = hermesSession ?: "api-moniq-${java.util.UUID.randomUUID().toString().replace("-", "").take(16)}".also { hermesSession = it }
            app.net.askHermes(session, firstTurn, HERMES_BRIEF, text).collect { event ->
                when (event) {
                    is Net.AgentEvent.Session -> hermesSession = event.id
                    is Net.AgentEvent.Tool -> toolLabel = if (event.running) humanTool(event.label) else toolLabel
                    is Net.AgentEvent.Delta -> {
                        raw.append(event.text)
                        if (raw.isNotBlank()) {
                            started = true
                            thinking = false
                            publish(done = false)
                        }
                    }
                    is Net.AgentEvent.Failed -> failure = event.message
                    Net.AgentEvent.Done -> Unit
                }
            }
            thinking = false
            toolLabel = null
            if (raw.isBlank()) {
                // Nothing was said: show why instead of an empty bubble.
                failure = failure ?: "Hermes sent an empty answer. Try again."
                raw.append(failure)
            }
            publish(done = true)
            // A turn that changed data should be visible behind the chat straight away.
            repo.refresh(silent = true)
        }
    }

    fun newChat() {
        turn?.cancel()
        messages.clear()
        thinking = false
        toolLabel = null
        hermesSession = null
    }

    private fun humanTool(label: String): String {
        val name = label.substringAfterLast("__").lowercase()
        return when {
            "moniq" in name && ("create" in name || "update" in name || "mark" in name || "delete" in name) -> "Writing to Moniq"
            "moniq" in name -> "Reading your Moniq data"
            "tool_describe" in name || "reading tool" in name -> "Getting its tools ready"
            "web" in name || "search" in name -> "Searching"
            "memory" in name || "hindsight" in name || "recall" in name -> "Recalling"
            else -> "Working"
        }
    }

    companion object {
        const val HERMES_BRIEF =
            "You are answering inside the chat of the Moniq Android app, not Telegram. Reply in the language of the user's message. " +
                "Use plain text only: no markdown, no tables, no emoji, no headings. Keep the answer to one to four short sentences. " +
                "Never add amounts of different currencies together. When figures help, finish the reply with a block that starts with a " +
                "line containing only ::facts followed by at most six lines in the form Label | Value. Never show internal ids. " +
                "Before changing any data in Moniq, say what you are about to change and wait for a yes."

        /** Splits a reply into prose and its trailing `::facts` rows; while streaming the block stays hidden. */
        fun splitFacts(raw: String, done: Boolean): Pair<String, List<Pair<String, String>>> {
            val marker = raw.indexOf("::facts")
            val cleaned = { text: String -> text.replace("**", "").replace(Regex("(?m)^#+\\s*"), "").trim() }
            if (marker < 0) {
                // Do not flash a half-typed marker such as "::fa".
                val tail = raw.lastIndexOf("::")
                val visible = if (!done && tail >= 0 && raw.length - tail <= 7 && "::facts".startsWith(raw.substring(tail))) raw.substring(0, tail) else raw
                return cleaned(visible) to emptyList()
            }
            val facts = raw.substring(marker + 7).lines().mapNotNull { line ->
                val parts = line.split('|', limit = 2)
                if (parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank()) parts[0].trim().trim('-', '*', ' ') to parts[1].trim() else null
            }
            return cleaned(raw.substring(0, marker)) to facts.take(6)
        }
    }
}
