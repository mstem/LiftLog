package expo.modules.workoutworker.utils

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import expo.modules.workoutworker.RestAlarmReceiver

/**
 * Schedules the "rest over" ding as an exact AlarmManager alarm.
 *
 * The foreground service's polling timer freezes when the screen turns off (a
 * foreground service holds no wakelock, so the CPU sleeps between events), which
 * is why the rest notification used to arrive late or not at all. An exact
 * `setExactAndAllowWhileIdle` alarm wakes the CPU at the target time even in Doze,
 * so the ding lands on time regardless of app / screen state.
 */
class RestAlarmScheduler(private val context: Context) {

    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    /**
     * Schedule (or replace) the alarm identified by [requestCode] to fire at
     * [triggerAtEpochMs] and post a rest notification titled [title].
     * Times already in the past are ignored - a rest that has only just started
     * is never already over.
     */
    fun schedule(triggerAtEpochMs: Long, requestCode: Int, title: String) {
        if (triggerAtEpochMs <= System.currentTimeMillis()) {
            cancel(requestCode)
            return
        }

        val pending = buildPendingIntent(requestCode, title)

        if (canScheduleExact()) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, triggerAtEpochMs, pending
            )
        } else {
            // Without the exact-alarm permission we can still wake the device in
            // Doze, just not to-the-second. Better a slightly late ding than none.
            Log.w("RestAlarmScheduler", "Exact alarms not permitted; falling back to inexact")
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP, triggerAtEpochMs, pending
            )
        }
    }

    fun cancel(requestCode: Int) {
        alarmManager.cancel(buildPendingIntent(requestCode, null))
    }

    /** Cancel every rest alarm this scheduler can produce. */
    fun cancelAll() {
        cancel(REQUEST_CODE_MIN)
        cancel(REQUEST_CODE_MAX)
    }

    private fun canScheduleExact(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }
    }

    // Extras are not part of PendingIntent equality, so a null-title intent still
    // matches (and cancels) the one scheduled with a title.
    private fun buildPendingIntent(requestCode: Int, title: String?): PendingIntent {
        val intent = Intent(context, RestAlarmReceiver::class.java).apply {
            action = RestAlarmReceiver.ACTION_REST_ALARM
            if (title != null) putExtra(RestAlarmReceiver.EXTRA_TITLE, title)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    companion object {
        const val REQUEST_CODE_MIN = 2001
        const val REQUEST_CODE_MAX = 2002
    }
}
