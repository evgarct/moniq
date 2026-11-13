package com.evgarct.moniq.data

import org.json.JSONArray
import org.json.JSONObject

/** Mirrors `types/finance.ts`; only the fields the app reads or sends back. */

data class Account(
    val id: String,
    val name: String,
    val type: String, // cash | saving | credit_card | debt | pension
    val debtKind: String?,
    val balance: Double,
    val creditLimit: Double?,
    val currency: String,
    val createdAt: String,
    val pensionState: JSONObject?,
)

data class Category(
    val id: String,
    val name: String,
    val icon: String?,
    val type: String, // income | expense
    val parentId: String?,
    val isSystem: Boolean,
    val purpose: String?,
    val isContribution: Boolean,
)

data class Allocation(
    val id: String,
    val walletId: String,
    val name: String,
    val kind: String, // goal_open | goal_targeted
    val amount: Double,
    val targetAmount: Double?,
    val isDefault: Boolean,
)

data class Schedule(
    val id: String,
    val title: String,
    val note: String?,
    val startDate: String,
    val frequency: String,
    val intervalCount: Int,
    val intervalUnit: String,
    val untilDate: String?,
    val state: String, // active | paused
    val kind: String,
    val amount: Double,
    val destinationAmount: Double?,
    val fxRate: Double?,
    val principalAmount: Double?,
    val interestAmount: Double?,
    val extraPrincipalAmount: Double?,
    val categoryId: String?,
    val sourceAccountId: String?,
    val destinationAccountId: String?,
    val allocationId: String?,
    val sourceAllocationId: String?,
)

data class Tx(
    val id: String,
    val title: String,
    val note: String?,
    val occurredAt: String, // yyyy-MM-dd
    val createdAt: String,
    val status: String, // planned | paid | skipped
    val kind: String, // income | expense | transfer | debt_payment
    val amount: Double,
    val destinationAmount: Double?,
    val fxRate: Double?,
    val principalAmount: Double?,
    val interestAmount: Double?,
    val extraPrincipalAmount: Double?,
    val categoryId: String?,
    val sourceAccountId: String?,
    val destinationAccountId: String?,
    val scheduleId: String?,
    val scheduleOccurrenceDate: String?,
    val allocationId: String?,
    val sourceAllocationId: String?,
    val systemGenerated: Boolean,
    val investmentInstrumentId: String?,
    val investmentUnits: Double?,
)

data class Instrument(val id: String, val name: String, val ticker: String, val exchange: String, val quoteCurrency: String)

data class Position(
    val id: String,
    val instrumentId: String,
    val openingUnits: Double,
    val instrument: Instrument,
    val quotePrice: Double?,
    val quoteCurrency: String?,
    val quoteDate: String?,
)

data class Snapshot(
    val accounts: List<Account>,
    val categories: List<Category>,
    val schedules: List<Schedule>,
    val transactions: List<Tx>,
    val allocations: List<Allocation>,
    val positions: List<Position>,
    val defaultCurrency: String,
) {
    private val accountIndex by lazy { accounts.associateBy { it.id } }
    private val categoryIndex by lazy { categories.associateBy { it.id } }
    private val scheduleIndex by lazy { schedules.associateBy { it.id } }
    private val allocationIndex by lazy { allocations.associateBy { it.id } }

    fun account(id: String?) = id?.let { accountIndex[it] }
    fun category(id: String?) = id?.let { categoryIndex[it] }
    fun schedule(id: String?) = id?.let { scheduleIndex[it] }
    fun allocation(id: String?) = id?.let { allocationIndex[it] }
}

private fun JSONObject.str(key: String): String? = if (isNull(key)) null else optString(key).takeIf { has(key) }
private fun JSONObject.num(key: String): Double? = if (isNull(key) || !has(key)) null else optDouble(key).takeIf { !it.isNaN() }
private fun JSONObject.obj(key: String): JSONObject? = if (isNull(key)) null else optJSONObject(key)
private inline fun <T> JSONArray?.mapObjects(block: (JSONObject) -> T?): List<T> {
    if (this == null) return emptyList()
    val out = ArrayList<T>(length())
    for (i in 0 until length()) optJSONObject(i)?.let { o -> block(o)?.let(out::add) }
    return out
}

