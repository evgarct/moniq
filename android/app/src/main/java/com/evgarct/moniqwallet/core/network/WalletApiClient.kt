package com.evgarct.moniqwallet.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class WalletApiException(val code: Int, message: String) : Exception(message)

/**
 * Posts a captured Google Wallet notification to Gabi's /api/wallet-notification
 * webhook, which does the actual parsing (Gemini) and Moniq write.
 */
class WalletApiClient(private val baseUrl: String, private val secret: String) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun postNotification(title: String?, text: String?, postedAt: Long) {
        if (baseUrl.isBlank() || secret.isBlank()) {
            throw WalletApiException(0, "WALLET_WEBHOOK_URL/SECRET not configured (see local.properties.example)")
        }

        val body = JSONObject().apply {
            put("title", title ?: JSONObject.NULL)
            put("text", text ?: JSONObject.NULL)
            put("postedAt", postedAt)
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
}
