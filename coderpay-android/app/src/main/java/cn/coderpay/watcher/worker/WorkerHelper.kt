package cn.coderpay.watcher.worker

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

object WorkerHelper {
    private const val EVENT_UPLOAD_WORK_NAME = "coderpay_event_upload"

    fun triggerSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val uploadRequest = OneTimeWorkRequestBuilder<EventUploadWorker>()
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            EVENT_UPLOAD_WORK_NAME,
            ExistingWorkPolicy.REPLACE,
            uploadRequest
        )
    }
}
