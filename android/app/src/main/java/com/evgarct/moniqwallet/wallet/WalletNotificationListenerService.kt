package com.evgarct.moniqwallet.wallet

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.evgarct.moniqwallet.work.WalletNotificationForwardWorker
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Listens system-wide for notifications and forwards Google Wallet payment pushes.
 *
 * WALLET_PACKAGE is the historical Google Pay/Wallet package name and needs re-confirming
 * on-device (adb shell dumpsys notification --noredact while a real payment notification
 * is showing) before relying on this in production — Google has rebranded/repackaged this
 * app before and the plan explicitly flags this as unverified.
 */
class WalletNotificationListenerService : NotificationListenerService() {

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName != WALLET_PACKAGE) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(android.app.Notification.EXTRA_TITLE)?.toString()
        val text = (
            extras.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequence(android.app.Notification.EXTRA_TEXT)
            )?.toString()

        if (title.isNullOrBlank() && text.isNullOrBlank()) return

        val inputData = Data.Builder()
            .putString(WalletNotificationForwardWorker.KEY_ENTRY_ID, UUID.randomUUID().toString())
            .putString(WalletNotificationForwardWorker.KEY_NOTIFICATION_KEY, sbn.key)
            .putString(WalletNotificationForwardWorker.KEY_TITLE, title)
            .putString(WalletNotificationForwardWorker.KEY_TEXT, text)
            .putLong(WalletNotificationForwardWorker.KEY_POSTED_AT, sbn.postTime)
            .build()

        val request = OneTimeWorkRequestBuilder<WalletNotificationForwardWorker>()
            .setInputData(inputData)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(applicationContext).enqueue(request)
    }

    companion object {
        const val WALLET_PACKAGE = "com.google.android.apps.walletnfcrel"
    }
}
