package cn.coderpay.watcher.api

import android.content.Context
import cn.coderpay.watcher.utils.SettingsManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var currentUrl: String? = null
    private var apiService: ApiService? = null

    fun getService(context: Context): ApiService {
        val settings = SettingsManager(context)
        var url = settings.serverUrl.trim()
        if (!url.endsWith("/")) {
            url += "/"
        }

        if (apiService == null || currentUrl != url) {
            currentUrl = url
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            val client = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            val retrofit = Retrofit.Builder()
                .baseUrl(url)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
            
            apiService = retrofit.create(ApiService::class.java)
        }
        return apiService!!
    }
}