fun parseSnapshot(json: JSONObject): Snapshot {
    val accounts = json.optJSONArray("accounts").mapObjects { o ->
        Account(
            id = o.getString("id"),
            name = o.optString("name"),
            type = o.optString("type"),
            debtKind = o.str("debt_kind"),
            balance = o.num("balance") ?: 0.0,
            creditLimit = o.num("credit_limit"),
            currency = o.optString("currency"),
            createdAt = o.optString("created_at"),
            pensionState = o.obj("pension_state"),
        )
    }
    val categories = json.optJSONArray("categories").mapObjects { o ->
        Category(
            id = o.getString("id"),
            name = o.optString("name"),
            icon = o.str("icon"),
            type = o.optString("type"),
            parentId = o.str("parent_id"),
            isSystem = o.optBoolean("is_system", false),
            purpose = o.str("purpose"),
            isContribution = o.optBoolean("is_contribution", false),
        )
    }
    val allocations = json.optJSONArray("allocations").mapObjects { o ->
        Allocation(
            id = o.getString("id"),
            walletId = o.optString("wallet_id"),
            name = o.optString("name"),
            kind = o.optString("kind"),
            amount = o.num("amount") ?: 0.0,
            targetAmount = o.num("target_amount"),
            isDefault = o.optBoolean("is_default", false),
        )
    }
    val schedules = json.optJSONArray("schedules").mapObjects { o ->
        Schedule(
            id = o.getString("id"),
            title = o.optString("title"),
            note = o.str("note"),
            startDate = o.optString("start_date"),
            frequency = o.optString("frequency"),
            intervalCount = o.optInt("interval_count", 1),
            intervalUnit = o.optString("interval_unit", "month"),
            untilDate = o.str("until_date"),
            state = o.optString("state", "active"),
            kind = o.optString("kind"),
            amount = o.num("amount") ?: 0.0,
            destinationAmount = o.num("destination_amount"),
            fxRate = o.num("fx_rate"),
            principalAmount = o.num("principal_amount"),
            interestAmount = o.num("interest_amount"),
            extraPrincipalAmount = o.num("extra_principal_amount"),
            categoryId = o.str("category_id"),
            sourceAccountId = o.str("source_account_id"),
            destinationAccountId = o.str("destination_account_id"),
            allocationId = o.str("allocation_id"),
            sourceAllocationId = o.str("source_allocation_id"),
        )
    }
    val transactions = json.optJSONArray("transactions").mapObjects { o ->
        Tx(
            id = o.getString("id"),
            title = o.optString("title"),
            note = o.str("note"),
            occurredAt = o.optString("occurred_at").take(10),
            createdAt = o.optString("created_at"),
            status = o.optString("status"),
            kind = o.optString("kind"),
            amount = o.num("amount") ?: 0.0,
            destinationAmount = o.num("destination_amount"),
            fxRate = o.num("fx_rate"),
            principalAmount = o.num("principal_amount"),
            interestAmount = o.num("interest_amount"),
            extraPrincipalAmount = o.num("extra_principal_amount"),
            categoryId = o.str("category_id"),
            sourceAccountId = o.str("source_account_id"),
            destinationAccountId = o.str("destination_account_id"),
            scheduleId = o.str("schedule_id"),
            scheduleOccurrenceDate = o.str("schedule_occurrence_date"),
            allocationId = o.str("allocation_id"),
            sourceAllocationId = o.str("source_allocation_id"),
            systemGenerated = o.optBoolean("system_generated", false),
            investmentInstrumentId = o.str("investment_instrument_id"),
            investmentUnits = o.num("investment_units"),
        )
    }
    val positions = json.optJSONArray("investment_positions").mapObjects { o ->
        val instrument = o.obj("instrument") ?: return@mapObjects null
        val quote = o.obj("latest_quote")
        Position(
            id = o.getString("id"),
            instrumentId = o.optString("instrument_id"),
            openingUnits = o.num("opening_units") ?: 0.0,
            instrument = Instrument(
                id = instrument.optString("id"),
                name = instrument.optString("name"),
                ticker = instrument.optString("ticker"),
                exchange = instrument.optString("exchange"),
                quoteCurrency = instrument.optString("quote_currency"),
            ),
            quotePrice = quote?.num("price"),
            quoteCurrency = quote?.str("currency"),
            quoteDate = quote?.str("market_date"),
        )
    }
    return Snapshot(
        accounts = accounts,
        categories = categories,
        schedules = schedules,
        transactions = transactions,
        allocations = allocations,
        positions = positions,
        defaultCurrency = json.obj("preferences")?.str("default_currency") ?: "EUR",
    )
}

