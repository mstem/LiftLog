package expo.modules.trainerwidget

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class WidgetModelTest {
    private val copy = Copy("Set up automatic remote backup in LiftLog", "Waiting for the trainer", "Today", "Tomorrow",
        "updated %1\$s", "ran this week", "lifted", "active", "km", "kg", "min")
    private val payload = """{"generated_at":"2026-11-04T19:40:00Z","week_start":"2026-11-02","timezone":"Europe/Lisbon",
        "next":{"date":"2026-11-05","title":"Pull","line":"Fri Base run 45 min · Sun 10K race","is_run":false},
        "week":{"run_km":8.8,"lifted_kg":4342,"active_min":135}}"""
    private fun at(iso: String) = Instant.parse(iso).toEpochMilli()

    @Test fun notConfigured() {
        val v = widgetView(false, payload, at("2026-11-04T20:00:00Z"), copy)
        assertEquals(WidgetView(null, copy.notConfigured, null, emptyList()), v)
    }

    @Test fun waitingWhenNothingFetched() {
        assertEquals(WidgetView(null, copy.waiting, null, emptyList()), widgetView(true, null, at("2026-11-04T20:00:00Z"), copy))
    }

    @Test fun unparsablePayloadIsWaiting() {
        assertEquals(copy.waiting, widgetView(true, "{\"next\": 1", at("2026-11-04T20:00:00Z"), copy).headline)
    }

    @Test fun tomorrowWithTotals() {
        val v = widgetView(true, payload, at("2026-11-04T20:00:00Z"), copy)
        assertEquals("Tomorrow", v.caption)
        assertEquals("Pull", v.headline)
        assertEquals("Fri Base run 45 min · Sun 10K race", v.line)
        assertEquals(listOf(Total("8.8", "km", "ran this week"), Total("4,342", "kg", "lifted"), Total("135", "min", "active")), v.totals)
    }

    @Test fun todayInPayloadTimezone() {
        // Generated half an hour ago, so nothing is stale; 04:30 UTC on the 5th is
        // 23:30 on the 4th in New York: still Tomorrow there, already Today in Lisbon.
        val fresh = payload.replace("2026-11-04T19:40:00Z", "2026-11-05T04:00:00Z")
        val ny = fresh.replace("Europe/Lisbon", "America/New_York")
        assertEquals("Tomorrow", widgetView(true, ny, at("2026-11-05T04:30:00Z"), copy).caption)
        assertEquals("Today", widgetView(true, fresh, at("2026-11-05T04:30:00Z"), copy).caption)
    }

    @Test fun weekdayFurtherOut() {
        val sat = payload.replace("\"date\":\"2026-11-05\"", "\"date\":\"2026-11-07\"")
        assertEquals("Sat", widgetView(true, sat, at("2026-11-04T20:00:00Z"), copy).caption)
    }

    @Test fun staleAddsUpdatedTime() {
        val v = widgetView(true, payload, at("2026-11-05T02:00:00Z"), copy)  // 6 h 20 min after generated_at
        assertEquals("Today · updated Wed 19:40", v.caption)
        assertEquals("Pull", v.headline)
    }

    @Test fun freshHasNoUpdatedTime() {
        assertEquals("Today", widgetView(true, payload, at("2026-11-05T01:30:00Z"), copy).caption)
    }

    @Test fun zerosReadAsZero() {
        val z = payload.replace("8.8", "0").replace("4342", "0").replace("135", "0")
        assertEquals(listOf(Total("0.0", "km", "ran this week"), Total("0", "kg", "lifted"), Total("0", "min", "active")),
            widgetView(true, z, at("2026-11-04T20:00:00Z"), copy).totals)
    }
}
