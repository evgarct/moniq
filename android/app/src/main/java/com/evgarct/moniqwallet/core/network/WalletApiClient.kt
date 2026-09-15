package com.evgarct.moniqwallet.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WalletApiException(val code: Int, message: String) : Exception(message)

data class PickerOption(val id: String, val name: String)

data class FinanceContext(val wallets: List<PickerOption>, val categories: List<PickerOption>)

/**
 * Talks to Gabi's /api/wallet-notification (and its read-only /context sibling), which
 * does the actual parsing (Gemini) and Moniq write. This app never parses or holds Moniq
 * data itself beyond what's needed to populate the manual-edit pickers.
 */
class WalletApiClient(private val baseUrl: String, private val secret: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private fun requireConfigured() {
        if (baseUrl.isBlank() || secret.isBlank()) {
            throw WalletApiException(0, "WALLET_WEBHOOK_URL/SECRET not configured (see local.properties.example)")
        }
    }

    suspend fun postNotification(
        title: String?,
        text: String?,
        postedAt: Long,
        walletId: String? = null,
        categoryId: String? = null,
    ) {
        requireConfigured()
        val body = JSONObject().apply {
            put("title", title ?: JSONObject.NULL)
            put("text", text ?: JSONObject.NULL)
            put("postedAt", postedAt)
            if (walletId != null) put("walletId", walletId)
            if (categoryId != null) put("categoryId", categoryId)
        }

        val request = Request.Builder()
            .url(baseUrl)
            .header("Authorization", "Bearer $secret")
            .post(body.toString().toRequestBody(jsonMediaType))
            .build()

        withContext(Dispatchers.IO) {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw WalletApiException(response.code, response.body?.string().orEmpty())
                }
            }
        }
    }

    // baseUrl is the notification-post endpoint; the context endpoint is its "context" sibling.
    suspend fun fetchFinanceContext(): FinanceContext {
        requireConfigured()
        val contextUrl = baseUrl.trimEnd('/') + "/context"
        val request = Request.Builder()
            .url(contextUrl)
            .header("Authorization", "Bearer $secret")
            .get()
            .build()

        return withContext(Dispatchers.IO) {
            client.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw WalletApiException(response.code, bodyText)
                }
                val json = JSONObject(bodyText)
                FinanceContext(
                    wallets = parseOptions(json.optJSONArray("wallets")) { o ->
                        val name = o.optString("name", "").ifBlank { return@parseOptions null }
                        val currency = o.optString("currency", "")
                        name + if (currency.isNotBlank()) " ($currency)" else ""
                    },
                    // Only leaf/selectable expense categories — the top-level group rows
                    // (e.g. "Enjoy Life") aren't valid create_transactions targets, and a
                    // Wallet card payment is always an expense. Use the full "Group / Name"
                    // path as the label so same-named leaves under different groups stay
                    // distinguishable.
                    categories = parseOptions(json.optJSONArray("categories")) { o ->
                        if (o.optString("type") != "expense" || !o.optBoolean("is_selectable", false)) {
                            return@parseOptions null
                        }
                        o.optString("path", "").ifBlank { o.optString("name", "") }
                    },
                )
            }
        }
    }

    private fun parseOptions(array: JSONArray?, label: (JSONObject) -> String?): List<PickerOption> {
        if (array == null) return emptyList()
        return (0 until array.length()).mapNotNull { i ->
            val o = array.optJSONObject(i) ?: return@mapNotNull null
            val id = o.optString("id", "").ifBlank { return@mapNotNull null }
            val name = label(o)?.ifBlank { null } ?: return@mapNotNull null
            PickerOption(id, name)
        }
    }
}
