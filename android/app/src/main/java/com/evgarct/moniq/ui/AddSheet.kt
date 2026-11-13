package com.evgarct.moniq.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evgarct.moniq.data.Account
import com.evgarct.moniq.data.Recurrence
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.data.TxInput
import com.evgarct.moniq.domain.NBSP
import com.evgarct.moniq.domain.currencySymbol
import com.evgarct.moniq.domain.dayCounts
import com.evgarct.moniq.domain.debtTargets
import com.evgarct.moniq.domain.formatAmount
import com.evgarct.moniq.domain.formatMoney
import com.evgarct.moniq.domain.frequencyLabel
import com.evgarct.moniq.domain.incomeWallets
import com.evgarct.moniq.domain.iso
import com.evgarct.moniq.domain.parseDate
import com.evgarct.moniq.domain.recentCategories
import com.evgarct.moniq.domain.roundMoney
import com.evgarct.moniq.domain.shortLabel
import com.evgarct.moniq.domain.spendableWallets
import com.evgarct.moniq.domain.transferTargets
import com.evgarct.moniq.wallet.Notifier
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.util.Locale

private val KINDS = listOf("expense", "income", "transfer", "debt_payment")
private val KIND_LABELS = listOf("Expense", "Income", "Transfer", "Debt")
private val KIND_WORDS = listOf("expense", "income", "transfer", "debt payment")
private val FREQUENCIES = listOf<String?>(null, "daily", "weekly", "monthly", "quarterly", "yearly")

/** `1234,5` as typed becomes `1 234,5` on screen. */
private fun groupTyped(raw: String): String {
    if (raw.isEmpty()) return "0"
    val whole = raw.substringBefore(',')
    val grouped = StringBuilder()
    whole.forEachIndexed { index, char ->
        if (index > 0 && (whole.length - index) % 3 == 0) grouped.append(NBSP)
        grouped.append(char)
    }
    return if (raw.contains(',')) "$grouped,${raw.substringAfter(',')}" else grouped.toString()
}

private fun typedValue(raw: String): Double = raw.replace(',', '.').toDoubleOrNull()?.let(::roundMoney) ?: 0.0

private fun toTyped(value: Double?): String {
    if (value == null || value <= 0) return ""
    val cents = Math.round(value * 100)
    return if (cents % 100 == 0L) (cents / 100).toString() else String.format(Locale.US, "%d,%02d", cents / 100, cents % 100)
}

private fun pressKey(current: String, key: String): String = when (key) {
    "del" -> current.dropLast(1)
    "," -> if (current.contains(',')) current else if (current.isEmpty()) "0," else "$current,"
    else -> when {
        current.contains(',') -> if (current.substringAfter(',').length >= 2) current else current + key
        current == "0" -> key
        current.length >= 9 -> current
        else -> current + key
    }
}

