package cn.coderpay.watcher.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface ApiService {
    @POST("api/devices/heartbeat")
    suspend fun sendHeartbeat(@Body request: HeartbeatRequest): Response<HeartbeatResponse>

    @POST("api/events")
    suspend fun uploadEvent(@Body request: EventRequest): Response<EventResponse>

    @GET("api/mobile/console")
    suspend fun getMobileConsole(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String
    ): Response<MobileConsoleResponse>
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

data class MobileConsoleResponse(
    val user: MobileUser,
    val orders: List<MobileOrder>,
    val paymentCodes: List<MobilePaymentCode>,
    val devices: List<MobileDevice>,
    val billingRecords: List<MobileBillingRecord>
)

data class MobileUser(
    val email: String,
    val feeBalance: Double,
    val packageType: String
)

data class MobileOrder(
    val id: String,
    val outOrderNo: String,
    val title: String,
    val payType: String,
    val amount: Double,
    val realAmount: Double,
    val status: String,
    val createdAt: String,
    val payTime: String?,
    val webhookStatus: String,
    val appId: String
)

data class MobilePaymentCode(
    val id: String,
    val type: String,
    val codeType: String,
    val amount: Double,
    val imageUrl: String,
    val status: String,
    val deviceId: String?,
    val createdAt: String
)

data class MobileDevice(
    val id: String,
    val deviceCode: String,
    val name: String,
    val online: Boolean,
    val lastHeartbeat: String?,
    val wechatListener: String?,
    val alipayListener: String?,
    val notificationPermission: Boolean,
    val batteryOptimization: String?,
    val status: String
)

data class MobileBillingRecord(
    val id: String,
    val type: String,
    val amount: Double,
    val balance: Double,
    val description: String,
    val createdAt: String
)
