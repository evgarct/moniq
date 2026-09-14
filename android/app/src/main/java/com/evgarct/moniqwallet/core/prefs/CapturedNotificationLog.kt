package com.evgarct.moniqwallet.core.prefs

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class LogEntry(
    val notificationKey: String,
    val title: String?,
    val text: String?,
    val postedAt: Long,
    val status: String, // "forwarded" | "failed" | "duplicate"
    val loggedAt: Long,
)

/**
 * Tiny on-device record of recently captured Wallet notifications: shown in the app UI
 * so you can eyeball that capture is working, and doubles as the de-dupe window so the
 * same notification (Android re-posts on update) isn't forwarded to Gabi twice.
 */
class CapturedNotificationLog(context: Context) {

    private val prefs = context.getSharedPreferences("moniq_wallet_log", Context.MODE_PRIVATE)
    private val dedupeWindowMillis = 10 * 60 * 1000L
    private val maxEntries = 30

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
    fun record(entry: LogEntry) {
        val entries = readAll().toMutableList()
        entries.add(0, entry)
        writeAll(entries.take(maxEntries))
    }

    fun recent(): List<LogEntry> = readAll()

    private fun readAll(): List<LogEntry> {
        val raw = prefs.getString("entries_json", null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map { i ->
                val o = array.getJSONObject(i)
                LogEntry(
                    notificationKey = o.getString("notificationKey"),
                    title = if (o.isNull("title")) null else o.getString("title"),
                    text = if (o.isNull("text")) null else o.getString("text"),
                    postedAt = o.getLong("postedAt"),
                    status = o.getString("status"),
                    loggedAt = o.getLong("loggedAt"),
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
                    put("notificationKey", entry.notificationKey)
                    put("title", entry.title)
                    put("text", entry.text)
                    put("postedAt", entry.postedAt)
                    put("status", entry.status)
                    put("loggedAt", entry.loggedAt)
                },
            )
        }
        prefs.edit().putString("entries_json", array.toString()).apply()
    }
}
