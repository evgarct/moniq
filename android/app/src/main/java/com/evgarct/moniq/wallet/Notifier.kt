package com.evgarct.moniq.wallet

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.evgarct.moniq.R
import com.evgarct.moniq.domain.formatMoney
import com.evgarct.moniq.ui.MainActivity

object Notifier {
    private const val CHANNEL = "wallet"
    const val EXTRA_CAPTURE = "capture_id"

    fun ensureChannel(context: Context) {
        val channel = NotificationChannel(CHANNEL, context.getString(R.string.channel_wallet_name), NotificationManager.IMPORTANCE_DEFAULT)
        channel.description = context.getString(R.string.channel_wallet_description)
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    fun listenerEnabled(context: Context): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
        val component = ComponentName(context, WalletNotificationListenerService::class.java)
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == component }
    }

    private fun post(context: Context, capture: Capture, title: String, text: String) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_CAPTURE, capture.id)
        val pending = PendingIntent.getActivity(
            context, capture.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_moniq)
            .setColor(context.getColor(R.color.terra))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        NotificationManagerCompat.from(context).notify(capture.id.hashCode(), notification)
    }

    private fun headline(capture: Capture): String {
        val place = capture.merchant.ifBlank { "Wallet payment" }
        return if (capture.amount != null && capture.currency != null) "$place · ${formatMoney(capture.amount, capture.currency)}" else place
    }

    /** Hermes's own words about the payment; tapping opens the chat where the same report sits. */
    fun report(context: Context, capture: Capture, detail: String) = post(context, capture, headline(capture), detail)

    fun cancel(context: Context, capture: Capture) {
        NotificationManagerCompat.from(context).cancel(capture.id.hashCode())
    }
}
