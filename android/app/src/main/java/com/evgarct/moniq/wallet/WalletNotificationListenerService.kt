package com.evgarct.moniq.wallet

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.evgarct.moniq.BuildConfig
import com.evgarct.moniq.MoniqApp
import com.evgarct.moniq.data.ApiException
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Captures Google Wallet payment notifications and hands them to Hermes, which records them in
 * Moniq on its own: it reconciles against the ledger, picks the category and writes the entry.
 * The app only applies the deterministic gates in [CaptureRules] and shows the outcome.
 */
class WalletNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val fromWallet = sbn.packageName == WALLET_PACKAGE
        // Debug builds accept `adb shell cmd notification post -t <merchant> moniq-wallet-test <text>`.
        val fromTest = BuildConfig.DEBUG && sbn.packageName == "com.android.shell" && sbn.tag == TEST_TAG
        if (!fromWallet && !fromTest) return
        if (sbn.notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString()?.trim().orEmpty()
        if (title.isEmpty() && text.isEmpty()) return

        // A test notification is always handed over read-only, so a debug run can never write to the ledger.
        ingest(applicationContext, title, text, sbn.postTime, readOnly = fromTest)
    }

    companion object {
        const val WALLET_PACKAGE = "com.google.android.apps.walletnfcrel"
        const val TEST_TAG = "moniq-wallet-test"

        fun ingest(context: Context, title: String, text: String, postedAt: Long, readOnly: Boolean = false) {
            val app = context.applicationContext as MoniqApp
            if (app.sessions.current == null) return // signed out: nothing to record into
            val parsed = WalletParser.parse(title, text)
            val id = WalletParser.captureId(postedAt, title, text)
            val snapshot = app.repo.cachedSnapshotBlocking()
            snapshot?.let(app.captures::seedCards)
            val capture = CaptureRules.decide(parsed, id, title, text, postedAt, snapshot, app.captures)
                .let { if (readOnly) it.copy(possibleRepeat = true) else it }
            if (!app.captures.insert(capture)) return // the same notification delivered again
            if (capture.state == "queued") enqueue(context, capture.id)
        }

        fun enqueue(context: Context, captureId: String) {
            val request = OneTimeWorkRequestBuilder<CaptureWorker>()
                .setInputData(workDataOf(CaptureWorker.KEY_ID to captureId))
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork("capture-$captureId", ExistingWorkPolicy.KEEP, request)
        }
    }
}

/**
 * Sends one queued capture to Hermes and stores what it did. Hermes is reachable only inside the
 * tailnet, so an unreachable host is retried with backoff rather than treated as a failure.
 */
class CaptureWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val app = applicationContext as MoniqApp
        val id = inputData.getString(KEY_ID) ?: return Result.failure()
        val capture = app.captures.find(id) ?: return Result.failure()
        if (capture.state != "queued") return Result.success()
        if (!app.net.hermesConfigured) {
            finish(app, id, "failed", "Hermes is not configured in this build, so this payment was not recorded.")
            return Result.failure()
        }
        val snapshot = app.repo.cachedSnapshotBlocking()
        val wallet = snapshot?.account(capture.walletId)
        if (wallet == null) {
            app.captures.update(id) { it.copy(state = "ignored", reason = "The card's wallet no longer exists") }
            return Result.failure()
        }
        val prompt = CaptureRules.hermesPrompt(capture, wallet.name, snapshot.category(capture.categoryId)?.name)

        return try {
            // One session per notification and one idempotency key per exact request: a retry after
            // a lost answer replays Hermes's first reply instead of recording the payment twice,
            // while a hand-corrected resend (different wallet or category) is a new request.
            val key = "moniq-wallet-$id-${Integer.toHexString(prompt.hashCode())}"
            val reply = app.net.hermesComplete("api-moniq-wallet-${id.replace("-", "").take(20)}", key, prompt)
            // Whatever Hermes decided, its words are the whole outcome: they go to the chat as they are.
            finish(app, id, "recorded", CaptureRules.readReply(reply))
            runCatching { app.repo.refresh(silent = true) }
            Result.success()
        } catch (error: ApiException) {
            if ((error.status in 500..599 || error.status == 429) && runAttemptCount < 6) return Result.retry()
            finish(app, id, "failed", "Hermes did not take this payment: ${error.message ?: "request refused"}")
            Result.failure()
        } catch (_: IOException) {
            if (runAttemptCount < 20) Result.retry() else {
                finish(app, id, "failed", "Hermes stayed out of reach, so this payment was not recorded. Is Tailscale on?")
                Result.failure()
            }
        }
    }

    private fun finish(app: MoniqApp, id: String, state: String, message: String) {
        app.captures.update(id) { it.copy(state = state, reason = message, answeredAt = System.currentTimeMillis()) }
        app.captures.find(id)?.let { Notifier.report(applicationContext, it, message) }
    }

    companion object {
        const val KEY_ID = "capture_id"
    }
}
