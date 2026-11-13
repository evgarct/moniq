package com.evgarct.moniq.wallet

import android.content.Context
import com.evgarct.moniq.BuildConfig
import com.evgarct.moniq.data.Snapshot
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.abs

/**
 * A Google Wallet payment notification and what became of it.
 *
 * `queued`    passed the card check; on its way to Hermes
 * `recorded`  Hermes answered; [reason] is its report, shown in the chat
 * `failed`    Hermes could not be reached or refused; [reason] says so, also in the chat
 * `ignored`   a card that is not linked to a wallet; nothing is sent
 *
 * The user is never asked about a payment: Hermes decides, and its answer is the whole outcome.
 */
data class Capture(
    val id: String,
    val title: String,
    val text: String,
    val postedAt: Long,
    val merchant: String,
    val amount: Double?,
    val currency: String?,
    val last4: String?,
    val walletId: String?,
    val categoryId: String?,
    val state: String,
    val reason: String?,
    val possibleRepeat: Boolean,
    val answeredAt: Long = 0,
) {
    private val zoned get() = Instant.ofEpochMilli(postedAt).atZone(ZoneId.systemDefault())
    val date: String get() = zoned.toLocalDate().toString()
    val localTime: String get() = zoned.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id); put("title", title); put("text", text); put("postedAt", postedAt)
        put("merchant", merchant); put("amount", amount ?: JSONObject.NULL); put("currency", currency ?: JSONObject.NULL)
        put("last4", last4 ?: JSONObject.NULL); put("walletId", walletId ?: JSONObject.NULL)
        put("categoryId", categoryId ?: JSONObject.NULL); put("state", state)
        put("reason", reason ?: JSONObject.NULL); put("possibleRepeat", possibleRepeat); put("answeredAt", answeredAt)
    }

    companion object {
        fun fromJson(o: JSONObject): Capture {
            fun s(key: String) = if (o.isNull(key)) null else o.optString(key)
            return Capture(
                id = o.getString("id"), title = o.optString("title"), text = o.optString("text"), postedAt = o.optLong("postedAt"),
                merchant = o.optString("merchant"), amount = if (o.isNull("amount")) null else o.optDouble("amount"),
                currency = s("currency"), last4 = s("last4"), walletId = s("walletId"), categoryId = s("categoryId"),
                state = o.optString("state", "ignored"), reason = s("reason"), possibleRepeat = o.optBoolean("possibleRepeat", false),
                answeredAt = o.optLong("answeredAt", 0),
            )
        }
    }
}

/** Captures and card-to-wallet rules, persisted in app-private storage. */
class CaptureStore(private val context: Context) {
    private val file = File(context.filesDir, "wallet-captures.json")
    private val prefs = context.getSharedPreferences("wallet-cards", Context.MODE_PRIVATE)
    private val _items = MutableStateFlow(load())
    val items: StateFlow<List<Capture>> = _items

    private fun load(): List<Capture> = runCatching {
        val array = JSONArray(file.readText())
        (0 until array.length()).map { Capture.fromJson(array.getJSONObject(it)) }
    }.getOrDefault(emptyList())

    @Synchronized
    private fun persist(list: List<Capture>) {
        val trimmed = list.sortedByDescending { it.postedAt }.take(120)
        _items.value = trimmed
        runCatching { file.writeText(JSONArray(trimmed.map { it.toJson() }).toString()) }
    }

    @Synchronized
    fun find(id: String): Capture? = _items.value.firstOrNull { it.id == id }

    /** Returns false when this exact notification is already known. */
    @Synchronized
    fun insert(capture: Capture): Boolean {
        if (_items.value.any { it.id == capture.id }) return false
        persist(_items.value + capture)
        return true
    }

    @Synchronized
    fun update(id: String, change: (Capture) -> Capture) {
        persist(_items.value.map { if (it.id == id) change(it) else it })
    }

    // ── Cards ────────────────────────────────────────────────────────────────────────────────

    fun cards(): Map<String, String> = prefs.all.filterKeys { it.matches(Regex("\\d{4}")) }.mapValues { it.value.toString() }

    fun walletForCard(last4: String?): String? = last4?.let { prefs.getString(it, null) }

    fun rememberCard(last4: String, walletId: String) {
        prefs.edit().putString(last4, walletId).apply()
    }

