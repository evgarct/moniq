package com.evgarct.moniqwallet.core.prefs

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class LogEntry(
    val id: String,
    val notificationKey: String,
    val title: String?,
    val text: String?,
    val postedAt: Long,
    val status: String, // "forwarded" | "failed" | "duplicate"
    val loggedAt: Long,
    // Set once the user edits this entry in the review screen — resend uses these
    // instead of the raw captured title/text when present.
    val editedTitle: String? = null,
    val walletId: String? = null,
    val walletName: String? = null,
    val categoryId: String? = null,
    val categoryName: String? = null,
)

/**
 * On-device record of captured Wallet notifications: shown in the app's review list so
 * you can see what was recorded vs failed, and manually edit + (re)send any entry. Also
 * doubles as the de-dupe window so the same notification (Android re-posts on update)
 * isn't auto-forwarded to Gabi twice.
 */
class CapturedNotificationLog(context: Context) {

    private val prefs = context.getSharedPreferences("moniq_wallet_log", Context.MODE_PRIVATE)
    private val dedupeWindowMillis = 10 * 60 * 1000L
    private val maxEntries = 50

    @Synchronized
    fun wasRecentlyForwarded(notificationKey: String): Boolean {
        val now = System.currentTimeMillis()
        return readAll().any {
            it.notificationKey == notificationKey &&
                it.status == "forwarded" &&
                now - it.loggedAt < dedupeWindowMillis
        }
    }

    @Synchronized
    fun record(entry: LogEntry): LogEntry {
        val withId = if (entry.id.isBlank()) entry.copy(id = UUID.randomUUID().toString()) else entry
        val entries = readAll().toMutableList()
        entries.add(0, withId)
        writeAll(entries.take(maxEntries))
        return withId
    }

    @Synchronized
    fun update(updated: LogEntry) {
        val entries = readAll().toMutableList()
        val index = entries.indexOfFirst { it.id == updated.id }
        if (index >= 0) {
            entries[index] = updated
        } else {
            entries.add(0, updated)
        }
        writeAll(entries.take(maxEntries))
    }

    fun get(id: String): LogEntry? = readAll().find { it.id == id }

    fun recent(): List<LogEntry> = readAll()

    private fun readAll(): List<LogEntry> {
        val raw = prefs.getString("entries_json", null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map { i ->
                val o = array.getJSONObject(i)
                fun str(key: String): String? = if (o.isNull(key)) null else o.optString(key)
                val notificationKey = o.getString("notificationKey")
                val loggedAt = o.getLong("loggedAt")
                // Legacy entries (written before the `id` field existed) get a DETERMINISTIC
                // fallback id derived from stable fields, not a fresh random UUID on every
                // read — a random one changes on every readAll() call, which silently broke
                // navigation: the id captured when the list was shown never matched the id
                // looked up when the edit screen opened, so get() always returned null and
                // the screen bounced straight back with no visible error.
                LogEntry(
                    id = str("id") ?: "legacy:$notificationKey:$loggedAt",
                    notificationKey = notificationKey,
                    title = str("title"),
                    text = str("text"),
                    postedAt = o.getLong("postedAt"),
                    status = o.getString("status"),
                    loggedAt = loggedAt,
                    editedTitle = str("editedTitle"),
                    walletId = str("walletId"),
                    walletName = str("walletName"),
                    categoryId = str("categoryId"),
                    categoryName = str("categoryName"),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun writeAll(entries: List<LogEntry>) {
        val array = JSONArray()
        entries.forEach { entry ->
            array.put(
                JSONObject().apply {
                    put("id", entry.id)
                    put("notificationKey", entry.notificationKey)
                    put("title", entry.title)
                    put("text", entry.text)
                    put("postedAt", entry.postedAt)
                    put("status", entry.status)
                    put("loggedAt", entry.loggedAt)
                    put("editedTitle", entry.editedTitle)
                    put("walletId", entry.walletId)
                    put("walletName", entry.walletName)
                    put("categoryId", entry.categoryId)
                    put("categoryName", entry.categoryName)
                },
            )
        }
        prefs.edit().putString("entries_json", array.toString()).apply()
    }
}
