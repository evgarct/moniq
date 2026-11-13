package com.evgarct.moniq.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.util.UUID

/**
 * The finance snapshot is the single source of truth, exactly as on the web. The app keeps the last
 * server answer on disk so a cold start paints at once, then replaces it with fresh data.
 *
 * Mutations are optimistic: the predicted snapshot shows immediately, the server's answer replaces
 * it, and a failure restores server truth and tells the user.
 */
class Repo(private val context: Context, val net: Net, val sessions: SessionStore) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val _snapshot = MutableStateFlow<Snapshot?>(null)
    val snapshot: StateFlow<Snapshot?> = _snapshot

    private val _signedIn = MutableStateFlow(sessions.current != null)
    val signedIn: StateFlow<Boolean> = _signedIn

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    private val _loadError = MutableStateFlow<String?>(null)
    val loadError: StateFlow<String?> = _loadError

    private val _toasts = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val toasts: SharedFlow<String> = _toasts

    private val writeLock = Mutex()
    private var pendingMutations = 0
    private var reconciledThisLaunch = false

    init {
        sessions.current?.let { session ->
            scope.launch { _snapshot.value = readCache(session.userId) }
        }
    }

    fun toast(message: String) {
        _toasts.tryEmit(message)
    }

    private fun cacheFile(userId: String) = File(context.filesDir, "snapshot-$userId.json")

    private suspend fun readCache(userId: String): Snapshot? = withContext(Dispatchers.IO) {
        runCatching { parseSnapshot(JSONObject(cacheFile(userId).readText())) }.getOrNull()
    }

    /** Synchronous variant for the notification listener, which may run before any screen. */
    fun cachedSnapshotBlocking(): Snapshot? {
        _snapshot.value?.let { return it }
        val userId = sessions.current?.userId ?: return null
        return runCatching { parseSnapshot(JSONObject(cacheFile(userId).readText())) }.getOrNull()
    }

    private suspend fun accept(json: JSONObject) {
        val parsed = withContext(Dispatchers.Default) { parseSnapshot(json) }
        if (pendingMutations == 0) _snapshot.value = parsed
        val userId = sessions.current?.userId ?: return
        withContext(Dispatchers.IO) { runCatching { cacheFile(userId).writeText(json.toString()) } }
    }

    /** Authenticates and starts loading; the UI calls [completeSignIn] once its transition covers the screen. */
    suspend fun prepareSignIn(email: String, password: String) {
        val session = net.signIn(email, password)
        _snapshot.value = readCache(session.userId)
        reconciledThisLaunch = false
        scope.launch { refresh(silent = true) }
    }

    fun completeSignIn() {
        _signedIn.value = sessions.current != null
    }

    suspend fun signOut() {
        val userId = sessions.current?.userId
        net.signOut()
        withContext(Dispatchers.IO) { userId?.let { cacheFile(it).delete() } }
        _snapshot.value = null
        _loadError.value = null
        _signedIn.value = false
    }

    private fun handleSignedOut() {
        _snapshot.value = null
        _signedIn.value = false
    }

    suspend fun refresh(silent: Boolean = false) {
        if (sessions.current == null) return
        if (!silent) _refreshing.value = true
        try {
            // Recurring series materialise their occurrences server-side; ask once per launch.
            if (!reconciledThisLaunch) {
                reconciledThisLaunch = true
                scope.launch {
                    runCatching { net.api("POST", "/api/finance/schedules/reconcile") }
                        .onSuccess { runCatching { accept(net.api("GET", "/api/finance/snapshot")) } }
                }
            }
            accept(net.api("GET", "/api/finance/snapshot"))
            _loadError.value = null
        } catch (_: SignedOutException) {
            handleSignedOut()
        } catch (error: Exception) {
            _loadError.value = error.message ?: "Could not reach Moniq"
            if (!silent && _snapshot.value != null) toast("Offline. Showing the last synced data.")
        } finally {
            _refreshing.value = false
        }
    }

    /**
     * Runs [call] against the server after showing [predict] at once. Calls are serialised so the
     * snapshot each one returns already contains the earlier ones.
     */
    fun mutate(
        success: String?,
        failure: String,
        predict: (Snapshot) -> Snapshot,
        call: suspend () -> JSONObject,
    ) {
        val before = _snapshot.value
        if (before != null) _snapshot.value = predict(before)
        pendingMutations++
        scope.launch {
            var result: JSONObject? = null
            var error: Exception? = null
            writeLock.withLock {
                try {
                    result = call()
                } catch (caught: Exception) {
                    error = caught
                }
            }
            pendingMutations--
            when (val failureCause = error) {
                null -> {
                    result?.let { accept(it) }
                    success?.let(::toast)
                }
                is SignedOutException -> handleSignedOut()
                else -> {
                    toast(failureCause.message?.takeIf { it.isNotBlank() && it.length < 140 } ?: failure)
                    if (pendingMutations == 0) {
                        // Server truth, not the pre-mutation copy: the write may have landed.
                        runCatching { accept(net.api("GET", "/api/finance/snapshot")) }.onFailure { _snapshot.value = before }
                    }
                }
            }
        }
    }

    // ── Mutations ───────────────────────────────────────────────────────────────────────────

    fun createTransaction(input: TxInput, id: String = UUID.randomUUID().toString(), successMessage: String? = null) {
        mutate(
            success = successMessage,
            failure = "Could not save the transaction",
            predict = { snapshot ->
                if (input.recurrence != null) snapshot
                else snapshot.withTransactions(snapshot.transactions + input.toTx(id)).applyEffect(input.toTx(id), +1)
            },
        ) { net.api("POST", "/api/transactions", input.toJson(), idempotencyKey = if (input.recurrence == null) id else null) }
    }

    /** Blocking create for the wallet-capture worker; the caller owns retries. */
    suspend fun createTransactionNow(input: TxInput, id: String) {
        val json = net.api("POST", "/api/transactions", input.toJson(), idempotencyKey = id)
        accept(json)
    }

    suspend fun markPaidNow(tx: Tx) {
        accept(net.api("POST", "/api/transactions/${tx.id}/mark-paid"))
    }

    fun updateTransaction(tx: Tx, input: TxInput, successMessage: String? = null) {
        mutate(
            success = successMessage,
            failure = "Could not update the transaction",
            predict = { snapshot ->
                val updated = input.toTx(tx.id).copy(
                    createdAt = tx.createdAt,
                    scheduleId = tx.scheduleId,
                    scheduleOccurrenceDate = tx.scheduleOccurrenceDate,
                )
                snapshot.applyEffect(tx, -1).withTransactions(snapshot.transactions.map { if (it.id == tx.id) updated else it }).applyEffect(updated, +1)
            },
        ) { net.api("PATCH", "/api/transactions/${tx.id}", input.toJson(includeRecurrence = false)) }
    }

    fun markPaid(tx: Tx) {
        mutate(
            success = "Marked paid",
            failure = "Could not mark it paid",
            predict = { snapshot ->
                val paid = tx.copy(status = "paid")
                snapshot.withTransactions(snapshot.transactions.map { if (it.id == tx.id) paid else it }).applyEffect(paid, +1)
            },
        ) { net.api("POST", "/api/transactions/${tx.id}/mark-paid") }
    }

    fun markPlanned(tx: Tx) = updateTransaction(tx, tx.toInput(status = "planned"), "Back to planned")

    fun skip(tx: Tx) {
        mutate(
            success = "Skipped",
            failure = "Could not skip it",
            predict = { snapshot -> snapshot.withTransactions(snapshot.transactions.map { if (it.id == tx.id) it.copy(status = "skipped") else it }) },
        ) { net.api("POST", "/api/transactions/${tx.id}/skip") }
    }

    fun reschedule(tx: Tx, date: String) =
        updateTransaction(tx, tx.toInput(status = "planned", occurredAt = date, explicitReschedule = true), "Moved")

    fun delete(tx: Tx) {
        mutate(
            success = "Deleted",
            failure = "Could not delete it",
            predict = { snapshot -> snapshot.applyEffect(tx, -1).withTransactions(snapshot.transactions.filter { it.id != tx.id }) },
        ) { net.api("DELETE", "/api/transactions/${tx.id}") }
    }

    fun setScheduleState(schedule: Schedule, state: String) {
        mutate(
            success = if (state == "paused") "Series paused" else "Series resumed",
            failure = "Could not change the series",
            predict = { snapshot -> snapshot.copy(schedules = snapshot.schedules.map { if (it.id == schedule.id) it.copy(state = state) else it }) },
        ) { net.api("PATCH", "/api/transaction-schedules/${schedule.id}", JSONObject().put("mode", "state").put("state", state)) }
    }

    fun updateSchedule(schedule: Schedule, input: TxInput) {
        mutate(
            success = null,
            failure = "Could not update the series",
            predict = { it },
        ) {
            net.api(
                "PATCH",
                "/api/transaction-schedules/${schedule.id}",
                JSONObject().put("mode", "update").put("values", input.toJson(includeStatus = false)),
            )
        }
    }

    fun deleteSchedule(schedule: Schedule) {
        mutate(
            success = "Series deleted",
            failure = "Could not delete the series",
            predict = { snapshot ->
                snapshot.copy(
                    schedules = snapshot.schedules.filter { it.id != schedule.id },
                    transactions = snapshot.transactions.filter { !(it.scheduleId == schedule.id && it.status != "paid") },
                )
            },
        ) { net.api("DELETE", "/api/transaction-schedules/${schedule.id}") }
    }
}

