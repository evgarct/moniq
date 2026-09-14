package com.evgarct.moniqwallet.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.evgarct.moniqwallet.MoniqWalletApp
import com.evgarct.moniqwallet.core.network.WalletApiException
import com.evgarct.moniqwallet.core.prefs.LogEntry

/**
 * Forwards one captured Wallet notification to Gabi's webhook. Runs via WorkManager (not
 * inline in the listener service) so it survives process death and retries with backoff
 * when offline — same pattern as Form's ActivitySyncWorker.
 */
class WalletNotificationForwardWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as MoniqWalletApp
        val notificationKey = inputData.getString(KEY_NOTIFICATION_KEY) ?: return Result.failure()
        val title = inputData.getString(KEY_TITLE)
        val text = inputData.getString(KEY_TEXT)
        val postedAt = inputData.getLong(KEY_POSTED_AT, System.currentTimeMillis())

        if (app.capturedNotificationLog.wasRecentlyForwarded(notificationKey)) {
            app.capturedNotificationLog.record(
                LogEntry(notificationKey, title, text, postedAt, status = "duplicate", loggedAt = System.currentTimeMillis()),
            )
            return Result.success()
        }

        return try {
            app.walletApiClient.postNotification(title, text, postedAt)
            app.capturedNotificationLog.record(
                LogEntry(notificationKey, title, text, postedAt, status = "forwarded", loggedAt = System.currentTimeMillis()),
            )
            Result.success()
        } catch (error: WalletApiException) {
            // 4xx (bad payload / wrong secret) won't succeed on retry; 5xx/network errors might.
            if (error.code in 400..499) {
                app.capturedNotificationLog.record(
                    LogEntry(notificationKey, title, text, postedAt, status = "failed", loggedAt = System.currentTimeMillis()),
                )
                Result.failure()
            } else {
                Result.retry()
            }
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val KEY_NOTIFICATION_KEY = "notification_key"
        const val KEY_TITLE = "title"
        const val KEY_TEXT = "text"
        const val KEY_POSTED_AT = "posted_at"
    }
}
