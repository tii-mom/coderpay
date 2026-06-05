package cn.coderpay.watcher.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {
    @POST("api/devices/heartbeat")
    suspend fun sendHeartbeat(@Body request: HeartbeatRequest): Response<HeartbeatResponse>

    @POST("api/events")
    suspend fun uploadEvent(@Body request: EventRequest): Response<EventResponse>
}

// Request & Response Data Models
data class HeartbeatRequest(
    val deviceCode: String,
    val wechatListener: String,     // "running" or "stopped"
    val alipayListener: String,     // "running" or "stopped"
    val notificationPermission: Boolean,
    val batteryOptimization: String, // "optimized" or "ignored"
    val timestamp: Long,
    val sign: String? = null
)

data class HeartbeatResponse(
    val status: String,
    val online: Boolean,
    val deviceSecret: String? = null,
    val wechatRegex: String? = null,
    val alipayRegex: String? = null
)

data class EventRequest(
    val deviceCode: String,
    val payType: String,            // "wechat" or "alipay"
    val amount: Double,
    val receivedAt: String,         // ISO 8601 string
    val notificationHash: String,   // MD5 idempotent identifier
    val rawNotification: String,    // Original notification body text
    val timestamp: Long,
    val sign: String? = null
)

data class EventResponse(
    val status: String,
    val matchStatus: String,        // "matched" or "unmatched"
    val matchedOrderId: String?
)

