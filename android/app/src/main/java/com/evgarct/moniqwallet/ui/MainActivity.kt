package com.evgarct.moniqwallet.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.evgarct.moniqwallet.MoniqWalletApp
import com.evgarct.moniqwallet.core.network.FinanceContext
import com.evgarct.moniqwallet.core.network.PickerOption
import com.evgarct.moniqwallet.core.prefs.LogEntry
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    WalletApp(isNotificationAccessGranted = ::isNotificationAccessGranted)
                }
            }
        }
    }

    private fun isNotificationAccessGranted(): Boolean {
        val enabledListeners = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return enabledListeners?.contains(packageName) == true
    }
}

private sealed class Screen {
    data object List : Screen()
    data class Edit(val entryId: String) : Screen()
}

@Composable
private fun WalletApp(isNotificationAccessGranted: () -> Boolean) {
    var screen by remember { mutableStateOf<Screen>(Screen.List) }
    // refreshTick just forces the log re-read below when bumped (e.g. after a send).
    var refreshTick by remember { mutableIntStateOf(0) }
    val app = MoniqWalletApp.instance
    var financeContext by remember { mutableStateOf<FinanceContext?>(null) }
    var financeContextError by remember { mutableStateOf<String?>(null) }
    var wantsFinanceContext by remember { mutableStateOf(false) }

    LaunchedEffect(wantsFinanceContext) {
        if (!wantsFinanceContext || financeContext != null) return@LaunchedEffect
        try {
            financeContext = app.walletApiClient.fetchFinanceContext()
        } catch (e: Exception) {
            financeContextError = e.message ?: "Failed to load wallets/categories"
        }
    }

    when (val current = screen) {
        is Screen.List -> WalletListScreen(
            isNotificationAccessGranted = isNotificationAccessGranted,
            refreshKey = refreshTick,
            onOpenEntry = { entryId ->
                wantsFinanceContext = true
                screen = Screen.Edit(entryId)
            },
        )
        is Screen.Edit -> {
            val entry = remember(current.entryId, refreshTick) { app.capturedNotificationLog.get(current.entryId) }
            if (entry == null) {
                screen = Screen.List
            } else {
                EditEntryScreen(
                    entry = entry,
                    financeContext = financeContext,
                    financeContextError = financeContextError,
                    onBack = { screen = Screen.List },
                    onSent = {
                        refreshTick += 1
                        screen = Screen.List
                    },
                )
            }
        }
    }
}

@Composable
private fun WalletListScreen(
    isNotificationAccessGranted: () -> Boolean,
    refreshKey: Int,
    onOpenEntry: (String) -> Unit,
) {
    var granted by remember { mutableStateOf(isNotificationAccessGranted()) }
    val entries = remember(refreshKey) { MoniqWalletApp.instance.capturedNotificationLog.recent() }
    val context = LocalContext.current

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Moniq Wallet", style = MaterialTheme.typography.headlineSmall)
        Text(if (granted) "Notification access: granted ✅" else "Notification access: not granted ❌")
        if (!granted) {
            Button(onClick = {
                context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                granted = isNotificationAccessGranted()
            }) { Text("Grant notification access") }
        }

        Text("Captured (${entries.size})", style = MaterialTheme.typography.titleMedium)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            items(entries, key = { it.id }) { entry ->
                LogEntryRow(entry, onClick = { onOpenEntry(entry.id) })
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun LogEntryRow(entry: LogEntry, onClick: () -> Unit) {
    val formatter = remember { SimpleDateFormat("d MMM, HH:mm", Locale.getDefault()) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text((entry.editedTitle ?: entry.title).orEmpty().ifBlank { "(no title)" })
            Text(statusEmoji(entry.status))
        }
        Text(entry.text.orEmpty(), style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatter.format(Date(entry.postedAt)), style = MaterialTheme.typography.labelSmall)
            if (entry.walletName != null || entry.categoryName != null) {
                Text(
                    listOfNotNull(entry.walletName, entry.categoryName).joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}

private fun statusEmoji(status: String) = when (status) {
    "forwarded" -> "✅ recorded"
    "duplicate" -> "↩️ duplicate"
    else -> "⚠️ failed"
}

@Composable
private fun EditEntryScreen(
    entry: LogEntry,
    financeContext: FinanceContext?,
    financeContextError: String?,
    onBack: () -> Unit,
    onSent: () -> Unit,
) {
    val app = MoniqWalletApp.instance
    val scope = rememberCoroutineScope()
    var title by remember(entry.id) { mutableStateOf(entry.editedTitle ?: entry.title.orEmpty()) }
    var selectedWallet by remember(entry.id, financeContext) {
        mutableStateOf(financeContext?.wallets?.find { it.id == entry.walletId })
    }
    var selectedCategory by remember(entry.id, financeContext) {
        mutableStateOf(financeContext?.categories?.find { it.id == entry.categoryId })
    }
    var sending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TextButton(onClick = onBack) { Text("← Back") }
        Text("Edit & send", style = MaterialTheme.typography.headlineSmall)
        Text(entry.text.orEmpty(), style = MaterialTheme.typography.bodySmall)

        OutlinedTextField(
            value = title,
            onValueChange = { title = it },
            label = { Text("Title") },
            modifier = Modifier.fillMaxWidth(),
        )

        if (financeContextError != null) {
            Text("Couldn't load wallets/categories: $financeContextError", color = MaterialTheme.colorScheme.error)
        } else if (financeContext == null) {
            CircularProgressIndicator()
        } else {
            PickerDropdown(
                label = "Wallet",
                options = financeContext.wallets,
                selected = selectedWallet,
                onSelect = { selectedWallet = it },
            )
            PickerDropdown(
                label = "Category",
                options = financeContext.categories,
                selected = selectedCategory,
                onSelect = { selectedCategory = it },
            )
        }

        if (error != null) {
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error)
        }

        Button(
            enabled = !sending,
            onClick = {
                sending = true
                error = null
                scope.launch {
                    try {
                        app.walletApiClient.postNotification(
                            title = title.ifBlank { entry.title },
                            text = entry.text,
                            postedAt = entry.postedAt,
                            walletId = selectedWallet?.id,
                            categoryId = selectedCategory?.id,
                        )
                        app.capturedNotificationLog.update(
                            entry.copy(
                                status = "forwarded",
                                editedTitle = title,
                                walletId = selectedWallet?.id,
                                walletName = selectedWallet?.name,
                                categoryId = selectedCategory?.id,
                                categoryName = selectedCategory?.name,
                                loggedAt = System.currentTimeMillis(),
                            ),
                        )
                        onSent()
                    } catch (e: Exception) {
                        error = e.message ?: "Send failed"
                        app.capturedNotificationLog.update(entry.copy(status = "failed", editedTitle = title))
                    } finally {
                        sending = false
                    }
                }
            },
        ) {
            Text(if (sending) "Sending..." else "Send")
        }
    }
}

// Plain Box + DropdownMenu rather than ExposedDropdownMenuBox/ExposedDropdownMenu — the
// latter's API shape has been in flux across recent Material3 alpha releases (this project
// pins 1.5.0-alpha28 for MaterialExpressive elsewhere), and this simpler combo is stable
// across versions and perfectly adequate for a picker with a handful of options.
@Composable
private fun PickerDropdown(
    label: String,
    options: List<PickerOption>,
    selected: PickerOption?,
    onSelect: (PickerOption) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium)
        Box {
            OutlinedButton(
                onClick = { expanded = true },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(selected?.name ?: "Select $label")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option.name) },
                        onClick = {
                            onSelect(option)
                            expanded = false
                        },
                    )
                }
            }
        }
    }
}
