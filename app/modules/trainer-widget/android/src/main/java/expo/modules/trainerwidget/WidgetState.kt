package expo.modules.trainerwidget

import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import org.json.JSONObject

data class Next(val date: String, val title: String, val line: String, val isRun: Boolean)
data class Week(val runKm: Double, val liftedKg: Long, val activeMin: Long)
data class Payload(val generatedAt: String, val weekStart: String, val timezone: String, val next: Next, val week: Week)

/** The widget's Glance state: the last good widget.json, when it was fetched, and how
 * the last fetch went ("ok", "missing" for a 404, "error"). */
object WidgetState {
    val PAYLOAD = stringPreferencesKey("payload")
    val FETCHED_AT = longPreferencesKey("fetched_at")
    val STATUS = stringPreferencesKey("status")

    /** The file as the trainer writes it, or null when any field is missing or malformed. */
    fun parsePayload(json: String): Payload? = try {
        val o = JSONObject(json)
        val n = o.getJSONObject("next")
        val w = o.getJSONObject("week")
        Payload(
            o.getString("generated_at"), o.getString("week_start"), o.getString("timezone"),
            Next(n.getString("date"), n.getString("title"), n.optString("line", ""), n.getBoolean("is_run")),
            Week(w.getDouble("run_km"), w.getLong("lifted_kg"), w.getLong("active_min")),
        )
    } catch (e: Exception) {
        null
    }
}
