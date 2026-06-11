package cn.coderpay.watcher.utils

import com.google.gson.Gson
import com.google.gson.JsonObject
import retrofit2.Response

object ApiErrorHelper {
    private val gson = Gson()

    /**
     * Parses the error message from the response error body if available.
     * Expects JSON format like {"error": "Message text"} or {"status": "error", "error": "Message text"}.
     * Returns fallback HTTP code representation if parsing fails or error field is absent.
     */
    fun parseApiError(response: Response<*>): String {
        try {
            val errorBody = response.errorBody()?.string()
            if (!errorBody.isNullOrBlank()) {
                val jsonObject = gson.fromJson(errorBody, JsonObject::class.java)
                if (jsonObject != null && jsonObject.has("error")) {
                    val errorElement = jsonObject.get("error")
                    if (errorElement != null && errorElement.isJsonPrimitive) {
                        return errorElement.asString
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore and fall through to default HTTP status code representation
        }
        return "HTTP ${response.code()}"
    }

    /**
     * Formats API error with a fallback user-facing description.
     */
    fun formatApiError(response: Response<*>, fallbackMessage: String): String {
        val parsed = parseApiError(response)
        return if (parsed.startsWith("HTTP ")) {
            "$fallbackMessage ($parsed)"
        } else {
            parsed
        }
    }
}
