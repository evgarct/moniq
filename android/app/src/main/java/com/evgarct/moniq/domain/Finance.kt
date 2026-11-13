package com.evgarct.moniq.domain

import com.evgarct.moniq.data.Account
import com.evgarct.moniq.data.Allocation
import com.evgarct.moniq.data.Category
import com.evgarct.moniq.data.Position
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.data.Tx
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToLong

/**
 * Pure selectors over the finance snapshot. Amounts in different currencies are never summed.
 * Wallets keep the snapshot's own order (newest first), the order the web app lists them in.
 */

const val NBSP = ' '
const val MINUS = '−'

fun roundMoney(value: Double): Double = (value * 100).roundToLong() / 100.0

fun currencySymbol(code: String): String = when (code.uppercase()) {
    "CZK" -> "Kč"
    "EUR" -> "€"
    "USD" -> "$"
    "RUB" -> "₽"
    "GBP" -> "£"
    "PLN" -> "zł"
    "CHF" -> "Fr"
    else -> code.uppercase()
}

/** `1 234` or `59,59`: cents appear only when the amount has them, so nothing is rounded away. */
fun formatAmount(value: Double, signed: Boolean = false): String {
    val cents = (abs(value) * 100).roundToLong()
    val whole = cents / 100
    val fraction = (cents % 100).toInt()
    val digits = whole.toString()
    val grouped = StringBuilder()
    digits.forEachIndexed { index, char ->
        if (index > 0 && (digits.length - index) % 3 == 0) grouped.append(NBSP)
        grouped.append(char)
    }
    if (fraction != 0) grouped.append(',').append(fraction.toString().padStart(2, '0'))
    val sign = when {
        cents == 0L -> ""
        value < 0 -> MINUS.toString()
        signed -> "+"
        else -> ""
    }
    return sign + grouped
}

fun formatMoney(value: Double, currency: String, signed: Boolean = false): String =
    "${formatAmount(value, signed)}$NBSP${currencySymbol(currency)}"

fun formatUnits(value: Double): String = String.format(Locale.US, "%.2f", value).trimEnd('0').trimEnd('.')

private val ISO: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
fun LocalDate.iso(): String = format(ISO)
fun parseDate(value: String): LocalDate? = runCatching { LocalDate.parse(value.take(10)) }.getOrNull()

private val DAY_LONG = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.ENGLISH)
private val DAY_SHORT = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH)
private val HEADER = DateTimeFormatter.ofPattern("EEEE · d MMMM yyyy", Locale.ENGLISH)
private val MONTH = DateTimeFormatter.ofPattern("MMMM", Locale.ENGLISH)
private val MONTH_YEAR = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)
private val WEEKDAY = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH)

fun LocalDate.longLabel(): String = format(DAY_LONG)
fun LocalDate.shortLabel(): String = format(DAY_SHORT)
fun LocalDate.headerLabel(): String = format(HEADER)
fun LocalDate.monthName(): String = format(MONTH)
fun LocalDate.monthYear(): String = format(MONTH_YEAR)
fun LocalDate.weekdayShort(): String = format(WEEKDAY)

fun Snapshot.txCurrency(tx: Tx): String =
    (account(tx.sourceAccountId) ?: account(tx.destinationAccountId))?.currency ?: defaultCurrency

fun Snapshot.txTitle(tx: Tx): String {
    category(tx.categoryId)?.let { return it.name }
    return when (tx.kind) {
        "transfer" -> "Transfer"
        "debt_payment" -> account(tx.destinationAccountId)?.name ?: "Debt payment"
        else -> tx.title.ifBlank { "Uncategorized" }
    }
}

/** Second line of a row: wallet, counterparty and the user's own words, in that order. */
fun Snapshot.txMeta(tx: Tx, perspectiveAccountId: String? = null): String {
    val parts = ArrayList<String>(4)
    val source = account(tx.sourceAccountId)
    val destination = account(tx.destinationAccountId)
    val goal = allocation(tx.allocationId)
    when (tx.kind) {
        "transfer", "debt_payment" -> {
            if (perspectiveAccountId != null && perspectiveAccountId == tx.destinationAccountId) {
                source?.let { parts += "From ${it.name}" }
            } else {
                if (perspectiveAccountId == null) source?.let { parts += it.name }
                destination?.let { parts += "To ${it.name}" }
            }
            goal?.let { parts += it.name }
        }
        "income" -> {
            if (perspectiveAccountId == null) destination?.let { parts += it.name } else parts += "Income"
            goal?.let { parts += it.name }
        }
        else -> if (perspectiveAccountId == null) source?.let { parts += it.name }
    }
    val heading = txTitle(tx)
    if (tx.title.isNotBlank() && !tx.title.equals(heading, ignoreCase = true) && tx.kind != "transfer") parts += tx.title
    tx.note?.takeIf { it.isNotBlank() }?.let { parts += it.replace('\n', ' ') }
    return parts.joinToString(" · ")
}

fun Snapshot.txIcon(tx: Tx): String? = when (tx.kind) {
    "transfer" -> "@transfer"
    "debt_payment" -> "@debt"
    else -> category(tx.categoryId)?.icon
}

