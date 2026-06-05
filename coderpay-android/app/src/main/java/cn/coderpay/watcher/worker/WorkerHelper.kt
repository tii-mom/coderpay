package cn.coderpay.watcher.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object WorkerHelper {
    fun triggerSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val uploadRequest = OneTimeWorkRequestBuilder<EventUploadWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueue(uploadRequest)
    }
}