    fun forgetCard(last4: String) {
        prefs.edit().remove(last4).apply()
    }

    /** First run: turn the configured "last4:Wallet name" pairs into rules, matching by wallet name. */
    fun seedCards(snapshot: Snapshot) {
        if (prefs.getBoolean("seeded", false)) return
        val editor = prefs.edit()
        for (pair in BuildConfig.WALLET_CARDS.split(',')) {
            val last4 = pair.substringBefore(':').trim()
            val name = pair.substringAfter(':', "").trim()
            if (!last4.matches(Regex("\\d{4}")) || name.isEmpty()) continue
            val wallet = snapshot.accounts.firstOrNull { it.name.equals(name, ignoreCase = true) } ?: continue
            editor.putString(last4, wallet.id)
        }
        editor.putBoolean("seeded", true).apply()
    }
}

object WalletParser {
    data class Parsed(val merchant: String, val amount: Double?, val currency: String?, val last4: String?)

    private const val SPACES = "\\s\\u00a0\\u202f"
    private const val CODES = "CZK|EUR|USD|RUB|GBP|PLN|CHF|Kč|€|\\$|₽|£|zł"
    private val SUFFIX = Regex("(?<![\\d.,])(\\d[\\d$SPACES.,]*\\d|\\d)[$SPACES]*($CODES)(?![A-Za-z])", RegexOption.IGNORE_CASE)
    private val PREFIX = Regex("(?<![A-Za-z])($CODES)[$SPACES]*(\\d[\\d$SPACES.,]*\\d|\\d)", RegexOption.IGNORE_CASE)
    private val LAST4 = Regex("(?<![\\d.,])(\\d{4})(?![\\d.,])")

    fun currencyCode(raw: String): String = when (raw.lowercase()) {
        "kč", "czk" -> "CZK"
        "€", "eur" -> "EUR"
        "$", "usd" -> "USD"
        "₽", "rub" -> "RUB"
        "£", "gbp" -> "GBP"
        "zł", "pln" -> "PLN"
        else -> raw.uppercase()
    }

    /** `1 234,50`, `1,234.50` and `235` all mean what a person reads; anything else is rejected. */
    fun parseNumber(raw: String): Double? {
        val compact = raw.replace(Regex("[$SPACES]"), "")
        val decimalAt = maxOf(compact.lastIndexOf(','), compact.lastIndexOf('.'))
        val normalized = if (decimalAt >= 0 && compact.length - decimalAt - 1 in 1..2) {
            compact.substring(0, decimalAt).replace(",", "").replace(".", "") + "." + compact.substring(decimalAt + 1)
        } else {
            compact.replace(",", "").replace(".", "")
        }
        return normalized.toDoubleOrNull()?.takeIf { it > 0 && it < 100_000_000 }
    }

    /**
     * What the app itself needs from a notification: the card (to pick the wallet) and enough of
     * the amount to recognise a repeat. Hermes reads the raw text and decides everything else.
     */
    fun parse(title: String, text: String): Parsed {
        // The amount lives in the text; the title is the merchant and may itself contain digits.
        val body = "$text\n$title"
        val suffix = SUFFIX.find(body)
        val prefix = if (suffix == null) PREFIX.find(body) else null
        val amountRaw = suffix?.groupValues?.get(1) ?: prefix?.groupValues?.get(2)
        val currencyRaw = suffix?.groupValues?.get(2) ?: prefix?.groupValues?.get(1)
        val amountRange = suffix?.range ?: prefix?.range
        val last4 = LAST4.findAll(text).firstOrNull { match ->
            amountRange == null || match.range.first !in amountRange
        }?.groupValues?.get(1)
        return Parsed(
            merchant = title.trim().replace(Regex("\\s+"), " "),
            amount = amountRaw?.let(::parseNumber),
            currency = currencyRaw?.let(::currencyCode),
            last4 = last4,
        )
    }

    /** Stable key for "the same shop": case, accents and a trailing branch number do not matter. */
    fun merchantKey(name: String): String = Normalizer.normalize(name, Normalizer.Form.NFKD)
        .replace(Regex("\\p{M}+"), "").lowercase().replace(Regex("\\s+\\d+\\s*$"), "").replace(Regex("\\s+"), " ").trim()