data class DayItems(val planned: List<Tx>, val confirmed: List<Tx>)

/** A day's agenda. Today also carries every overdue plan, so nothing planned can fall off screen. */
fun Snapshot.dayItems(date: LocalDate, today: LocalDate): DayItems {
    val key = date.iso()
    val todayKey = today.iso()
    val planned = transactions.filter {
        it.status == "planned" && (it.occurredAt == key || (key == todayKey && it.occurredAt < todayKey))
    }.sortedWith(compareBy({ it.occurredAt }, { it.createdAt }))
    val confirmed = transactions.filter { it.status == "paid" && it.occurredAt == key }.sortedByDescending { it.createdAt }
    return DayItems(planned, confirmed)
}

data class DayCount(val planned: Int, val recorded: Int)

fun Snapshot.dayCounts(today: LocalDate): Map<String, DayCount> {
    val todayKey = today.iso()
    val planned = HashMap<String, Int>()
    val recorded = HashMap<String, Int>()
    for (tx in transactions) {
        when (tx.status) {
            "planned" -> {
                val key = if (tx.occurredAt < todayKey) todayKey else tx.occurredAt
                planned[key] = (planned[key] ?: 0) + 1
            }
            "paid" -> recorded[tx.occurredAt] = (recorded[tx.occurredAt] ?: 0) + 1
        }
    }
    return (planned.keys + recorded.keys).associateWith { DayCount(planned[it] ?: 0, recorded[it] ?: 0) }
}

// ── Balance ─────────────────────────────────────────────────────────────────────────────────

data class GoalRow(val allocation: Allocation, val progress: Float?)
data class SavingsBlock(val wallet: Account, val free: Double, val goals: List<GoalRow>)

fun Snapshot.cashWallets(): List<Account> = accounts.filter { it.type == "cash" }
fun Snapshot.savingsBlocks(): List<SavingsBlock> = accounts.filter { it.type == "saving" }.sortedBy { it.createdAt }.map { wallet ->
    val own = allocations.filter { it.walletId == wallet.id }
    val reserved = own.sumOf { it.amount }
    SavingsBlock(
        wallet = wallet,
        free = roundMoney(wallet.balance - reserved),
        goals = own.sortedWith(compareByDescending<Allocation> { it.targetAmount != null }.thenByDescending { it.amount }).map { goal ->
            val target = goal.targetAmount
            GoalRow(goal, if (target != null && target > 0) (goal.amount / target).coerceIn(0.0, 1.0).toFloat() else null)
        },
    )
}

fun Snapshot.creditAndDebt(): List<Account> =
    accounts.filter { it.type == "credit_card" || it.type == "debt" }.sortedBy { it.type != "credit_card" }

fun creditAvailable(account: Account): Double {
    val limit = (account.creditLimit ?: abs(account.balance)).coerceAtLeast(0.0)
    return roundMoney((limit - abs(account.balance)).coerceAtLeast(0.0))
}

fun debtLabel(account: Account): String = when (account.debtKind) {
    "mortgage" -> "Mortgage"
    "loan" -> "Loan"
    "personal" -> "Personal debt"
    else -> "Debt"
}

fun Snapshot.pensionWallets(): List<Account> = accounts.filter { it.type == "pension" }
/** Latest statement plus everything paid in since, mirroring `pensionBalance` on the web. */
fun Snapshot.pensionValue(wallet: Account): Double {
    val state = wallet.pensionState ?: return wallet.balance
    val statements = state.optJSONArray("statements") ?: return wallet.balance
    var asOf = ""
    var total = 0.0
    for (i in 0 until statements.length()) {
        val statement = statements.optJSONObject(i) ?: continue
        val date = statement.optString("as_of")
        if (date >= asOf) {
            asOf = date
            total = statement.optDouble("total_value", 0.0)
        }
    }
    if (asOf.isEmpty()) return wallet.balance
    var external = 0.0
    state.optJSONArray("entries")?.let { entries ->
        for (i in 0 until entries.length()) {
            val entry = entries.optJSONObject(i) ?: continue
            val source = entry.optString("source")
            if ((source == "employer" || source == "state") && entry.optString("occurred_at") > asOf) external += entry.optDouble("amount", 0.0)
        }
    }
    val own = transactions.filter { it.destinationAccountId == wallet.id && it.status == "paid" && it.occurredAt > asOf }
        .sumOf { it.destinationAmount ?: it.amount }
    return roundMoney(total + external + own)
}

fun Snapshot.positionUnits(position: Position): Double = position.openingUnits + transactions.sumOf { tx ->
    if (tx.status == "paid" && tx.kind == "expense" && tx.investmentInstrumentId == position.instrumentId) tx.investmentUnits ?: 0.0 else 0.0
}

fun Snapshot.positionValue(position: Position): Double? = position.quotePrice?.let { roundMoney(positionUnits(position) * it) }

// ── Wallet history ──────────────────────────────────────────────────────────────────────────

data class HistoryRow(val tx: Tx, val signed: Double, val currency: String, val incoming: Boolean)
data class HistoryDay(val date: LocalDate, val rows: List<HistoryRow>)

