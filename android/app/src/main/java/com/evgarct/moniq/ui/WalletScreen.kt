package com.evgarct.moniq.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.data.Account
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.domain.HistoryRow
import com.evgarct.moniq.domain.currencySymbol
import com.evgarct.moniq.domain.formatAmount
import com.evgarct.moniq.domain.longLabel
import com.evgarct.moniq.domain.monthName
import com.evgarct.moniq.domain.monthYear
import com.evgarct.moniq.domain.monthsWithActivity
import com.evgarct.moniq.domain.pensionValue
import com.evgarct.moniq.domain.txIcon
import com.evgarct.moniq.domain.txMeta
import com.evgarct.moniq.domain.txTitle
import com.evgarct.moniq.domain.walletHistory
import java.time.LocalDate

private fun typeLabel(account: Account) = when (account.type) {
    "saving" -> "Savings"
    "credit_card" -> "Credit card"
    "debt" -> "Debt"
    "pension" -> "Pension"
    else -> "Cash"
}

@Composable
fun WalletScreen(state: AppState, snapshot: Snapshot, wallet: Account, onBack: () -> Unit) {
    val palette = LocalPalette.current
    val today = remember { LocalDate.now() }
    var month by remember(wallet.id) { mutableStateOf(today.withDayOfMonth(1)) }
    var monthsOpen by remember { mutableStateOf(false) }
    val months = remember(snapshot, wallet.id) { snapshot.monthsWithActivity(wallet, today) }
    val history = remember(snapshot, wallet.id, month) { snapshot.walletHistory(wallet, month) }
    val balance = if (wallet.type == "pension") snapshot.pensionValue(wallet) else wallet.balance
    val list = rememberLazyListState()
    // The page title collapses into the top bar once it scrolls away.
    val collapsed by remember { derivedStateOf { list.firstVisibleItemIndex > 0 || list.firstVisibleItemScrollOffset > 260 } }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(Modifier.fillMaxSize(), state = list, contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 150.dp)) {
            item(key = "head") {
                Column {
                    StatusBarSpacer()
                    Spacer(Modifier.height(20.dp + 44.dp + 36.dp))
                    Column(Modifier.rise(key = wallet.id), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        Column {
                            T(wallet.name, serif(38, lineHeight = 1.04f, tracking = -.02f))
                            Row(Modifier.tap(scale = .97f, label = "Choose month") { monthsOpen = true }, verticalAlignment = Alignment.CenterVertically) {
                                val suffix = if (month.year == today.year) "in ${month.monthName()}." else "in ${month.monthYear()}."
                                T(suffix, serif(38, italic = true, lineHeight = 1.04f, tracking = -.02f), color = palette.terra, maxLines = 1)
                                PathIcon(Glyph.CHEVRON_DOWN, Modifier.padding(start = 8.dp, top = 8.dp), size = 18.dp, viewport = 18f, stroke = 1.6.dp, color = palette.terra)
                            }
                        }
                        val shown by animatedAmount(balance, key = wallet.id)
                        Row(verticalAlignment = Alignment.Bottom) {
                            T(formatAmount(shown), serif(44, lineHeight = 1f, tracking = -.025f), Modifier.alignByBaseline(), maxLines = 1)
                            T(currencySymbol(wallet.currency), serif(18, lineHeight = 1f), Modifier.alignByBaseline().padding(start = 6.dp), maxLines = 1)
                        }
                    }
                }
            }
            if (history.isEmpty()) {
                item(key = "empty-$month") {
                    EmptyDay(Modifier.padding(top = 48.dp).rise(key = month), title = "A quiet month.", body = "Nothing was recorded in this wallet.", action = null)
                }
            }
            var index = 0
            history.forEach { day ->
                val headingDelay = (100 + index * 35).coerceAtMost(900)
                item(key = "day-${day.date}") {
                    T(day.date.longLabel(), serif(22, italic = true), Modifier.padding(top = 36.dp, bottom = 6.dp).rise(headingDelay, key = month))
                }
                day.rows.forEach { row ->
                    val delay = (100 + (index++) * 35).coerceAtMost(900)
                    item(key = row.tx.id) { HistoryLine(snapshot, wallet, row, Modifier.animateItem().rise(delay, key = month)) { state.openMenu(row.tx) } }
                }
            }
        }

        // Sticky bar: back, and the wallet's name once the big title has scrolled off.
        Column(Modifier.fillMaxWidth().background(palette.bg.copy(alpha = if (collapsed) .96f else 0f))) {
            StatusBarSpacer()
            Row(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 20.dp).height(44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                IconButton(Glyph.BACK, "Back to Balance", Modifier.offset(x = (-10).dp), onClick = onBack)
                val titleAlpha by androidx.compose.animation.core.animateFloatAsState(if (collapsed) 1f else 0f, androidx.compose.animation.core.tween(250), label = "barTitle")
                T(wallet.name, serif(20, italic = true), Modifier.weight(1f).padding(horizontal = 8.dp).graphicsLayer { alpha = titleAlpha }, maxLines = 1)
                Label("Wallet · ${typeLabel(wallet)}")
            }
            Spacer(Modifier.height(8.dp))
        }
    }

    Sheet(open = monthsOpen, onDismiss = { monthsOpen = false }) {
        Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            SheetHeader("Month", onClose = { monthsOpen = false })
            LazyColumn(Modifier.fillMaxWidth().height((months.size.coerceAtMost(7) * 52).dp)) {
                items(months.size) { i ->
                    val option = months[i]
                    Row(
                        Modifier.fillMaxWidth().height(52.dp).tap(scale = .98f, haptic = true) {
                            month = option
                            monthsOpen = false
                        },
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        T(option.monthYear(), sans(17, if (option == month) 600 else 400))
                        if (option == month) Box(Modifier.size(8.dp).background(palette.terra, CircleShape))
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryLine(snapshot: Snapshot, wallet: Account, row: HistoryRow, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val tx = row.tx
    Row(modifier.fillMaxWidth().tap(scale = .98f, label = "Actions", onClick = onClick).padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
        CategoryGlyph(snapshot.txIcon(tx), Modifier.padding(top = 2.dp))
        Column(Modifier.weight(1f).padding(start = 14.dp, end = 16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            T(snapshot.txTitle(tx), sans(17, 500), maxLines = 1)
            val meta = snapshot.txMeta(tx, perspectiveAccountId = wallet.id)
            if (meta.isNotEmpty()) T(meta, sans(14), color = palette.mute, maxLines = 1)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (row.incoming) Box(Modifier.padding(end = 6.dp).size(7.dp).background(palette.terra, CircleShape))
            if (tx.scheduleId != null) PathIcon(Glyph.REPEAT, Modifier.padding(end = 6.dp), size = 16.dp, viewport = 16f)
            MoneyText(
                if (row.incoming) formatAmount(row.signed, signed = true) else formatAmount(-row.signed),
                row.currency, style = sans(17, if (row.incoming) 600 else 500),
            )
        }
    }
}
