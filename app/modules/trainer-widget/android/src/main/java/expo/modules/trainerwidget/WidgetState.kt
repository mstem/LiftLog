package expo.modules.trainerwidget

import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class Next(val date: LocalDate, val title: String, val line: String, val isRun: Boolean)
data class Week(val runKm: Double, val liftedKg: Long, val activeMin: Long)
data class Payload(val generatedAt: Instant, val weekStart: String, val zone: ZoneId, val next: Next, val week: Week)

/** The widget's Glance state: the last good widget.json, when it was fetched, and how
 * the last fetch went ("ok", "missing" for a 404, "error"). FETCHED_AT and STATUS are
 * recorded for a later "last fetch failed" surface; the stale rule reads generated_at. */
object WidgetState {
    val PAYLOAD = stringPreferencesKey("payload")
    val FETCHED_AT = longPreferencesKey("fetched_at")
    val STATUS = stringPreferencesKey("status")

    /** The file as the trainer writes it, with its dates, timestamp and zone parsed, or
     * null when any field is missing, of the wrong type or not a real value. A file that
     * fails here never replaces the last good one. */
    fun parsePayload(json: String): Payload? = try {
        val o = JSONObject(json)
        val n = o.getJSONObject("next")
        val w = o.getJSONObject("week")
        Payload(
            Instant.parse(o.getString("generated_at")),
            o.getString("week_start"),
            ZoneId.of(o.getString("timezone")),
            Next(LocalDate.parse(n.getString("date")), n.getString("title"), n.optString("line", ""), n.getBoolean("is_run")),
            Week(w.getDouble("run_km"), w.getLong("lifted_kg"), w.getLong("active_min")),
        )
    } catch (e: Exception) {
        null
    }
}