fun Snapshot.walletHistory(wallet: Account, month: LocalDate): List<HistoryDay> {
    val prefix = month.iso().take(7)
    val rows = transactions.filter {
        it.status == "paid" && it.occurredAt.startsWith(prefix) && (it.sourceAccountId == wallet.id || it.destinationAccountId == wallet.id)
    }
    return rows.groupBy { it.occurredAt }.toSortedMap(compareByDescending { it }).mapNotNull { (day, list) ->
        val date = parseDate(day) ?: return@mapNotNull null
        HistoryDay(date, list.sortedByDescending { it.createdAt }.map { tx ->
            val incoming = tx.destinationAccountId == wallet.id && tx.sourceAccountId != wallet.id
            val amount = if (incoming) walletInflow(tx) else tx.amount
            HistoryRow(tx, if (incoming) amount else -amount, wallet.currency, incoming)
        })
    }
}

/** What actually lands in the destination wallet: debt payments reduce the debt by principal only. */
private fun walletInflow(tx: Tx): Double = when (tx.kind) {
    "debt_payment" -> (tx.principalAmount ?: 0.0) + (tx.extraPrincipalAmount ?: 0.0)
    "transfer" -> tx.destinationAmount ?: tx.amount
    else -> tx.amount
}

fun Snapshot.monthsWithActivity(wallet: Account, today: LocalDate): List<LocalDate> {
    val months = transactions.asSequence()
        .filter { it.status == "paid" && (it.sourceAccountId == wallet.id || it.destinationAccountId == wallet.id) }
        .map { it.occurredAt.take(7) }.toSortedSet()
    months += today.iso().take(7)
    return months.mapNotNull { parseDate("$it-01") }.sortedDescending()
}

// ── Categories ──────────────────────────────────────────────────────────────────────────────

data class CategoryGroup(val parent: Category?, val leaves: List<Category>)

fun Snapshot.selectableCategories(type: String): List<Category> {
    val parents = categories.mapNotNull { it.parentId }.toSet()
    return categories.filter { it.type == type && !it.isSystem && it.id !in parents }
}

fun Snapshot.categoryGroups(type: String): List<CategoryGroup> {
    val leaves = selectableCategories(type)
    val roots = categories.filter { it.type == type && !it.isSystem && it.parentId == null }
    val groups = roots.mapNotNull { root ->
        val children = leaves.filter { leaf -> isDescendant(leaf, root) }.sortedBy { it.name.lowercase() }
        if (children.isEmpty()) null else CategoryGroup(root, children)
    }
    val standalone = leaves.filter { it.parentId == null }.sortedBy { it.name.lowercase() }
    return if (standalone.isEmpty()) groups else groups + CategoryGroup(null, standalone)
}

private fun Snapshot.isDescendant(leaf: Category, root: Category): Boolean {
    var cursor = leaf.parentId
    var guard = 0
    while (cursor != null && guard++ < 12) {
        if (cursor == root.id) return true
        cursor = category(cursor)?.parentId
    }
    return false
}

fun Snapshot.categoryPath(category: Category): String {
    val parent = category(category.parentId) ?: return category.name
    return "${parent.name} › ${category.name}"
}

/** Leaves the user reached for most recently, newest first. */
fun Snapshot.recentCategories(type: String, limit: Int = 5): List<Category> {
    val kind = if (type == "income") "income" else "expense"
    val allowed = selectableCategories(type).associateBy { it.id }
    val seen = LinkedHashSet<String>()
    for (tx in transactions.asSequence().filter { it.kind == kind && it.categoryId != null }.sortedByDescending { it.createdAt }) {
        val id = tx.categoryId ?: continue
        if (id in allowed) seen += id
        if (seen.size >= limit) break
    }
    val recent = seen.mapNotNull { allowed[it] }
    return if (recent.size >= limit) recent else (recent + allowed.values.filter { it.id !in seen }.sortedBy { it.name.lowercase() }).take(limit)
}

fun Snapshot.spendableWallets(): List<Account> =
    accounts.filter { it.type == "cash" || it.type == "credit_card" || it.type == "saving" }
        .sortedWith(compareBy({ it.type != "cash" }, { it.type == "saving" }))

fun Snapshot.incomeWallets(): List<Account> = accounts.filter { it.type == "cash" || it.type == "saving" }
    .sortedBy { it.type != "cash" }

fun Snapshot.transferTargets(): List<Account> = accounts.filter { it.type == "cash" || it.type == "saving" || it.type == "pension" }
    .sortedWith(compareBy({ it.type != "cash" }, { it.type == "pension" }))

fun Snapshot.debtTargets(): List<Account> = accounts.filter { it.type == "credit_card" || it.type == "debt" }
    .sortedBy { it.type != "credit_card" }

fun frequencyLabel(frequency: String?): String = when (frequency) {
    null -> "Never"
    "daily" -> "Daily"
    "weekly" -> "Weekly"
    "monthly" -> "Monthly"
    "quarterly" -> "Quarterly"
    "yearly" -> "Yearly"
    else -> "Custom"
}
