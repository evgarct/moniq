package com.evgarct.moniqwallet.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.evgarct.moniqwallet.MoniqWalletApp
import com.evgarct.moniqwallet.core.prefs.LogEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WalletScreen(isNotificationAccessGranted = ::isNotificationAccessGranted)
                }
            }
        }
    }

    private fun isNotificationAccessGranted(): Boolean {
        val enabledListeners = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return enabledListeners?.contains(packageName) == true
    }
}

@Composable
private fun WalletScreen(isNotificationAccessGranted: () -> Boolean) {
    var granted by remember { mutableStateOf(isNotificationAccessGranted()) }
    val entries = remember { MoniqWalletApp.instance.capturedNotificationLog.recent() }
    val context = androidx.compose.ui.platform.LocalContext.current

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Moniq Wallet", style = MaterialTheme.typography.headlineSmall)
        Text(
            if (granted) "Notification access: granted ✅" else "Notification access: not granted ❌",
        )
        if (!granted) {
            Button(onClick = {
                context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                granted = isNotificationAccessGranted()
            }) {
                Text("Grant notification access")
            }
        }

        Text("Recently captured (${entries.size})", style = MaterialTheme.typography.titleMedium)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(entries) { entry -> LogEntryRow(entry) }
        }
    }
}

@Composable
private fun LogEntryRow(entry: LogEntry) {
    val formatter = remember { SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()) }
    Column {
        Text("${entry.title.orEmpty()} — ${statusEmoji(entry.status)} ${entry.status}")
        Text(entry.text.orEmpty(), style = MaterialTheme.typography.bodySmall)
        Text(formatter.format(Date(entry.postedAt)), style = MaterialTheme.typography.labelSmall)
    }
}

private fun statusEmoji(status: String) = when (status) {
    "forwarded" -> "✅"
    "duplicate" -> "↩️"
    else -> "⚠️"
}