private fun Snapshot.withTransactions(list: List<Tx>) = copy(transactions = list)

private fun TxInput.toTx(id: String) = Tx(
    id = id,
    title = title,
    note = note,
    occurredAt = occurredAt,
    createdAt = java.time.Instant.now().toString(),
    status = status,
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
    scheduleId = null,
    scheduleOccurrenceDate = null,
    allocationId = allocationId,
    sourceAllocationId = sourceAllocationId,
    systemGenerated = false,
    investmentInstrumentId = investmentInstrumentId,
    investmentUnits = investmentUnits,
)

/**
 * The wallet-balance effect of a paid transaction, applied ([direction] +1) or reverted (-1), so
 * an optimistic screen moves the same way the ledger will. Goal amounts are left to the server.
 */
private fun Snapshot.applyEffect(tx: Tx, direction: Int): Snapshot {
    if (tx.status != "paid") return this
    val deltas = HashMap<String, Double>()
    fun add(id: String?, amount: Double) {
        if (id != null) deltas[id] = (deltas[id] ?: 0.0) + amount * direction
    }
    when (tx.kind) {
        "expense" -> add(tx.sourceAccountId, -tx.amount)
        "income" -> add(tx.destinationAccountId, tx.amount)
        "transfer" -> {
            add(tx.sourceAccountId, -tx.amount)
            add(tx.destinationAccountId, tx.destinationAmount ?: tx.amount)
        }
        "debt_payment" -> {
            add(tx.sourceAccountId, -tx.amount)
            add(tx.destinationAccountId, (tx.principalAmount ?: 0.0) + (tx.extraPrincipalAmount ?: 0.0))
        }
    }
    if (deltas.isEmpty()) return this
    return copy(accounts = accounts.map { account ->
        val delta = deltas[account.id] ?: return@map account
        if (account.type == "pension") account else account.copy(balance = Math.round((account.balance + delta) * 100) / 100.0)
    })
}
