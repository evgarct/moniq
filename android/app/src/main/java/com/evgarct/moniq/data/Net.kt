package com.evgarct.moniq.data

import android.content.Context
import com.evgarct.moniq.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(message: String, val status: Int = 0) : IOException(message)
class SignedOutException : IOException("Signed out")

private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()

data class Session(
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long, // epoch seconds
    val userId: String,
    val email: String,
)

/** The signed-in Supabase session, kept in app-private storage. */
class SessionStore(context: Context) {
    private val prefs = context.getSharedPreferences("session", Context.MODE_PRIVATE)

    @Volatile
    var current: Session? = read()
        private set

    private fun read(): Session? {
        val access = prefs.getString("access", null) ?: return null
        val refresh = prefs.getString("refresh", null) ?: return null
        return Session(access, refresh, prefs.getLong("expires", 0), prefs.getString("user", "") ?: "", prefs.getString("email", "") ?: "")
    }

    fun save(session: Session) {
        current = session
        prefs.edit()
            .putString("access", session.accessToken)
            .putString("refresh", session.refreshToken)
            .putLong("expires", session.expiresAt)
            .putString("user", session.userId)
            .putString("email", session.email)
            .apply()
    }

    fun clear() {
        current = null
        prefs.edit().clear().apply()
    }
}

