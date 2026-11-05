package expo.modules.trainerwidget

import java.text.NumberFormat
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** The widget's strings, read from resources by the widget and built by hand in tests. */
data class Copy(
    val notConfigured: String,
    val waiting: String,
    val today: String,
    val tomorrow: String,
    val updated: String,
    val ran: String,
    val lifted: String,
    val active: String,
    val km: String,
    val kg: String,
    val min: String,
)

data class Total(val number: String, val unit: String, val label: String)

/** What the widget draws: a caption (when, plus the file's age once stale), the headline
 * (the next session, or one of the two empty states), the line under it, and the week's
 * totals in the order km, kg, min. Totals are empty in the empty states. */
data class WidgetView(val caption: String?, val headline: String, val line: String?, val totals: List<Total>)

const val STALE_MS = 6 * 60 * 60 * 1000L

private val UPDATED_AT: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE HH:mm", Locale.US)

/** Decides the view from the Glance state. Today and tomorrow are judged in the trainer's
 * timezone, not the phone's, so the caption is right while traveling. */
fun widgetView(configured: Boolean, payload: String?, nowMs: Long, copy: Copy): WidgetView {
    if (!configured) return WidgetView(null, copy.notConfigured, null, emptyList())
    val p = payload?.let { WidgetState.parsePayload(it) }
        ?: return WidgetView(null, copy.waiting, null, emptyList())

    val today = Instant.ofEpochMilli(nowMs).atZone(p.zone).toLocalDate()
    val next = p.next.date
    var caption = when (next) {
        today -> copy.today
        today.plusDays(1) -> copy.tomorrow
        else -> next.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)
    }
    if (nowMs - p.generatedAt.toEpochMilli() > STALE_MS) {
        caption += " · " + String.format(Locale.US, copy.updated, UPDATED_AT.format(p.generatedAt.atZone(p.zone)))
    }

    val whole = NumberFormat.getIntegerInstance(Locale.US)
    val totals = listOf(
        Total(String.format(Locale.US, "%.1f", p.week.runKm), copy.km, copy.ran),
        Total(whole.format(p.week.liftedKg), copy.kg, copy.lifted),
        Total(whole.format(p.week.activeMin), copy.min, copy.active),
    )
    return WidgetView(caption, p.next.title, p.next.line.ifBlank { null }, totals)
}