@Composable
fun AddSheet(state: AppState, snapshot: Snapshot) {
    val request = state.add
    val open = state.addOpen && request != null
    if (request == null) return
    val palette = LocalPalette.current
    val haptics = LocalHapticFeedback.current
    val focus = LocalFocusManager.current
    val edit = request.edit
    val series = request.series
    val key = request.token

    // ── Form state, seeded from what is being edited ────────────────────────────────────────
    val seedKind = edit?.kind ?: series?.kind ?: "expense"
    var kind by remember(key) { mutableIntStateOf(KINDS.indexOf(seedKind).coerceAtLeast(0)) }
    val seedCross = (edit?.kind ?: series?.kind) == "transfer" && run {
        val from = snapshot.account(edit?.sourceAccountId ?: series?.sourceAccountId)
        val to = snapshot.account(edit?.destinationAccountId ?: series?.destinationAccountId)
        from != null && to != null && from.currency != to.currency
    }
    val seedDebtSplit = seedKind == "debt_payment"
    var amount by remember(key) {
        mutableStateOf(
            when {
                seedDebtSplit -> toTyped((edit?.principalAmount ?: series?.principalAmount ?: 0.0) + (edit?.extraPrincipalAmount ?: series?.extraPrincipalAmount ?: 0.0))
                else -> toTyped(edit?.amount ?: series?.amount)
            },
        )
    }
    var second by remember(key) {
        mutableStateOf(
            when {
                seedDebtSplit -> toTyped(edit?.interestAmount ?: series?.interestAmount)
                seedCross -> toTyped(edit?.destinationAmount ?: series?.destinationAmount)
                else -> ""
            },
        )
    }
    var activeField by remember(key) { mutableIntStateOf(0) }
    val fromSeed = if (seedKind == "income") edit?.destinationAccountId ?: series?.destinationAccountId else edit?.sourceAccountId ?: series?.sourceAccountId
    var fromId by remember(key) { mutableStateOf(fromSeed) }
    var toId by remember(key) { mutableStateOf(if (seedKind == "income") null else edit?.destinationAccountId ?: series?.destinationAccountId) }
    var categoryId by remember(key) { mutableStateOf(edit?.categoryId ?: series?.categoryId) }
    var goalId by remember(key) { mutableStateOf(edit?.allocationId ?: series?.allocationId) }
    var sourceGoalId by remember(key) { mutableStateOf(edit?.sourceAllocationId ?: series?.sourceAllocationId) }
    var date by remember(key) { mutableStateOf(edit?.occurredAt?.let(::parseDate) ?: series?.startDate?.let(::parseDate) ?: request.date) }
    var paid by remember(key) { mutableStateOf(if (edit != null) edit.status == "paid" else series == null && !request.date.isAfter(LocalDate.now())) }
    var repeat by remember(key) { mutableStateOf(series?.frequency) }
    var ends by remember(key) { mutableStateOf(series?.untilDate?.let(::parseDate)) }
    var note by remember(key) { mutableStateOf(edit?.note ?: series?.note ?: "") }
    var picker by remember(key) { mutableStateOf<String?>(null) }
    var saved by remember(key) { mutableStateOf(false) }
    var noteFocused by remember(key) { mutableStateOf(false) }
    val locked = edit != null || series != null // the kind of an existing entry does not change

    val kindKey = KINDS[kind]
    val fromOptions: List<Account> = remember(snapshot, kindKey) {
        when (kindKey) {
            "income" -> snapshot.incomeWallets()
            "transfer" -> snapshot.transferTargets().filter { it.type != "pension" }
            "debt_payment" -> snapshot.incomeWallets()
            else -> snapshot.spendableWallets()
        }
    }
    // With nothing chosen yet, start from the wallet this kind of entry used last.
    val lastUsedId = remember(snapshot, kindKey) {
        snapshot.transactions.asSequence().filter { it.kind == kindKey }.maxByOrNull { it.createdAt }
            ?.let { if (kindKey == "income") it.destinationAccountId else it.sourceAccountId }
    }
    val from = fromOptions.firstOrNull { it.id == fromId } ?: fromOptions.firstOrNull { it.id == lastUsedId } ?: fromOptions.firstOrNull()
    val toOptions: List<Account> = remember(snapshot, kindKey, from?.id) {
        when (kindKey) {
            "transfer" -> snapshot.transferTargets().filter { it.type != "pension" && it.id != from?.id }
            "debt_payment" -> snapshot.debtTargets()
            else -> emptyList()
        }
    }
    val to = toOptions.firstOrNull { it.id == toId } ?: toOptions.firstOrNull()
    val categoryType = if (kindKey == "income") "income" else "expense"
    val recent = remember(snapshot, categoryType) { snapshot.recentCategories(categoryType, 5) }
    val category = snapshot.category(categoryId)?.takeIf { it.type == categoryType }
    val needsCategory = kindKey == "expense" || kindKey == "income"
    val cross = kindKey == "transfer" && from != null && to != null && from.currency != to.currency
    val debtSplit = kindKey == "debt_payment" && to?.type == "debt"
    val twoFields = cross || debtSplit
    val currency = from?.currency ?: snapshot.defaultCurrency

    // Goals of whichever savings wallet receives or gives the money.
    val destinationWallet = if (kindKey == "income") from else if (kindKey == "transfer") to else null
    val destinationGoals = remember(snapshot, destinationWallet?.id) {
        if (destinationWallet?.type == "saving") snapshot.allocations.filter { it.walletId == destinationWallet.id } else emptyList()
    }
    val sourceWallet = if (kindKey == "expense" || kindKey == "transfer") from else null
    val sourceGoals = remember(snapshot, sourceWallet?.id) {
        if (sourceWallet?.type == "saving") snapshot.allocations.filter { it.walletId == sourceWallet.id } else emptyList()
    }
    val goal = destinationGoals.firstOrNull { it.id == goalId }
    val sourceGoal = sourceGoals.firstOrNull { it.id == sourceGoalId }

    LaunchedEffect(twoFields) { if (!twoFields) activeField = 0 }

    fun save() {
        if (saved) return
        val first = typedValue(amount)
        val other = typedValue(second)
        val problem = when {
            from == null -> "Add a wallet first"
            first <= 0 -> "Enter an amount"
            needsCategory && category == null -> "Choose a category"
            (kindKey == "transfer" || kindKey == "debt_payment") && to == null -> "Choose where it goes"
            cross && other <= 0 -> "Enter the amount received"
            !paid && repeat != null && ends != null && ends!!.isBefore(date) -> "The series ends before it starts"
            else -> null
        }
        if (problem != null) {
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            state.repo.toast(problem)
            return
        }
        from!!
        val total = if (debtSplit) roundMoney(first + other) else first
        val title = when {
            edit != null -> edit.title
            series != null -> series.title
            kindKey == "transfer" -> "Transfer"
            kindKey == "debt_payment" -> to?.name ?: "Debt payment"
            else -> category?.name ?: "Payment"
        }
        val recurring = (series != null || !paid) && repeat != null
        val input = TxInput(
            title = title,
            note = note.trim().ifEmpty { null },
            occurredAt = date.iso(),
            status = if (paid && series == null) "paid" else "planned",
            kind = kindKey,
            amount = total,
            destinationAmount = if (kindKey == "transfer") (if (cross) other else first) else null,
            fxRate = if (cross && first > 0) other / first else null,
            principalAmount = if (kindKey == "debt_payment") first else null,
            interestAmount = if (kindKey == "debt_payment") (if (debtSplit) other else 0.0) else null,
            extraPrincipalAmount = if (kindKey == "debt_payment") 0.0 else null,
            categoryId = if (needsCategory) category?.id else if (kindKey == "debt_payment" || (kindKey == "transfer" && goal != null)) edit?.categoryId ?: series?.categoryId else null,
            sourceAccountId = if (kindKey == "income") null else from.id,
            destinationAccountId = if (kindKey == "income") from.id else to?.id,
            allocationId = if (kindKey == "income" || kindKey == "transfer") goal?.id else null,
            sourceAllocationId = if (kindKey == "expense" || kindKey == "transfer") sourceGoal?.id else null,
            investmentInstrumentId = edit?.investmentInstrumentId,
            investmentUnits = edit?.investmentUnits,
            recurrence = if (recurring) Recurrence(repeat!!, ends?.iso()) else null,
        )
        when {
            series != null -> state.repo.updateSchedule(series, input)
            edit != null -> state.repo.updateTransaction(edit, input)
            else -> state.repo.createTransaction(input)
        }
        focus.clearFocus()
        saved = true
    }

    // Save choreography: terracotta button, check pops, the sheet leaves, then the toast.
    LaunchedEffect(saved) {
        if (saved) {
            delay(520)
            state.addOpen = false
            delay(260)
            val word = if (series != null) "Series" else KIND_WORDS[kind].replaceFirstChar { it.uppercase() }
            state.repo.toast(if (edit != null || series != null) "$word updated" else "$word saved")
        }
    }

    val wordTitle = when {
        series != null -> "Edit series"
        edit != null -> "Edit ${KIND_WORDS[kind]}"
        else -> "New ${KIND_WORDS[kind]}"
    }

    Box(Modifier.fillMaxSize()) {
        Sheet(open = open, onDismiss = { state.addOpen = false }, scrim = .5f, heightFraction = .93f) {
            Column(Modifier.fillMaxSize().imePadding().padding(start = 24.dp, end = 24.dp, bottom = 16.dp)) {
                SheetHeader(wordTitle, onClose = { state.addOpen = false })
                Segmented(
                    KIND_LABELS, kind,
                    onSelect = { index ->
                        if (!locked && index != kind) {
                            kind = index
                            categoryId = null
                            toId = null
                            goalId = null
                            sourceGoalId = null
                            second = ""
                        } else if (locked && index != kind) state.repo.toast("The type of an existing entry cannot change")
                    },
                    modifier = Modifier.fillMaxWidth(),
                )

                // ── Amount ──────────────────────────────────────────────────────────────────
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    if (!twoFields) {
                        val shown = groupTyped(amount)
                        val size by animateFloatAsState(if (shown.length > 8) 56f else if (shown.length > 5) 72f else 92f, tween(250, easing = Motion.Out), label = "amountSize")
                        val tint by animateColorAsState(if (amount.isEmpty()) palette.mute else palette.ink, tween(250), label = "amountTint")
                        Row(verticalAlignment = Alignment.Bottom) {
                            T(shown, serif(92, lineHeight = 1f, tracking = -.035f).copy(fontSize = size.sp, lineHeight = size.sp), Modifier.alignByBaseline(), tint, maxLines = 1)
                            T(currencySymbol(currency), serif(26, lineHeight = 1f), Modifier.alignByBaseline().padding(start = 10.dp), tint, maxLines = 1)
                        }
                    } else {
                        Column(Modifier.fillMaxWidth().rise(key = "two-$kindKey"), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                                AmountField(if (cross) "Sent" else "Principal", groupTyped(amount), currencySymbol(currency), amount.isEmpty(), activeField == 0, Modifier.weight(1f)) { activeField = 0 }
                                PathIcon(
                                    if (cross) Glyph.ARROW_RIGHT else Glyph.PLUS, Modifier.padding(horizontal = 14.dp).padding(bottom = 14.dp),
                                    size = 24.dp, viewport = 24f, stroke = 1.5.dp,
                                )
                                AmountField(
                                    if (cross) "Received" else "Interest", groupTyped(second), currencySymbol(if (cross) to!!.currency else currency),
                                    second.isEmpty(), activeField == 1, Modifier.weight(1f),
                                ) { activeField = 1 }
                            }
                            val first = typedValue(amount)
                            val other = typedValue(second)
                            val line = when {
                                cross && first > 0 && other > 0 -> "1 ${currencySymbol(currency)} = ${String.format(Locale.US, "%.4f", other / first).trimEnd('0').trimEnd('.')} ${currencySymbol(to!!.currency)}"
                                debtSplit && first + other > 0 -> "Total ${formatMoney(roundMoney(first + other), currency)}"
                                else -> ""
                            }
                            T(line, sans(13), Modifier.fillMaxWidth().height(18.dp), palette.mute, maxLines = 1, align = androidx.compose.ui.text.style.TextAlign.Center)
                        }
                    }
                }

                // ── Rows ────────────────────────────────────────────────────────────────────
                Column {
                    FormRow(if (kindKey == "income") "To" else "From", onClick = { picker = "from" }) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            T(from?.name ?: "No wallet", sans(16, 500), Modifier.alignByBaseline(), maxLines = 1)
                            if (from != null) T(formatMoney(from.balance, from.currency), sans(13), Modifier.alignByBaseline().padding(start = 8.dp), palette.mute, maxLines = 1)
                        }
                    }
                    if (sourceGoals.isNotEmpty()) {
                        FormRow("From goal", onClick = { picker = "sourceGoal" }) { T(sourceGoal?.name ?: "Free balance", sans(16, 500), maxLines = 1) }
                    }
                    if (kindKey == "transfer" || kindKey == "debt_payment") {
                        FormRow(if (kindKey == "transfer") "To" else "Toward", Modifier.rise(key = "to-$kindKey"), onClick = { picker = "to" }) {
                            Row(verticalAlignment = Alignment.Bottom) {
                                T(to?.name ?: "Nothing to pay", sans(16, 500), Modifier.alignByBaseline(), maxLines = 1)
                                if (to != null) T(formatMoney(to.balance, to.currency), sans(13), Modifier.alignByBaseline().padding(start = 8.dp), palette.mute, maxLines = 1)
                            }
                        }
                    }
                    if (destinationGoals.isNotEmpty()) {
                        FormRow("Goal", onClick = { picker = "goal" }) { T(goal?.name ?: "Free balance", sans(16, 500), maxLines = 1) }
                    }
                    if (needsCategory) {
                        Row(Modifier.fillMaxWidth().height(46.dp), verticalAlignment = Alignment.CenterVertically) {
                            T("Category", sans(14), color = palette.mute, maxLines = 1)
                            val strip = if (category != null && recent.none { it.id == category.id }) listOf(category) + recent.take(4) else recent
                            Row(
                                Modifier.weight(1f).padding(start = 16.dp).horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(18.dp),
                            ) {
                                strip.forEach { item ->
                                    val selected = item.id == category?.id
                                    val tint by animateColorAsState(if (selected) palette.ink else palette.mute, tween(250), label = "cat")
                                    val under by animateFloatAsState(if (selected) 1f else 0f, tween(250), label = "catLine")
                                    Box(
                                        Modifier.height(44.dp).tap(scale = .96f, haptic = true) { categoryId = item.id }.drawBehind {
                                            drawLine(palette.terra.copy(alpha = under), Offset(0f, size.height - 1.dp.toPx()), Offset(size.width, size.height - 1.dp.toPx()), 2.dp.toPx())
                                        },
                                        contentAlignment = Alignment.Center,
                                    ) { T(item.name, sans(16, 500), color = tint, maxLines = 1) }
                                }
                                if (strip.isEmpty()) Box(Modifier.height(44.dp), contentAlignment = Alignment.Center) { T("None yet", sans(16), color = palette.mute) }
                            }
                            Row(Modifier.height(44.dp).padding(start = 12.dp).tap { picker = "cats" }, verticalAlignment = Alignment.CenterVertically) {
                                T("All", sans(14, 500), color = palette.terraInk)
                                PathIcon(Glyph.CHEVRON, size = 18.dp, viewport = 18f, stroke = 1.6.dp, color = palette.terraInk)
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth().height(46.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        Row(Modifier.height(44.dp).tap(scale = .97f) { picker = "date" }, verticalAlignment = Alignment.CenterVertically) {
                            T(if (series != null) "Starts ${date.shortLabel()}" else date.shortLabel(), sans(14), color = palette.mute, maxLines = 1)
                            PathIcon(Glyph.CHEVRON_DOWN, Modifier.padding(start = 4.dp), size = 16.dp, viewport = 18f, stroke = 1.6.dp)
                        }
                        if (series == null) {
                            Segmented(
                                listOf("Paid", "Planned"), if (paid) 0 else 1, { paid = it == 0 },
                                Modifier.width(164.dp), height = 36.dp, indicator = palette.sheet, onIndicator = palette.ink, durationMs = 450, raised = true,
                            )
                        }
                    }
                    AnimatedVisibility(
                        visible = series != null || !paid,
                        enter = expandVertically(tween(450, easing = Motion.Sheet)) + fadeIn(tween(450)),
                        exit = shrinkVertically(tween(350, easing = Motion.Sheet)) + fadeOut(tween(200)),
                    ) {
                        Column {
                            if (edit == null) {
                                FormRow("Repeat", onClick = { picker = "repeat" }) { T(frequencyLabel(repeat), sans(16, 500)) }
                                AnimatedVisibility(
                                    visible = repeat != null,
                                    enter = expandVertically(tween(450, easing = Motion.Sheet)) + fadeIn(tween(450)),
                                    exit = shrinkVertically(tween(350, easing = Motion.Sheet)) + fadeOut(tween(200)),
                                ) {
                                    FormRow("Ends", onClick = { picker = "ends" }) { T(ends?.shortLabel() ?: "Never", sans(16, 500)) }
                                }
                            }
                        }
                    }
                    PlainField(note, { if (it.length <= 500) note = it }, "Add a note", Modifier.fillMaxWidth().height(46.dp), onFocus = { noteFocused = it })
                }

                // ── Keypad: steps aside while the system keyboard is typing a note ───────────
                AnimatedVisibility(
                    visible = !noteFocused,
                    enter = expandVertically(tween(300, easing = Motion.Out)) + fadeIn(tween(250)),
                    exit = shrinkVertically(tween(250, easing = Motion.Out)) + fadeOut(tween(150)),
                ) {
                    Column(Modifier.padding(top = 8.dp, bottom = 12.dp).offset(x = 0.dp)) {
                        listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf(",", "0", "del")).forEach { rowKeys ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                rowKeys.forEach { keyLabel ->
                                    Key(keyLabel, Modifier.weight(1f)) {
                                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        if (activeField == 1 && twoFields) second = pressKey(second, keyLabel) else amount = pressKey(amount, keyLabel)
                                    }
                                }
                            }
                        }
                    }
                }

                SaveButton(
                    label = if (series != null) "Save series" else if (edit != null) "Save changes" else "Save ${KIND_WORDS[kind]}",
                    saved = saved, onClick = ::save,
                )
            }
        }

        // ── Sub-sheets ──────────────────────────────────────────────────────────────────────
        PickerSheet(
            open = open && picker == "from", title = if (kindKey == "income") "To wallet" else "From wallet",
            options = fromOptions.map { PickerOption(it.id, it.name, formatMoney(it.balance, it.currency), accountGlyph(it)) },
            selected = from?.id, onDismiss = { picker = null },
        ) {
            fromId = it
            sourceGoalId = null
            if (kindKey == "income") goalId = null
            picker = null
        }
        PickerSheet(
            open = open && picker == "to", title = if (kindKey == "transfer") "To wallet" else "Pay toward",
            options = toOptions.map { PickerOption(it.id, it.name, formatMoney(it.balance, it.currency), accountGlyph(it)) },
            selected = to?.id, onDismiss = { picker = null },
        ) {
            toId = it
            goalId = null
            picker = null
        }
        PickerSheet(
            open = open && picker == "goal", title = "Goal",
            options = listOf(PickerOption("", "Free balance", null, Glyph.SAVINGS)) + destinationGoals.map { PickerOption(it.id, it.name, formatAmount(it.amount), Glyph.GOAL) },
            selected = goal?.id ?: "", onDismiss = { picker = null },
        ) {
            goalId = it.ifEmpty { null }
            picker = null
        }
        PickerSheet(
            open = open && picker == "sourceGoal", title = "From goal",
            options = listOf(PickerOption("", "Free balance", null, Glyph.SAVINGS)) + sourceGoals.map { PickerOption(it.id, it.name, formatAmount(it.amount), Glyph.GOAL) },
            selected = sourceGoal?.id ?: "", onDismiss = { picker = null },
        ) {
            sourceGoalId = it.ifEmpty { null }
            picker = null
        }
        PickerSheet(
            open = open && picker == "repeat", title = "Repeat",
            options = FREQUENCIES.filter { series == null || it != null }.map { PickerOption(it ?: "", frequencyLabel(it)) },
            selected = repeat ?: "", onDismiss = { picker = null },
        ) {
            repeat = it.ifEmpty { null }
            if (repeat == null) ends = null
            picker = null
        }
        val counts = remember(snapshot) { snapshot.dayCounts(LocalDate.now()) }
        DateSheet(open = open && picker == "date", title = "Date", selected = date, counts = counts, onDismiss = { picker = null }) {
            date = it
            // A date in the future is a plan; a new entry follows the date unless told otherwise.
            if (edit == null && series == null && it.isAfter(LocalDate.now())) paid = false
            picker = null
        }
        DateSheet(
            open = open && picker == "ends", title = "Ends", selected = ends, counts = emptyMap(), onDismiss = { picker = null },
            clearLabel = "Never ends", onClear = { ends = null; picker = null },
        ) {
            ends = it
            picker = null
        }
        CategorySheet(open = open && picker == "cats", snapshot = snapshot, type = categoryType, selected = category?.id, onDismiss = { picker = null }) {
            categoryId = it.id
            picker = null
        }
    }
}