    fun captureId(postedAt: Long, title: String, text: String): String {
        val hash = MessageDigest.getInstance("SHA-256").digest("$postedAt|$title|$text".toByteArray())
        // Shape the digest as a v5 UUID: it doubles as the idempotency key of a manual record.
        hash[6] = ((hash[6].toInt() and 0x0f) or 0x50).toByte()
        hash[8] = ((hash[8].toInt() and 0x3f) or 0x80).toByte()
        val hex = hash.take(16).joinToString("") { "%02x".format(it) }
        return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}"
    }
}

/**
 * The deterministic gates in front of Hermes, kept out of the prompt on purpose (they used to
 * live in the `wallet_filter.py` webhook script):
 *   1. only cards linked to a Moniq wallet are handed over
 *   2. an exact repeat of a notification is dropped by its id
 *   3. an equivalent card/merchant/amount within 120 s is handed over read-only
 */
object CaptureRules {
    private const val RELATED_WINDOW_MS = 120_000L

    fun decide(parsed: WalletParser.Parsed, id: String, title: String, text: String, postedAt: Long, snapshot: Snapshot?, store: CaptureStore): Capture {
        val wallet = snapshot?.account(store.walletForCard(parsed.last4))
        val base = Capture(
            id = id, title = title, text = text, postedAt = postedAt, merchant = parsed.merchant, amount = parsed.amount,
            currency = parsed.currency, last4 = parsed.last4, walletId = wallet?.id, categoryId = null, state = "queued",
            reason = null, possibleRepeat = false,
        )
        if (wallet == null) {
            return base.copy(state = "ignored", reason = if (parsed.last4 != null) "Card ••${parsed.last4} is not linked to a wallet" else "No card in the notification")
        }
        val amount = parsed.amount
        val related = amount != null && store.items.value.any { other ->
            other.id != id && other.state != "ignored" && other.last4 == parsed.last4 &&
                other.currency == parsed.currency && other.amount != null && abs(other.amount - amount) < 0.005 &&
                WalletParser.merchantKey(other.merchant) == WalletParser.merchantKey(parsed.merchant) &&
                abs(other.postedAt - postedAt) <= RELATED_WINDOW_MS
        }
        return base.copy(possibleRepeat = related)
    }

    /** The turn Hermes receives: the raw notification plus what the app already established. */
    fun hermesPrompt(capture: Capture, walletName: String, categoryName: String?): String {
        val walletLine = buildString {
            append("Deterministic check passed in the app: ")
            append(if (capture.last4 != null) "card ending ${capture.last4}. " else "the user chose the wallet by hand. ")
            append("Use the Moniq wallet \"$walletName\" as source_account_id = ${capture.walletId}; do not override it.")
            if (capture.possibleRepeat) {
                append(
                    "\nPOSSIBLE DUPLICATE: an equivalent card/merchant/amount/currency event within 120 seconds has already been " +
                        "dispatched and may still be processing. DO NOT CREATE or update any transaction in this run, even if the ledger " +
                        "is still empty. Read-only reconciliation only. If the matching paid entry exists, report already recorded. " +
                        "Otherwise report that the earlier notification is processing; do not retry the write.",
                )
            }
        }
        val categoryLine = if (capture.categoryId != null && categoryName != null) {
            "The user already chose the category by hand: \"$categoryName\", category_id = ${capture.categoryId}. Use it as is."
        } else {
            "No category was chosen: pick the best selectable expense category from moniq_get_finance_context."
        }
        return "Google Wallet payment notification captured by the Moniq Android app at ${capture.localTime} (${ZoneId.systemDefault().id}).\n" +
            "Title: ${capture.title.ifBlank { "(none)" }}\nText: ${capture.text.ifBlank { "(none)" }}\n\n$walletLine\n$categoryLine\n\n" +
            "Load the moniq-wallet-import skill and record it in Moniq exactly as the skill describes. " +
            "Nobody will answer you: decide on your own, never ask for confirmation, and report what you did."
    }

    /** Hermes's reply as the chat shows it: its words, minus the machine `::status` line of the skill. */
    fun readReply(reply: String): String =
        reply.replace(Regex("(?m)^\\s*::status.*$"), "").replace("**", "").trim().ifBlank { "Hermes gave no details." }
}
