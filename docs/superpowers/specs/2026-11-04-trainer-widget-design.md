# Trainer widget: design

Date 2026-11-04. Todoist task "Trainer widget android today's workout, this week's running volume" (https://app.todoist.com/app/task/6hq5WvHgWCjC5GR5). Mockups chosen from `.superpowers/brainstorm/78210-1793820889/content/widget-layout-v2.html`, layout A.

## Intent

An Android home-screen widget that nudges Matt to stay healthy and lift. At a glance it answers two questions without opening anything: what is up next, and how the week has gone so far. It is the trainer's widget, hosted inside LiftLog because that is the app already on the phone. The trainer (the Python job in the health repo, running on the Coolify box) already decides the next session every four hours and already has every number the week needs, so the widget displays what the trainer publishes and computes nothing itself.

## What it shows

Layout A, a 4x2 widget, white background, dark text, one accent color (LiftLog's blue), system font, two weights.

Top, the headline: the next session. A small caption gives when ("Today" or "Tomorrow", or the weekday when further out), then the session title as the trainer writes it to the Gym slot ("Pull", "Push + Base run", "Rest day", "10K race"). Under it one line: when the next session is a run, the trainer's steps for it ("45 min: 5 min warm-up, 35 min at 5:28-6:58/km, 5 min cool down"); otherwise what follows it ("Fri Base run 45 min · Sun 10K race"). Today's session stays the headline until it is done (the trainer has seen the Garmin activity or the LiftLog session), then the widget moves to the next one.

Bottom, the week so far, Monday to now: three totals side by side, number large, unit small, label under it in the muted color.

- kilometers run, label "ran this week"
- kilograms lifted, label "lifted"
- active minutes, label "active"

These are aggregates of what Matt accomplished. They never show a target, a remaining count, a percentage, a streak or a badge. If nothing has happened yet this week, the three numbers read 0.

A 2x2 size shows only the caption, the next session title and one total, kilometers ran this week. (My call; Matt did not object to the mockup.)

A tap anywhere opens LiftLog on its Workout tab. (My call. The run's steps are already on the widget, so nothing is gained by sending a tap to Garmin.)

Empty and error states, all text, no icons:

- Never fetched (automatic remote backup not set up in LiftLog): the headline reads "Set up automatic remote backup in LiftLog" and the totals are hidden.
- Fetched before but the last fetch failed and the data is older than six hours: the caption gains "updated Tue 18:10" after the day word. Nothing else changes; stale numbers are still numbers.
- Endpoint and key set but no fetch has succeeded yet (the first hour on the phone, or the receiver answering 404 because the trainer has not written the file yet): the headline reads "Waiting for the trainer" and the totals are hidden. (Wording accepted by Matt 2026-11-05.)
- The trainer never publishes `next` as null. When the calendar read fails or no non-rest day exists in the horizon, the `widget` command leaves the previous `widget.json` in place and only `generated_at` goes stale, which the stale rule above surfaces. (My call.)

## Goals, non-goals, anti-goals

Goals: a glanceable nudge; next session and the week's aggregates always within an hour of being true; survives reboot and app updates; zero bitmaps so Android 17's widget memory limit never applies.

Non-goals: iOS; a widget for LiftLog's own data outside the trainer's numbers; configuring anything on the widget itself; showing the whole week's plan.

Anti-goals, things that would make it a failure even if it works: scoring the week against the plan; counting what is missing; any number Matt did not ask for (no "3 of 7", no session counts in the 4x2); a second accent color; a dark theme.

## Data

### Source: the trainer publishes `widget.json`

The trainer gains a `widget` command that composes one JSON file from Garmin activities and stats and the LiftLog backup, the same inputs `review.py` already reads, and writes it to its state directory (`/srv/trainer/widget.json` on the box). Shape:

```json
{
  "generated_at": "2026-11-04T19:40:00Z",
  "week_start": "2026-11-02",
  "timezone": "Europe/Lisbon",
  "next": {
    "date": "2026-11-05",
    "title": "Pull",
    "line": "Fri Base run 45 min · Sun 10K race",
    "is_run": false
  },
  "week": {
    "run_km": 8.8,
    "lifted_kg": 4342,
    "active_min": 135
  }
}
```

Definitions, matching `review.py` where it has one:

- `week_start` is the Monday of the current ISO week in the trainer's "today" timezone (Nearby's timezone when traveling, Lisbon otherwise), the same rule the trainer uses for everything else.
- `run_km` is the sum of `distance_m` over Garmin running activities (the planner's `RUNS` kinds plus any Garmin `running` type) started this week, in kilometers to one decimal.
- `lifted_kg` is the sum over every LiftLog session dated this week of weight times reps for each completed weighted set, as `review.lifted` computes it, rounded to a whole number.
- `active_min` is Garmin's intensity minutes for the week, moderate plus twice vigorous, summed over the week's days, the same figure the nightly review calls "activity minutes earned". (My call: it matches the review rather than the plain sum of activity durations. The mockup's 135 was the plain sum; the real value will differ.)
- `next` is the first day from today on whose planned title is not "Rest day" and that is not already done. A day counts as done when the trainer's `seen` activity ids or the LiftLog backup hold a session for it. `title` is the calendar title as written; `line` is the "Trainer:" line when `is_run` is true, otherwise the following two non-rest days as "Fri Base run 45 min · Sun 10K race".

Cadence: `run.sh widget` on the host cron every 30 minutes during waking hours (free, no GitHub Actions), and once at the end of every `run` and `review`. It fetches Garmin and reads the backup only; it plans nothing and writes nothing but the file. The receiver (next section) also pokes it right after a backup upload lands, so a lift just finished shows on the widget within a minute. (My call on the cadence; the trainer's four-hour planning run is too slow for a nudge.)

### Transport: the receiver serves it

The `liftlog-garmin-sync` receiver (`receiver.py`, the thing LiftLog's automatic remote backup already POSTs to at `lifts.mindshine.io`) gains `GET /widget`. It requires the same `X-Api-Key` the backup uses, serves `/srv/trainer/widget.json` with `Content-Type: application/json` and `Cache-Control: no-store`, and returns 404 with an empty body when the file does not exist yet. The receiver container gets `/srv/trainer/widget.json` mounted read-only. After a successful backup POST it runs the widget refresh (details left to the builder; a host-side trigger file watched by cron is enough, the container must not need Docker access).

The phone therefore talks to one host with one key for both directions, and the widget needs no new setting: it uses the endpoint and key Matt already entered under Settings > Export, backup, and restore > Automatic remote backup, with the path replaced by `/widget`.

### On the phone

A local Expo module in `app/modules/trainer-widget` (Kotlin, Expo Modules API) plus a config plugin in `app/plugins/trainer-widget.js`, following the three config plugins the repo already has. Nothing is hand-edited under `app/android`, which is generated by `expo prebuild` and untracked.

- The config plugin adds the Jetpack Glance dependencies (`glance-appwidget` and `glance-material3`, 1.2.0 or higher), registers the widget receiver in the manifest after the activity with its `appwidget-provider` XML, and adds the WorkManager dependency if the generated project lacks it.
- The module exposes two functions to JavaScript: `setConfig(endpoint, apiKey)` and `refresh()`. The app calls `setConfig` whenever the remote backup settings change and on startup, and `refresh` after every successful remote backup. Config lives in the module's own SharedPreferences, never in the widget's DataStore.
- The widget is a `GlanceAppWidget` with `SizeMode.Responsive` over two buckets, the 4x2 and 2x2 layouts above. State is the last `widget.json` plus the fetch time, in Glance's DataStore; a `CoroutineWorker` fetches the JSON, writes state and calls `updateAll`, as the android/skills `glance-appwidget-updates-and-memory` skill prescribes (`updateAppWidgetState` then an explicit update). The worker runs periodically every hour and on demand from `refresh()`, on widget enable, and on tap of the widget, with the periodic request kept unique so reinstalling never stacks workers.
- The widget renders text only: no bitmaps, no icons, so the memory cap guidance does not apply. `onCompositionError` still falls back to a text-only `RemoteViews`.
- Android `minSdk` stays as the project has it; Glance needs 26 and the app is already above that.

## Constraints

- The widget must never block on the network from the UI path; the UI reads state only.
- No counts or tallies beyond the three totals. No dark theme.
- American spelling in every string ("kilometers").
- The health repo has no GitHub remote and is deployed by `trainer/deploy.sh`; the receiver repo is private and its files must stay byte-identical to `/opt/liftlog-sync/src` on the box, with the image rebuilt after a change.
- Strings in the app side go through `src/i18n/en.json` only; widget strings on the native side go in the module's `strings.xml`.
- No Co-Authored-By trailers; no failure narrated in anything pushed.

## Build plan

1. Trainer, health repo: `trainer/widget.py` (pure compose from activities, stats, LiftLog payloads, plan), `widget_cmd` in `main.py`, tests in `tests/test_trainer_widget.py`, cron line and deploy. Verify with a dry run on the box and by reading the file back.
2. Receiver, liftlog-garmin-sync repo: `GET /widget`, the mount, the post-upload poke, tests for 401, 404 and 200. Rebuild the image on the box; curl it with the key from `/srv/liftlog-sync/api_key`.
3. LiftLog, this repo: local module, config plugin, Glance widget with both sizes, worker, JavaScript wiring from the remote backup settings. A new PR branched from `origin/main` (the widget touches none of the injury-mode files).
4. Phone: the phone runs the local-only `test/combined-23-27` branch (every open PR merged, never pushed), so the widget branch is merged into that test branch and the light build is made from it in the injury-mode worktree, as this run did for the pain-check switch and the graded return. `adb install -r`, add the widget to the home screen, confirm the real numbers appear, reboot the phone, confirm it survives. Building the widget branch alone would remove the six unmerged features from the phone. (The run's established pattern.)

Each of the three repos gets its own PR or commit, labeled when it happens. The LiftLog change is a PR (a user would notice a new widget).

## Left to the builder

- Exact Glance layout code; the mockup is the spec for proportions and hierarchy.
- How the receiver triggers the trainer refresh without Docker access.
- The worker's backoff on failure and the exact periodic interval within "every hour".
- Where the module stores config (SharedPreferences is the suggestion, not a requirement).

## Approval

Approved by Matt 2026-11-05 as written, including the calls marked "my call" above. No open questions.