/** The complete body the transaction routes expect (`transactionFieldShape`). */
data class TxInput(
    val title: String,
    val note: String?,
    val occurredAt: String,
    val status: String,
    val kind: String,
    val amount: Double,
    val destinationAmount: Double? = null,
    val fxRate: Double? = null,
    val principalAmount: Double? = null,
    val interestAmount: Double? = null,
    val extraPrincipalAmount: Double? = null,
    val categoryId: String? = null,
    val sourceAccountId: String? = null,
    val destinationAccountId: String? = null,
    val allocationId: String? = null,
    val sourceAllocationId: String? = null,
    val investmentInstrumentId: String? = null,
    val investmentUnits: Double? = null,
    val isExplicitReschedule: Boolean = false,
    val recurrence: Recurrence? = null,
) {
    fun toJson(includeStatus: Boolean = true, includeRecurrence: Boolean = true): JSONObject = JSONObject().apply {
        put("title", title)
        put("note", note ?: JSONObject.NULL)
        put("occurred_at", occurredAt)
        if (includeStatus) put("status", status)
        put("kind", kind)
        put("amount", amount)
        put("destination_amount", destinationAmount ?: JSONObject.NULL)
        put("fx_rate", fxRate ?: JSONObject.NULL)
        put("principal_amount", principalAmount ?: JSONObject.NULL)
        put("interest_amount", interestAmount ?: JSONObject.NULL)
        put("extra_principal_amount", extraPrincipalAmount ?: JSONObject.NULL)
        put("category_id", categoryId ?: JSONObject.NULL)
        put("source_account_id", sourceAccountId ?: JSONObject.NULL)
        put("destination_account_id", destinationAccountId ?: JSONObject.NULL)
        put("allocation_id", allocationId ?: JSONObject.NULL)
        put("source_allocation_id", sourceAllocationId ?: JSONObject.NULL)
        put("investment_instrument_id", investmentInstrumentId ?: JSONObject.NULL)
        put("investment_units", investmentUnits ?: JSONObject.NULL)
        if (isExplicitReschedule) put("is_explicit_reschedule", true)
        if (includeRecurrence && recurrence != null) put("recurrence", recurrence.toJson())
    }
}

data class Recurrence(val frequency: String, val untilDate: String?) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("frequency", frequency)
        put("until_date", untilDate ?: JSONObject.NULL)
    }
}

fun Tx.toInput(
    status: String = this.status,
    occurredAt: String = this.occurredAt,
    explicitReschedule: Boolean = false,
) = TxInput(
    title = title,
    note = note,
    occurredAt = occurredAt,
    status = if (status == "skipped") "planned" else status,
    kind = kind,
    amount = amount,
    destinationAmount = destinationAmount,
    fxRate = fxRate,
    principalAmount = principalAmount,
    interestAmount = interestAmount,
    extraPrincipalAmount = extraPrincipalAmount,
    categoryId = categoryId,
    sourceAccountId = sourceAccountId,
    destinationAccountId = destinationAccountId,
    allocationId = allocationId,
    sourceAllocationId = sourceAllocationId,
    investmentInstrumentId = investmentInstrumentId,
    investmentUnits = investmentUnits,
    isExplicitReschedule = explicitReschedule,
)
