package cn.coderpay.watcher.api

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.PUT

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

    @POST("api/mobile/billing/recharge")
    suspend fun createMobileRecharge(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Body request: MobileRechargeRequest
    ): Response<MobileRechargeResponse>

    @GET("api/mobile/billing/recharge/{id}")
    suspend fun getMobileRecharge(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Path("id") id: String
    ): Response<MobileRechargeStatusResponse>

    @POST("api/mobile/billing/subscribe")
    suspend fun subscribeMobilePlan(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Body request: MobileSubscribeRequest
    ): Response<MobileActionResponse>

    @POST("api/mobile/codes/upload")
    suspend fun uploadMobilePaymentCode(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Body request: MobilePaymentCodeUploadRequest
    ): Response<MobilePaymentCodeUploadResponse>

    @POST("api/mobile/codes")
    suspend fun createMobilePaymentCode(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Body request: MobilePaymentCodeCreateRequest
    ): Response<MobilePaymentCodeActionResponse>

    @PUT("api/mobile/codes/{id}")
    suspend fun updateMobilePaymentCode(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Path("id") id: String,
        @Body request: MobilePaymentCodeUpdateRequest
    ): Response<MobilePaymentCodeActionResponse>

    @DELETE("api/mobile/codes/{id}")
    suspend fun deleteMobilePaymentCode(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Path("id") id: String
    ): Response<MobileActionResponse>

    @POST("api/mobile/devices/reset-secret")
    suspend fun resetMobileDeviceSecret(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String
    ): Response<MobileResetSecretResponse>

    @GET("api/mobile/orders")
    suspend fun getMobileOrders(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Query("status") status: String?,
        @retrofit2.http.Query("payType") payType: String?,
        @retrofit2.http.Query("keyword") keyword: String?,
        @retrofit2.http.Query("startDate") startDate: String? = null,
        @retrofit2.http.Query("endDate") endDate: String? = null
    ): Response<PaginatedOrdersResponse>

    @GET("api/mobile/orders/{id}")
    suspend fun getMobileOrderDetail(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @Path("id") id: String
    ): Response<MobileOrderDetailResponse>

    @GET("api/mobile/exceptions")
    suspend fun getMobileExceptions(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Query("status") status: String?,
        @retrofit2.http.Query("type") type: String?
    ): Response<PaginatedExceptionsResponse>

    @GET("api/mobile/billing-records")
    suspend fun getMobileBillingRecords(
        @Header("x-coderpay-device") deviceCode: String,
        @Header("x-coderpay-timestamp") timestamp: String,
        @Header("x-coderpay-sign") sign: String,
        @retrofit2.http.Query("page") page: Int,
        @retrofit2.http.Query("limit") limit: Int,
        @retrofit2.http.Query("type") type: String?
    ): Response<PaginatedBillingRecordsResponse>
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
    val rechargeOrders: List<MobileRechargeOrder> = emptyList(),
    val incomingRechargeOrders: List<MobileRechargeOrder> = emptyList(),
    val paymentCodes: List<MobilePaymentCode>,
    val devices: List<MobileDevice>,
    val billingRecords: List<MobileBillingRecord>,
    val exceptions: List<MobileException> = emptyList(),
    val orderSummary: MobileOrderSummary? = null
)

data class MobileOrderSummary(
    val total: Int,
    val pending: Int,
    val success: Int,
    val expired: Int,
    val failed: Int,
    val manualReview: Int
)

data class MobileRechargeRequest(
    val amount: Double,
    val payType: String
)

data class MobileRechargeResponse(
    val status: String,
    val data: MobileRechargeData?
)

data class MobileRechargeData(
    val recharge_id: String,
    val amount: String,
    val real_amount: String,
    val pay_type: String,
    val expired_at: String,
    val payment_code: MobilePaymentCode?,
    val requires_manual_confirm: Boolean = false
)

data class MobileRechargeStatusResponse(
    val id: String,
    val amount: Double,
    val realAmount: Double,
    val payType: String,
    val status: String,
    val expiresAt: String,
    val paymentCode: MobilePaymentCode?,
    val requiresManualConfirm: Boolean = false
)