class Net(private val sessions: SessionStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(75, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    /** Agent turns run tools for minutes; the stream must not be cut by a read timeout. */
    private val streamHttp = http.newBuilder().readTimeout(15, TimeUnit.MINUTES).build()
    private val refreshLock = Mutex()

    // ── Supabase Auth ───────────────────────────────────────────────────────────────────────

    private fun parseSession(json: JSONObject, fallbackEmail: String = ""): Session {
        val user = json.optJSONObject("user")
        val expiresAt = json.optLong("expires_at", 0L).takeIf { it > 0 }
            ?: (System.currentTimeMillis() / 1000 + json.optLong("expires_in", 3600))
        return Session(
            accessToken = json.getString("access_token"),
            refreshToken = json.getString("refresh_token"),
            expiresAt = expiresAt,
            userId = user?.optString("id").orEmpty(),
            email = user?.optString("email")?.takeIf { it.isNotBlank() } ?: fallbackEmail,
        )
    }

    private fun authCall(grant: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=$grant")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post(body.toString().toRequestBody(JSON_TYPE))
            .build()
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = runCatching { JSONObject(text) }.getOrNull()
            if (!response.isSuccessful || json == null) {
                val message = json?.optString("msg")?.takeIf { it.isNotBlank() }
                    ?: json?.optString("error_description")?.takeIf { it.isNotBlank() }
                    ?: json?.optString("message")?.takeIf { it.isNotBlank() }
                    ?: "Sign-in failed (${response.code})"
                throw ApiException(message, response.code)
            }
            return json
        }
    }

    suspend fun signIn(email: String, password: String): Session = withContext(Dispatchers.IO) {
        val json = authCall("password", JSONObject().put("email", email).put("password", password))
        parseSession(json, email).also(sessions::save)
    }

    suspend fun signOut() = withContext(Dispatchers.IO) {
        val session = sessions.current
        sessions.clear()
        if (session != null) {
            runCatching {
                val request = Request.Builder()
                    .url("${BuildConfig.SUPABASE_URL}/auth/v1/logout?scope=local")
                    .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    .header("Authorization", "Bearer ${session.accessToken}")
                    .post("{}".toRequestBody(JSON_TYPE))
                    .build()
                http.newCall(request).execute().close()
            }
        }
    }

    /** A token that stays valid for the request; refreshed under a lock so rotation happens once. */
    private suspend fun freshToken(force: Boolean = false): String {
        val now = System.currentTimeMillis() / 1000
        sessions.current?.let { if (!force && it.expiresAt - now > 90) return it.accessToken }
        return refreshLock.withLock {
            val session = sessions.current ?: throw SignedOutException()
            val again = System.currentTimeMillis() / 1000
            if (!force && session.expiresAt - again > 90) return@withLock session.accessToken
            try {
                val json = authCall("refresh_token", JSONObject().put("refresh_token", session.refreshToken))
                parseSession(json, session.email).let { fresh ->
                    val merged = if (fresh.userId.isBlank()) fresh.copy(userId = session.userId) else fresh
                    sessions.save(merged)
                    merged.accessToken
                }
            } catch (error: ApiException) {
                // 400/401 means the refresh token is gone: the user has to sign in again.
                if (error.status in 400..403) {
                    sessions.clear()
                    throw SignedOutException()
                }
                throw error
            }
        }
    }

    // ── Moniq API ───────────────────────────────────────────────────────────────────────────

    private fun execute(token: String, method: String, path: String, body: JSONObject?, idempotencyKey: String?): Pair<Int, String> {
        val builder = Request.Builder()
            .url(BuildConfig.API_BASE_URL.trimEnd('/') + path)
            .header("Authorization", "Bearer $token")
            .header("X-Moniq-Client", "android")
            .header("Accept", "application/json")
            .header("Accept-Language", "en")
        if (idempotencyKey != null) builder.header("Idempotency-Key", idempotencyKey)
        val payload = (body ?: JSONObject()).toString().toRequestBody(JSON_TYPE)
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete()
            else -> builder.method(method, payload)
        }
        http.newCall(builder.build()).execute().use { response ->
            return response.code to response.body?.string().orEmpty()
        }
    }

    suspend fun api(method: String, path: String, body: JSONObject? = null, idempotencyKey: String? = null): JSONObject =
        withContext(Dispatchers.IO) {
            var (code, text) = execute(freshToken(), method, path, body, idempotencyKey)
            if (code == 401) {
                val retried = execute(freshToken(force = true), method, path, body, idempotencyKey)
                code = retried.first
                text = retried.second
            }
            val json = runCatching { JSONObject(text) }.getOrNull()
            if (code !in 200..299) {
                if (code == 401) {
                    sessions.clear()
                    throw SignedOutException()
                }
                throw ApiException(json?.optString("error")?.takeIf { it.isNotBlank() } ?: "Request failed ($code)", code)
            }
            json ?: throw ApiException("Unexpected response from Moniq", code)
        }

    // ── Hermes ──────────────────────────────────────────────────────────────────────────────

    sealed interface AgentEvent {
        data class Session(val id: String) : AgentEvent
        data class Delta(val text: String) : AgentEvent
        data class Tool(val label: String, val running: Boolean) : AgentEvent
        data class Failed(val message: String) : AgentEvent
        data object Done : AgentEvent
    }

    val hermesConfigured: Boolean get() = BuildConfig.HERMES_URL.isNotBlank() && BuildConfig.HERMES_KEY.isNotBlank()

    /**
     * One complete agent turn without streaming, for background work. [idempotencyKey] makes an
     * exact retry replay the first answer instead of running the agent (and its writes) again.
     */
    suspend fun hermesComplete(sessionId: String, idempotencyKey: String, message: String): String = withContext(Dispatchers.IO) {
        val body = JSONObject().put("model", "hermes-agent").put("stream", false)
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", message)))
        val request = Request.Builder()
            .url(BuildConfig.HERMES_URL.trimEnd('/') + "/v1/chat/completions")
            .header("Authorization", "Bearer ${BuildConfig.HERMES_KEY}")
            .header("X-Hermes-Session-Id", sessionId)
            .header("Idempotency-Key", idempotencyKey)
            .post(body.toString().toRequestBody(JSON_TYPE))
            .build()
        streamHttp.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = runCatching { JSONObject(text) }.getOrNull()
            if (!response.isSuccessful) {
                throw ApiException(json?.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() } ?: "Hermes answered ${response.code}", response.code)
            }
            json?.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content")?.takeIf { it.isNotBlank() }
                ?: throw ApiException("Hermes sent an empty answer", response.code)
        }
    }

    /**
     * One agent turn over the OpenAI-compatible stream. Hermes keeps the transcript of [sessionId]
     * itself, so only the new message travels; the app picks a fresh id for every conversation.
     */
    fun askHermes(sessionId: String, firstTurn: Boolean, systemPrompt: String, message: String): Flow<AgentEvent> = callbackFlow {
        val messages = JSONArray()
        if (firstTurn) messages.put(JSONObject().put("role", "system").put("content", systemPrompt))
        messages.put(JSONObject().put("role", "user").put("content", message))
        val body = JSONObject().put("model", "hermes-agent").put("stream", true).put("messages", messages)
        val builder = Request.Builder()
            .url(BuildConfig.HERMES_URL.trimEnd('/') + "/v1/chat/completions")
            .header("Authorization", "Bearer ${BuildConfig.HERMES_KEY}")
            .header("Accept", "text/event-stream")
            .header("X-Hermes-Session-Id", sessionId)
            .post(body.toString().toRequestBody(JSON_TYPE))
        val call = streamHttp.newCall(builder.build())
        // The read below blocks its thread; cancelling the collector has to abort the socket.
        coroutineContext[Job]?.invokeOnCompletion { call.cancel() }
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) {
                    val text = response.body?.string().orEmpty()
                    val message = runCatching { JSONObject(text).optJSONObject("error")?.optString("message") }.getOrNull()
                    trySend(AgentEvent.Failed(message?.takeIf { it.isNotBlank() } ?: "Hermes answered ${response.code}"))
                    return@use
                }
                response.header("X-Hermes-Session-Id")?.let { trySend(AgentEvent.Session(it)) }
                val source = response.body?.source() ?: return@use
                var event = ""
                while (!source.exhausted()) {
                    val line = source.readUtf8Line() ?: break
                    when {
                        line.isEmpty() -> event = ""
                        line.startsWith("event:") -> event = line.substring(6).trim()
                        line.startsWith("data:") -> {
                            val data = line.substring(5).trim()
                            if (data == "[DONE]") break
                            val json = runCatching { JSONObject(data) }.getOrNull() ?: continue
                            if (event == "hermes.tool.progress") {
                                val label = json.optString("label").ifBlank { json.optString("tool") }
                                trySend(AgentEvent.Tool(label, json.optString("status") == "running"))
                                continue
                            }
                            json.optJSONObject("error")?.let { error ->
                                trySend(AgentEvent.Failed(error.optString("message", "Hermes could not finish the answer")))
                            }
                            val delta = json.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("delta")
                            val content = delta?.optString("content").orEmpty()
                            if (content.isNotEmpty() && delta?.isNull("content") == false) trySend(AgentEvent.Delta(content))
                        }
                    }
                }
            }
            trySend(AgentEvent.Done)
        } catch (error: IOException) {
            if (!call.isCanceled()) {
                trySend(AgentEvent.Failed("Hermes is unreachable. It answers only inside your Tailscale network."))
            }
        }
        close()
        awaitClose { call.cancel() }
    }.flowOn(Dispatchers.IO)
}