@Composable
private fun AmountField(label: String, shown: String, symbol: String, empty: Boolean, active: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val line by animateColorAsState(if (active) palette.terra else palette.line, tween(300), label = "fieldLine")
    val tint by animateColorAsState(if (empty) palette.mute else palette.ink, tween(300), label = "fieldTint")
    val fontSize by animateFloatAsState(if (shown.length > 8) 24f else if (shown.length > 5) 30f else 38f, tween(250, easing = Motion.Out), label = "fieldSize")
    Column(
        modifier.tap(scale = .98f, onClick = onClick).drawBehind {
            drawLine(line, Offset(0f, size.height - 1.dp.toPx()), Offset(size.width, size.height - 1.dp.toPx()), 2.dp.toPx())
        }.padding(bottom = 10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Label(label)
        Row(verticalAlignment = Alignment.Bottom) {
            T(shown, serif(38, lineHeight = 1f, tracking = -.025f).copy(fontSize = fontSize.sp, lineHeight = fontSize.sp), Modifier.alignByBaseline(), tint, maxLines = 1)
            T(symbol, serif(16, lineHeight = 1f), Modifier.alignByBaseline().padding(start = 6.dp), tint, maxLines = 1)
        }
    }
}

@Composable
private fun Key(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val fill by animateColorAsState(if (pressed) palette.panel else Color.Transparent, tween(150), label = "keyFill")
    val scale by animateFloatAsState(if (pressed) .94f else 1f, tween(150), label = "keyScale")
    Box(
        modifier.height(52.dp).graphicsLayer {
            scaleX = scale
            scaleY = scale
        }.clip(RoundedCornerShape(26.dp)).background(fill).clickable(source, indication = null, onClickLabel = if (label == "del") "Delete" else label, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (label == "del") PathIcon(Glyph.BACKSPACE, size = 24.dp, viewport = 24f, stroke = 1.6.dp, color = palette.ink)
        else T(label, serif(28, lineHeight = 1f), maxLines = 1)
    }
}

@Composable
fun SaveButton(label: String, saved: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val palette = LocalPalette.current
    val fill by animateColorAsState(if (saved) palette.terra else palette.ink, tween(350), label = "saveFill")
    val pop = remember { Animatable(0f) }
    LaunchedEffect(saved) {
        if (saved) {
            pop.snapTo(0f)
            pop.animateTo(1f, tween(500, easing = Motion.Pop))
        }
    }
    Box(modifier.fillMaxWidth().height(56.dp).tap(enabled = !saved, haptic = true, onClick = onClick).background(fill, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
        if (saved) {
            PathIcon(
                Glyph.CHECK, Modifier.graphicsLayer {
                    alpha = pop.value.coerceIn(0f, 1f)
                    scaleX = .5f + pop.value * .5f
                    scaleY = .5f + pop.value * .5f
                },
                size = 26.dp, viewport = 26f, stroke = 2.dp, color = Color(0xFF191919),
            )
        } else {
            T(label, sans(16, 600), color = palette.bg, maxLines = 1)
        }
    }
}
