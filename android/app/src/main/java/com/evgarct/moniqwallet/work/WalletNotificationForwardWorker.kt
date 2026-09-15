package com.evgarct.moniqwallet.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.evgarct.moniqwallet.MoniqWalletApp
import com.evgarct.moniqwallet.core.network.WalletApiException
import com.evgarct.moniqwallet.core.prefs.LogEntry

/**
 * Forwards one freshly-captured Wallet notification to Gabi's webhook. Runs via WorkManager
 * (not inline in the listener service) so it survives process death and retries with backoff
 * when offline — same pattern as Form's ActivitySyncWorker.
 *
 * Manual (re)send from the review/edit screen does NOT go through this worker — it's a
 * direct suspend call (see MainActivity), since it's a one-off user-triggered action where
 * WorkManager's background-retry semantics aren't needed and the UI wants an immediate result.
 */
class WalletNotificationForwardWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as MoniqWalletApp
        val entryId = inputData.getString(KEY_ENTRY_ID) ?: return Result.failure()
        val notificationKey = inputData.getString(KEY_NOTIFICATION_KEY) ?: return Result.failure()
        val title = inputData.getString(KEY_TITLE)
        val text = inputData.getString(KEY_TEXT)
        val postedAt = inputData.getLong(KEY_POSTED_AT, System.currentTimeMillis())

        if (app.capturedNotificationLog.wasRecentlyForwarded(notificationKey)) {
            app.capturedNotificationLog.record(
                LogEntry(entryId, notificationKey, title, text, postedAt, status = "duplicate", loggedAt = System.currentTimeMillis()),
            )
            return Result.success()
        }

        fun logEntry(status: String) = LogEntry(
            id = entryId,
            notificationKey = notificationKey,
            title = title,
            text = text,
            postedAt = postedAt,
            status = status,
            loggedAt = System.currentTimeMillis(),
        )

        return try {
            app.walletApiClient.postNotification(title, text, postedAt)
            app.capturedNotificationLog.update(logEntry("forwarded"))
            Result.success()
        } catch (error: WalletApiException) {
            // 4xx (bad payload / wrong secret) won't succeed on retry; 5xx/network errors might.
            app.capturedNotificationLog.update(logEntry("failed"))
            if (error.code in 400..499) Result.failure() else Result.retry()
        } catch (_: Exception) {
            app.capturedNotificationLog.update(logEntry("failed"))
            Result.retry()
        }
    }

    companion object {
        const val KEY_ENTRY_ID = "entry_id"
        const val KEY_NOTIFICATION_KEY = "notification_key"
        const val KEY_TITLE = "title"
        const val KEY_TEXT = "text"
        const val KEY_POSTED_AT = "posted_at"
    }
}