data class MobileRechargeOrder(
    val id: String,
    val amount: Double,
    val realAmount: Double,
    val amountCents: Int? = null,
    val realAmountCents: Int? = null,
    val payType: String,
    val status: String,
    val displayStatus: String? = null,
    val rechargeUserEmail: String? = null,
    val createdAt: String,
    val expiresAt: String,
    val payTime: String?,
    val paymentCodeId: String? = null,
    val requiresManualConfirm: Boolean = false
)

data class MobileSubscribeRequest(
    val planId: String
)

data class MobileActionResponse(
    val status: String,
    val error: String? = null,
    val packageType: String? = null,
    val feeBalance: Double? = null,
    val subscriptionExpiresAt: String? = null
)

data class MobilePaymentCodeUploadRequest(
    val fileType: String,
    val base64: String
)

data class MobilePaymentCodeUploadResponse(
    val url: String,
    val fileType: String
)

data class MobilePaymentCodeCreateRequest(
    val type: String,
    val codeType: String,
    val amount: Double,
    val imageUrl: String,
    val deviceId: String?,
    val alipayUserId: String? = null,
    val qrPayload: String? = null,
    val directPayUrl: String? = null
)

data class MobilePaymentCodeUpdateRequest(
    val status: String? = null,
    val amount: Double? = null,
    val imageUrl: String? = null,
    val deviceId: String? = null,
    val alipayUserId: String? = null
)

data class MobilePaymentCodeActionResponse(
    val status: String,
    val code: MobilePaymentCode? = null,
    val error: String? = null
)

data class MobileResetSecretResponse(
    val status: String,
    val deviceSecret: String?
)

data class MobileUser(
    val email: String,
    val feeBalance: Double,
    val packageType: String,
    val freeOrderUsed: Int? = null,
    val subscriptionExpiresAt: String? = null
)

data class MobileOrder(
    val id: String,
    val outOrderNo: String,
    val title: String,
    val payType: String,
    val amount: Double,
    val realAmount: Double,
    val amountCents: Int? = null,
    val realAmountCents: Int? = null,
    val status: String,
    val confirmMode: String? = null,
    val manualConfirmedAt: String? = null,
    val manualConfirmNote: String? = null,
    val createdAt: String,
    val expiresAt: String? = null,
    val payTime: String?,
    val webhookStatus: String,
    val paymentCodeId: String? = null,
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
    val createdAt: String,
    val alipayUserId: String? = null,
    val qrPayload: String? = null,
    val directPayUrl: String? = null,
    val directPayMode: String? = null,
    val deviceName: String? = null
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
    val status: String,
    val todayEventCount: Int = 0,
    val todayMatchCount: Int = 0
)

data class MobileBillingRecord(
    val id: String,
    val type: String,
    val amount: Double,
    val balance: Double,
    val description: String,
    val createdAt: String
)

data class MobileException(
    val id: String,
    val type: String,
    val title: String,
    val description: String,
    val createdAt: String,
    val refId: String,
    val status: String
)

data class PaginatedOrdersResponse(
    val orders: List<MobileOrder>,
    val total: Int,
    val page: Int,
    val limit: Int,
    val hasMore: Boolean
)

data class PaginatedExceptionsResponse(
    val exceptions: List<MobileException>,
    val total: Int,
    val page: Int,
    val limit: Int,
    val hasMore: Boolean
)

data class PaginatedBillingRecordsResponse(
    val billingRecords: List<MobileBillingRecord>,
    val total: Int,
    val page: Int,
    val limit: Int,
    val hasMore: Boolean
)

data class MobileOrderDetailResponse(
    val status: String,
    val order: MobileOrderDetail
)

data class MobileOrderDetail(
    val id: String,
    val outOrderNo: String,
    val title: String,
    val payType: String,
    val amount: Double,
    val realAmount: Double,
    val amountCents: Int? = null,
    val realAmountCents: Int? = null,
    val status: String,
    val confirmMode: String?,
    val manualConfirmedAt: String?,
    val manualConfirmNote: String?,
    val createdAt: String,
    val expiresAt: String? = null,
    val payTime: String?,
    val webhookStatus: String,
    val paymentCodeId: String? = null,
    val appId: String,
    val appName: String,
    val notifyUrl: String,
    val returnUrl: String?,
    val paymentCode: MobilePaymentCode?,
    val webhookLogs: List<MobileWebhookLog> = emptyList()
)

data class MobileWebhookLog(
    val id: String,
    val requestTime: String,
    val statusCode: Int?,
    val result: String,
    val responseSummary: String?
)
