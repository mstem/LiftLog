package expo.modules.workoutworker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import expo.modules.workoutworker.utils.WorkoutNotificationManager

/**
 * Fired by [expo.modules.workoutworker.utils.RestAlarmScheduler] at a rest
 * milestone. Posts the audible rest_channel notification. Runs even when the app
 * process is otherwise idle, which is the whole point - the ding no longer depends
 * on the polling timer staying awake.
 */
class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d(TAG, "onReceive action=${intent.action} at=${System.currentTimeMillis()}")
        if (intent.action != ACTION_REST_ALARM) {
            Log.w(TAG, "ignoring unexpected action ${intent.action}")
            return
        }
        val title = intent.getStringExtra(EXTRA_TITLE)
        if (title == null) {
            Log.w(TAG, "no title extra; nothing posted")
            return
        }

        val notificationManager = WorkoutNotificationManager(context)
        val notification = notificationManager.createRestNotificationBuilder()
            .setContentTitle(title)
            // Auto-dismiss so a stale "rest over" banner doesn't linger; mirrors the
            // 10s clear the polling path used to do.
            .setTimeoutAfter(REST_NOTIFICATION_TIMEOUT_MS)
            .build()
        notificationManager.notifyRest(notification)
        Log.d(TAG, "posted rest notification '$title'")
    }

    companion object {
        private const val TAG = "RestAlarm"
        const val ACTION_REST_ALARM = "expo.modules.workoutworker.REST_ALARM"
        const val EXTRA_TITLE = "title"
        private const val REST_NOTIFICATION_TIMEOUT_MS = 10_000L
    }
}
