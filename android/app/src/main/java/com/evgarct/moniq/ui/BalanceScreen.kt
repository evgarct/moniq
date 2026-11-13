package com.evgarct.moniq.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.data.Account
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.domain.cashWallets
import com.evgarct.moniq.domain.creditAndDebt
import com.evgarct.moniq.domain.creditAvailable
import com.evgarct.moniq.domain.debtLabel
import com.evgarct.moniq.domain.formatAmount
import com.evgarct.moniq.domain.formatMoney
import com.evgarct.moniq.domain.formatUnits
import com.evgarct.moniq.domain.pensionValue
import com.evgarct.moniq.domain.pensionWallets
import com.evgarct.moniq.domain.positionUnits
import com.evgarct.moniq.domain.positionValue
import com.evgarct.moniq.domain.savingsBlocks
import kotlinx.coroutines.delay

@Composable
fun BalanceScreen(state: AppState, snapshot: Snapshot) {
    val palette = LocalPalette.current
    val cash = remember(snapshot) { snapshot.cashWallets() }
    val savings = remember(snapshot) { snapshot.savingsBlocks() }
    val debts = remember(snapshot) { snapshot.creditAndDebt() }
    val pensions = remember(snapshot) { snapshot.pensionWallets() }
    val positions = snapshot.positions

    CompositionLocalProvider(LocalHideAmounts provides state.hideAmounts) {
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 150.dp)) {
            item(key = "top") {
                Column {
                    StatusBarSpacer()
                    Row(Modifier.fillMaxWidth().padding(top = 20.dp).height(44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        BrandMark()
                        Box(Modifier.offset(x = 10.dp).size(44.dp).tap(label = if (state.hideAmounts) "Show amounts" else "Hide amounts", onClick = state::toggleHide), contentAlignment = Alignment.Center) {
                            val slash by animateFloatAsState(if (state.hideAmounts) 1f else 0f, tween(300), label = "slash")
                            PathIcon(Glyph.EYE, size = 24.dp, viewport = 24f, stroke = 1.6.dp, color = palette.ink)
                            PathIcon(Glyph.SLASH, Modifier.graphicsLayer { alpha = slash }, size = 24.dp, viewport = 24f, stroke = 1.6.dp, color = palette.ink)
                        }
                    }
                    Spacer(Modifier.height(36.dp))
                    Column(Modifier.rise()) {
                        T("Balance", serif(38, lineHeight = 1.04f, tracking = -.02f))
                        T("where you stand.", serif(38, italic = true, lineHeight = 1.04f, tracking = -.02f), color = palette.terra, maxLines = 1)
                    }
                }
            }

            var number = 0
            fun next() = (++number).toString().padStart(2, '0')

            if (cash.isNotEmpty()) {
                val label = next()
                item(key = "cash") {
                    Column(Modifier.padding(top = 48.dp).rise(100)) {
                        SectionHeading(label, "Cash")
                        Spacer(Modifier.height(12.dp))
                        cash.forEach { wallet -> WalletRow(wallet, wallet.balance) { state.walletId = wallet.id } }
                    }
                }
            }

            if (savings.isNotEmpty()) {
                val label = next()
                item(key = "goals") {
                    Column(Modifier.padding(top = 48.dp).rise(200)) {
                        SectionHeading(label, "Goals")
                        Spacer(Modifier.height(12.dp))
                        var bar = 0
                        savings.forEach { block ->
                            WalletRow(block.wallet, block.wallet.balance) { state.walletId = block.wallet.id }
                            Column(Modifier.padding(start = 20.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                                PlainGoalRow("Free", block.free, block.wallet.currency)
                                block.goals.forEach { row ->
                                    val goal = row.allocation
                                    if (row.progress != null && goal.targetAmount != null) {
                                        Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                                            Row(verticalAlignment = Alignment.Bottom) {
                                                Row(Modifier.weight(1f).padding(end = 12.dp).alignByBaseline(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                                    PathIcon(Glyph.GOAL)
                                                    T(goal.name, sans(16, 500), Modifier.weight(1f, fill = false), maxLines = 1)
                                                    if (goal.isDefault) T("Default", sans(13), color = palette.mute, maxLines = 1)
                                                }
                                                MoneyText(formatAmount(goal.amount), block.wallet.currency, Modifier.alignByBaseline(), style = sans(16, 500), veil = true)
                                            }
                                            ProgressLine(row.progress, delayMs = 400 + (bar++) * 100)
                                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                                T("${Math.round(row.progress * 100)}%", sans(12), color = palette.mute)
                                                T(formatAmount(goal.targetAmount), sans(12), Modifier.padding(end = 24.dp).amountVeil(), palette.mute)
                                            }
                                        }
                                    } else {
                                        PlainGoalRow(goal.name + if (goal.isDefault) " · Default" else "", goal.amount, block.wallet.currency)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (debts.isNotEmpty()) {
                val label = next()
                item(key = "debt") {
                    Column(Modifier.padding(top = 48.dp).rise(300)) {
                        SectionHeading(label, "Credit and debt")
                        Spacer(Modifier.height(14.dp))
                        debts.forEach { account ->
                            val subtitle = if (account.type == "credit_card") "${formatMoney(creditAvailable(account), account.currency)} available" else debtLabel(account)
                            DetailRow(
                                icon = accountGlyph(account), title = account.name, subtitle = subtitle, veilSubtitle = account.type == "credit_card",
                                amount = account.balance, currency = account.currency,
                            ) { state.walletId = account.id }
                        }
                    }
                }
            }

            if (pensions.isNotEmpty() || positions.isNotEmpty()) {
                val label = next()
                item(key = "investments") {
                    Column(Modifier.padding(top = 48.dp).rise(400)) {
                        SectionHeading(label, "Investments")
                        Spacer(Modifier.height(14.dp))
                        pensions.forEach { wallet ->
                            DetailRow(Glyph.BANK, wallet.name, "Locked until retirement", false, snapshot.pensionValue(wallet), wallet.currency) { state.walletId = wallet.id }
                        }
                        positions.forEach { position ->
                            val value = snapshot.positionValue(position)
                            val units = formatUnits(snapshot.positionUnits(position))
                            DetailRow(
                                icon = Glyph.TREND, title = position.instrument.name,
                                subtitle = "${position.instrument.ticker} · ${position.instrument.exchange} · $units units", veilSubtitle = false,
                                amount = value, currency = position.quoteCurrency ?: position.instrument.quoteCurrency, onClick = null,
                            )
                        }
                    }
                }
            }

            if (snapshot.accounts.isEmpty()) {
                item(key = "empty") {
                    EmptyDay(Modifier.padding(top = 60.dp), title = "No wallets yet.", body = "Create your first wallet at moniq.fyi and it will appear here.", action = null)
                }
            }
        }
    }
}

@Composable
private fun WalletRow(wallet: Account, amount: Double, onClick: () -> Unit) {
    val shown by animatedAmount(amount)
    Row(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).tap(scale = .98f, label = "Open ${wallet.name}", onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PathIcon(accountGlyph(wallet))
        T(wallet.name, sans(17, 500), Modifier.weight(1f).padding(start = 14.dp, end = 12.dp), maxLines = 1)
        MoneyText(formatAmount(shown), wallet.currency, veil = true)
    }
}

@Composable
private fun PlainGoalRow(name: String, amount: Double, currency: String) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        T(name, sans(16), Modifier.weight(1f).alignByBaseline().padding(end = 12.dp), maxLines = 1)
        MoneyText(formatAmount(amount), currency, Modifier.alignByBaseline(), style = sans(16), color = LocalPalette.current.mute, veil = true)
    }
}

/** Goal progress: a 2dp hairline that grows from the left over 1.2s. */
@Composable
private fun ProgressLine(progress: Float, delayMs: Int) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val grown = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (!reduce) {
            delay(delayMs.toLong())
            grown.animateTo(1f, tween(Motion.COUNT, easing = Motion.Out))
        }
    }
    Box(
        Modifier.fillMaxWidth().height(2.dp).background(palette.line).drawBehind {
            drawLine(palette.ink, Offset(0f, size.height / 2), Offset(size.width * progress * grown.value, size.height / 2), size.height)
        },
    )
}

@Composable
private fun DetailRow(
    icon: String,
    title: String,
    subtitle: String,
    veilSubtitle: Boolean,
    amount: Double?,
    currency: String,
    onClick: (() -> Unit)?,
) {
    val palette = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().then(if (onClick != null) Modifier.tap(scale = .98f, onClick = onClick) else Modifier).padding(vertical = 12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        PathIcon(icon, Modifier.padding(top = 2.dp))
        Column(Modifier.weight(1f).padding(start = 14.dp, end = 16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            T(title, sans(17, 500), maxLines = 1)
            T(subtitle, sans(14), if (veilSubtitle) Modifier.amountVeil() else Modifier, palette.mute, maxLines = 1)
        }
        if (amount != null) {
            val shown by animatedAmount(amount)
            MoneyText(formatAmount(shown), currency, veil = true)
        } else {
            T("No quote", sans(14), color = palette.mute)
        }
    }
}
