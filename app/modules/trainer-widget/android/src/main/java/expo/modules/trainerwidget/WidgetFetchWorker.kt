package expo.modules.trainerwidget

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.appwidget.updateAll
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL

private sealed class Fetch {
    data class Ok(val body: String) : Fetch()
    object Missing : Fetch()
    object Error : Fetch()
}

/** Fetches widget.json and writes the Glance state. A bad key, a down box or a body that
 * is not the trainer's file leaves the last good payload in place. */
class WidgetFetchWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val url = WidgetConfig.url(ctx)
        val key = WidgetConfig.key(ctx)
        if (url.isNullOrBlank() || key.isNullOrBlank()) return Result.success()
        val ids = GlanceAppWidgetManager(ctx).getGlanceIds(TrainerWidget::class.java)
        if (ids.isEmpty()) return Result.success()

        val outcome = try { fetch(url, key) } catch (e: Exception) { Fetch.Error }
        val now = System.currentTimeMillis()
        for (id in ids) {
            updateAppWidgetState(ctx, PreferencesGlanceStateDefinition, id) { prefs ->
                prefs.toMutablePreferences().apply { record(this, outcome, now) }
            }
        }
        TrainerWidget().updateAll(ctx)
        return if (outcome is Fetch.Error) Result.retry() else Result.success()
    }

    private fun record(prefs: MutablePreferences, outcome: Fetch, now: Long) {
        when (outcome) {
            is Fetch.Ok -> {
                prefs[WidgetState.PAYLOAD] = outcome.body
                prefs[WidgetState.FETCHED_AT] = now
                prefs[WidgetState.STATUS] = "ok"
            }
            Fetch.Missing -> {
                prefs[WidgetState.FETCHED_AT] = now
                prefs[WidgetState.STATUS] = "missing"
            }
            Fetch.Error -> prefs[WidgetState.STATUS] = "error"
        }
    }

    private fun fetch(url: String, key: String): Fetch {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "GET"
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000
            conn.setRequestProperty("X-Api-Key", key)
            conn.setRequestProperty("Accept", "application/json")
            return when (conn.responseCode) {
                200 -> {
                    val body = conn.inputStream.bufferedReader().readText()
                    if (WidgetState.parsePayload(body) != null) Fetch.Ok(body) else Fetch.Error
                }
                404 -> Fetch.Missing
                else -> Fetch.Error
            }
        } finally {
            conn.disconnect()
        }
    }
}
