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
    /** The widget URL the payload came from; a payload from another host is not shown. */
    val PAYLOAD_URL = stringPreferencesKey("payload_url")
    /** Written on every worker run so the stored state always changes and Glance redraws. */
    val LAST_RUN = longPreferencesKey("last_run")
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
            Instant.parse(str(o, "generated_at")),
            LocalDate.parse(str(o, "week_start")).toString(),
            ZoneId.of(str(o, "timezone")),
            Next(LocalDate.parse(str(n, "date")), str(n, "title"), n.opt("line") as? String ?: "", n.getBoolean("is_run")),
            Week(w.getDouble("run_km"), w.getLong("lifted_kg"), w.getLong("active_min")),
        )
    } catch (e: Exception) {
        null
    }

    /** A field that must be a JSON string. Android's org.json turns null and numbers into
     * text ("null", "5") in getString, so the type is checked here instead. */
    private fun str(o: JSONObject, key: String): String =
        o.opt(key) as? String ?: throw IllegalArgumentException("$key is not a string")
}
