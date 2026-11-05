# Trainer widget implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Android home-screen widget in LiftLog that shows the trainer's next session and this week's kilometers ran, kilograms lifted and active minutes, from a JSON file the trainer publishes.

**Architecture:** The trainer (Python, health repo, runs as a Docker container on the Coolify box) gains a `widget` command that composes `widget.json` from Garmin, the LiftLog backup and the Gym calendar slots, written every minute of waking hours when something changed or the file is 30 minutes old. The existing backup receiver (`liftlog-garmin-sync/receiver.py`, at lifts.mindshine.io) serves that file at `GET /widget` under the backup's API key and touches a poke file after each upload. LiftLog gains a local Expo module `app/modules/trainer-widget` with a Jetpack Glance widget, a WorkManager worker that fetches the JSON, and a small JS effect that hands the module the remote-backup endpoint and key. The module's own `AndroidManifest.xml` and `build.gradle` carry the receiver, widget XML and dependencies, so no config plugin is needed (library manifests merge into the app at build time; `app/modules/workout-worker` already registers a service and a receiver this way).

**Tech Stack:** Python 3.12 (unittest), Kotlin with Jetpack Glance 1.2.0 and WorkManager 2.12.0 inside an Expo Modules API module, TypeScript with vitest in LiftLog.

**Spec:** `docs/superpowers/specs/2026-11-04-trainer-widget-design.md` (this repo). Read it first.

## Global constraints

- Three repos, three separate commits or PRs: health (`/Users/home/Projects/health`, no remote, commit to `main`, deploy with `trainer/deploy.sh`), liftlog-garmin-sync (`/Users/home/Projects/liftlog-garmin-sync`, private, files must stay byte-identical to `/opt/liftlog-sync/src` on the box), LiftLog (this repo, PR from `origin/main`).
- Commit and push only on Matt's explicit yes. Before any push: `git log --oneline origin/main..HEAD` and confirm every commit is from this run.
- American spelling in every string: "kilometers". Labels on the widget: "ran this week", "lifted", "active". Empty-state headlines: "Set up automatic remote backup in LiftLog" and "Waiting for the trainer".
- No counts, tallies, targets or percentages beyond the three totals. No dark theme. No icons, no bitmaps. One font (system), two weights (regular, medium).
- Colors, from the chosen mockup: background `#ffffff`, text `#1a1d23`, secondary text `#4b5563`, muted labels `#6b7280`. Layout A uses no accent color.
- Glance `glance-appwidget` and `glance-material3` 1.2.0, `work-runtime-ktx` 2.12.0, `datastore-preferences-core` 1.2.1. The generated project builds with Kotlin 2.1.20 (`@react-native/gradle-plugin`), compileSdk 36, minSdk 24. Glance 1.2.0 declares minSdk 23, under the project's 24, so the module keeps the project's SDK versions; the compile in Task 5 step 5 confirms the manifest merge accepts it.
- The widget's UI path reads Glance state only; every network call is in the worker.
- Widget strings live in the module's `res/values/strings.xml`; LiftLog's `src/i18n/en.json` is untouched (the app shows nothing new).
- No Co-Authored-By trailers. No failure narrated in any commit or PR.
- Tests: health `cd /Users/home/Projects/health && python3 -m unittest tests.test_trainer_widget`; receiver `cd /Users/home/Projects/liftlog-garmin-sync && python3 -m unittest tests.test_receiver`; LiftLog `cd /Users/home/Projects/LiftLog/app && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx vitest run`, `npx eslint .`, `npx tsgo --noEmit` (one known baseline error in `exercise-notes-display.tsx`); Kotlin `cd /Users/home/Projects/LiftLog/app/android && ./gradlew :trainer-widget:testDebugUnitTest`.
- The phone (Pixel, adb id `59300DLCH001L0`, package `com.limajuice.liftlog`) runs the local-only branch `test/combined-23-27` in the worktree `/Users/home/Projects/LiftLog-injury-mode`. The phone build merges the widget branch into that branch and installs with `adb install -r`. Never uninstall, never push `test/combined-23-27`.

## Review focus

1. A half-written or malformed `widget.json` reaching the phone (the worker reads it mid-replace, or a field is missing): the widget must keep showing the last good payload, never crash or blank. Pinned in Task 6 (`widgetView` with unparsable payload) and Task 5 (worker leaves state untouched when the body does not parse into `next` and `week`).
2. The trainer's timezone differs from the phone's (Matt traveling): "Today" and "Tomorrow" are decided in the payload's `timezone`, not the phone's. Pinned in Task 6 with `America/New_York` at 23:30 local.
3. The remote-backup endpoint is entered with a path, query or trailing slash (`https://lifts.mindshine.io/`, `https://lifts.mindshine.io/backup?x=1`) or is empty or not a URL: the widget URL is the origin plus `/widget`, and an invalid endpoint configures nothing. Pinned in Task 4.
4. The key is wrong or rotated (receiver answers 401) or the box is down: the worker records an error, keeps the old payload, retries with backoff, and the stale rule surfaces the age. Pinned in Task 5 (worker) and Task 6 (stale caption).
5. Calendar titles the trainer did not write: the placeholder "Gym", Matt's own "Shakeout run", or a mixed day "Pull + Base run": the title is shown as written, `is_run` is true only for an all-run day, and `line` for a mixed day is what follows. A Monday with nothing logged yet gives zeros, and a run under 20 minutes still counts in the kilometers. Pinned in Task 1.

---

## Part A: trainer (health repo)

### Task 1: `trainer/widget.py`, the pure compose

**Files:**
- Create: `/Users/home/Projects/health/trainer/widget.py`
- Test: `/Users/home/Projects/health/tests/test_trainer_widget.py`

**Interfaces:**
- Consumes: `trainer.sources.activities()` rows (`date`, `type`, `distance_m`, `minutes`), `trainer.sources.liftlog_payloads()` session dicts, `trainer.review.lifted(payloads, day)`, `trainer.calendar_writer.PREFIX` and `parse()`, `trainer.planner.REST` and `RUNS`, Garmin `get_stats(day)` dicts with `moderateIntensityMinutes` and `vigorousIntensityMinutes`.
- Produces:
  - `week_start(today: date) -> date` (the ISO Monday)
  - `week_totals(acts: list[dict], payloads: list[dict], stats_by_day: dict[date, dict], monday: date, today: date) -> dict` returning `{"run_km": float, "lifted_kg": int, "active_min": int}`
  - `trainer_line(e: dict) -> str | None` (the description line starting `Trainer:`, prefix stripped, or None)
  - `short(title: str, line: str | None) -> str` ("Base run 45 min" when the line starts with the title and a minute count, else the title)
  - `run_steps(title: str, line: str) -> str` (the line with the leading title and separator and any trailing ` (block week N)` removed)
  - `next_session(instances: dict[date, dict], today: date, done: set[date]) -> dict | None` returning `{"date": "YYYY-MM-DD", "title": str, "line": str, "is_run": bool}`
  - `compose(now_utc: datetime, tz: str, acts, payloads, stats_by_day, instances) -> dict | None` returning the full `widget.json` dict from the spec, or None when `next_session` is None

- [ ] **Step 1: Write the failing tests**

```python
"""Offline tests for the widget file (trainer.widget, docs/superpowers/specs/2026-11-04-trainer-widget-design.md in LiftLog).

Run:  python3 -m unittest tests.test_trainer_widget
"""
import unittest
from datetime import date, datetime, timezone

from trainer import widget as w
from tests.test_trainer_review import raw, acts, weighted

TODAY = date(2026, 11, 5)  # a Thursday


def slot(d, title, line=None):
    return {"id": f"gym_{d:%Y%m%d}", "summary": title, "start": {"dateTime": f"{d}T16:15:00+00:00"},
            "description": f"Trainer: {line}" if line else ""}


RUN_LINE = "Base run 45 min: 5 min warm-up, 35 min at 5:28-6:58/km, 5 min cool down (block week 3)"
INSTANCES = {
    date(2026, 11, 5): slot(date(2026, 11, 5), "Pull + Base run", f"Pull in LiftLog; {RUN_LINE}"),
    date(2026, 11, 6): slot(date(2026, 11, 6), "Rest day"),
    date(2026, 11, 7): slot(date(2026, 11, 7), "Shakeout run"),
    date(2026, 11, 8): slot(date(2026, 11, 8), "10K race", "10K race: Lisbon 10K. Nothing else today."),
    date(2026, 11, 9): slot(date(2026, 11, 9), "Legs", "Legs in LiftLog"),
    date(2026, 11, 10): slot(date(2026, 11, 10), "Base run", "Base run 85 min: 5 min warm-up, 75 min at 5:28-6:58/km, 5 min cool down (block week 4)"),
}
PULL = {"date": "2026-11-04", "blueprint": {"name": "Pull"}, "recordedExercises": [weighted("Row", [(50, 10), (50, 10)])]}
LAST_WEEK = {"date": "2026-11-01", "blueprint": {"name": "Push"}, "recordedExercises": [weighted("Bench", [(60, 8)])]}
STATS = {date(2026, 11, 2): {"moderateIntensityMinutes": 10, "vigorousIntensityMinutes": 20},
         date(2026, 11, 4): {"moderateIntensityMinutes": 30, "vigorousIntensityMinutes": 0}}


class Week(unittest.TestCase):
    def test_week_start_is_monday(self):
        self.assertEqual(w.week_start(TODAY), date(2026, 11, 2))
        self.assertEqual(w.week_start(date(2026, 11, 2)), date(2026, 11, 2))

    def test_totals(self):
        rows = acts(raw("running", 52, aid=1, start="2026-11-03 15:23:07", distance=8761.17),
                    raw("running", 12, aid=2, start="2026-11-04 07:00:00", distance=2000.0),
                    raw("running", 40, aid=3, start="2026-11-01 07:00:00", distance=7000.0),
                    raw("indoor_cycling", 30, aid=4, start="2026-11-04 08:00:00", distance=9000.0),
                    start=date(2026, 11, 1), end=TODAY)
        t = w.week_totals(rows, [PULL, LAST_WEEK], STATS, date(2026, 11, 2), TODAY)
        self.assertEqual(t, {"run_km": 10.8, "lifted_kg": 1000, "active_min": 80})

    def test_empty_week_is_zeros(self):
        self.assertEqual(w.week_totals([], [], {}, TODAY, TODAY), {"run_km": 0.0, "lifted_kg": 0, "active_min": 0})


class Lines(unittest.TestCase):
    def test_trainer_line_strips_prefix(self):
        self.assertEqual(w.trainer_line(INSTANCES[date(2026, 11, 10)]), "Base run 85 min: 5 min warm-up, 75 min at 5:28-6:58/km, 5 min cool down (block week 4)")
        self.assertIsNone(w.trainer_line(INSTANCES[date(2026, 11, 6)]))

    def test_run_steps(self):
        self.assertEqual(w.run_steps("Base run", RUN_LINE), "45 min: 5 min warm-up, 35 min at 5:28-6:58/km, 5 min cool down")
        self.assertEqual(w.run_steps("10K race", "10K race: Lisbon 10K. Nothing else today."), "Lisbon 10K. Nothing else today.")

    def test_short(self):
        self.assertEqual(w.short("Base run", RUN_LINE), "Base run 45 min")
        self.assertEqual(w.short("Legs", "Legs in LiftLog"), "Legs")
        self.assertEqual(w.short("Shakeout run", None), "Shakeout run")


class Next(unittest.TestCase):
    def test_today_mixed_day_shows_what_follows(self):
        n = w.next_session(INSTANCES, TODAY, set())
        self.assertEqual(n, {"date": "2026-11-05", "title": "Pull + Base run", "is_run": False,
                             "line": "Sat Shakeout run · Sun 10K race"})

    def test_today_done_moves_on_and_skips_rest(self):
        n = w.next_session(INSTANCES, TODAY, {TODAY})
        self.assertEqual(n["date"], "2026-11-07")
        self.assertEqual(n["title"], "Shakeout run")
        self.assertFalse(n["is_run"])
        self.assertEqual(n["line"], "Sun 10K race · Mon Legs")

    def test_run_day_shows_its_steps(self):
        n = w.next_session(INSTANCES, date(2026, 11, 10), set())
        self.assertEqual(n, {"date": "2026-11-10", "title": "Base run", "is_run": True,
                             "line": "85 min: 5 min warm-up, 75 min at 5:28-6:58/km, 5 min cool down"})

    def test_placeholder_title_as_written(self):
        inst = {TODAY: slot(TODAY, "Gym")}
        self.assertEqual(w.next_session(inst, TODAY, set())["title"], "Gym")

    def test_nothing_in_horizon(self):
        self.assertIsNone(w.next_session({TODAY: slot(TODAY, "Rest day")}, TODAY, set()))


class Compose(unittest.TestCase):
    def test_shape(self):
        now = datetime(2026, 11, 5, 19, 40, tzinfo=timezone.utc)
        rows = acts(raw("running", 52, aid=1, start="2026-11-03 15:23:07", distance=8761.17), start=date(2026, 11, 2), end=TODAY)
        out = w.compose(now, "Europe/Lisbon", rows, [PULL], STATS, INSTANCES)
        self.assertEqual(out["generated_at"], "2026-11-05T19:40:00Z")
        self.assertEqual(out["week_start"], "2026-11-02")
        self.assertEqual(out["timezone"], "Europe/Lisbon")
        self.assertEqual(out["next"]["title"], "Pull + Base run")
        self.assertEqual(out["week"], {"run_km": 8.8, "lifted_kg": 1000, "active_min": 80})

    def test_today_in_payload_timezone(self):
        now = datetime(2026, 11, 6, 3, 0, tzinfo=timezone.utc)  # still Thu 5 Nov in New York
        out = w.compose(now, "America/New_York", [], [], {}, INSTANCES)
        self.assertEqual(out["week_start"], "2026-11-02")
        self.assertEqual(out["next"]["date"], "2026-11-05")

    def test_done_today_from_garmin(self):
        now = datetime(2026, 11, 5, 19, 40, tzinfo=timezone.utc)
        rows = acts(raw("strength_training", 48, aid=9, start="2026-11-05 16:24:51"), start=TODAY, end=TODAY)
        out = w.compose(now, "Europe/Lisbon", rows, [], {}, INSTANCES)
        self.assertEqual(out["next"]["date"], "2026-11-07")

    def test_no_next_is_none(self):
        now = datetime(2026, 11, 5, 19, 40, tzinfo=timezone.utc)
        self.assertIsNone(w.compose(now, "Europe/Lisbon", [], [], {}, {}))
```

`raw`, `acts` and `weighted` are the helpers already in `tests/test_trainer_review.py`; import them rather than copying.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/home/Projects/health && python3 -m unittest tests.test_trainer_widget`
Expected: FAIL, `No module named 'trainer.widget'` (ImportError at collection).

- [ ] **Step 3: Implement `trainer/widget.py`**

Module docstring in the review.py style (what it is, how to run, "pure, main.widget_cmd wires the sources"). Rules to pin:

- `week_start`: `today - timedelta(today.weekday())`.
- `week_totals`: `run_km` is `round(sum(distance_m for a in acts if "running" in a["type"] and monday <= a["date"] <= today) / 1000, 1)`; `lifted_kg` is the sum of `rv.lifted(payloads, d)["kg"]` for each day Monday to today where `lifted` is not None; `active_min` is the sum over `stats_by_day` entries dated Monday to today of `moderate + 2 * vigorous`, missing values as 0.
- `trainer_line`: the first description line starting with `cw.PREFIX`, with the prefix and surrounding whitespace removed.
- `run_steps`: remove a leading `title` followed by `: ` or a space, then remove a trailing ` (block week N)` with `re.sub(r"\s*\(block week \d+\)\s*$", "", s)`.
- `short`: `re.match(rf"{re.escape(title)} \d+ min", line)` gives the match text; otherwise the title.
- `next_session`: walk `sorted(instances)` from `today`; skip a day whose title, stripped and lowercased, equals `p.REST.lower()`; skip `today` when it is in `done`; the first remaining day is next. `is_run` is `all(k in p.RUNS for k in cw.parse(title))` and the parse is not `(p.OTHER,)` and not empty. `line` is `run_steps(title, trainer_line(e))` when `is_run` and a trainer line exists, otherwise the next two non-rest days after it joined with ` · ` as `f"{d:%a} {short(title, trainer_line)}"`; with no following days the line is an empty string.
- `compose`: `today = now_utc.astimezone(ZoneInfo(tz)).date()`; `done = {a["date"] for a in acts if src.is_workout(a)} | {date.fromisoformat(s["date"][:10]) for s in payloads if s.get("date")}`; `generated_at` is `now_utc` as `%Y-%m-%dT%H:%M:%SZ`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/home/Projects/health && python3 -m unittest tests.test_trainer_widget tests.test_trainer_review`
Expected: all OK.

- [ ] **Step 5: Commit (just a commit, nothing a user sees yet)**

```bash
cd /Users/home/Projects/health && git add trainer/widget.py tests/test_trainer_widget.py && git commit -m "Compose the widget file from Garmin, LiftLog and the Gym slots"
```

### Task 2: the `widget` command, the tick script, cron and deploy

**Files:**
- Modify: `/Users/home/Projects/health/trainer/main.py` (docstring usage lines, `main()` choices, new `widget_cmd`)
- Create: `/Users/home/Projects/health/trainer/widget-tick.sh`
- Modify: `/Users/home/Projects/health/trainer/deploy.sh` (copy `widget-tick.sh` next to `run.sh`)
- Box: `/srv/trainer/widget/` directory, one crontab line

**Interfaces:**
- Consumes: `widget.compose` from Task 1; `src.garmin`, `src.activities`, `src.liftlog_payloads`, `src.Calendar.instances`, `src.instance_date`, `src.location`, `save_json`, `load_env`, `cfg` from `main.py`.
- Produces: `/srv/trainer/widget/widget.json` on the box (`TRAINER_STATE_DIR/widget/widget.json` in the container), rewritten atomically; `python3 -m trainer widget [--dry-run]`.

- [ ] **Step 1: Add `widget_cmd(args)` to `main.py`**

Signature `def widget_cmd(args) -> None`. Body, in order: `load_env()`; state dir; `tz` from Nearby as `review_cmd` does; `now_utc = datetime.now(timezone.utc)`; `today` in `tz`; `monday = wd.week_start(today)`; Garmin login; `acts = src.activities(g, monday, today)`; `payloads = src.liftlog_payloads(cfg("TRAINER_LIFTLOG"))`; `stats_by_day = {d: g.get_stats(d.isoformat()) or {} for d in days monday..today}`; calendar instances for `today` to `today + timedelta(HORIZON)` keyed by `src.instance_date`, inside `try/except Exception` that logs `widget: calendar failed, file kept: {e!r}` and returns; `out = wd.compose(...)`; when `out is None` log `widget: no next session in the horizon, file kept` and return; `--dry-run` prints `json.dumps(out, indent=1)` and returns; otherwise `(state_dir / "widget").mkdir(exist_ok=True)` and `save_json(state_dir / "widget" / "widget.json", out)`, then log `widget: wrote {next title} for {date}, {run_km} km, {lifted_kg} kg, {active_min} min`. Import the module as `from trainer import widget as wd`. Add `"widget"` to the argparse choices and dispatch it before `run(args)`. Add the usage line `python3 -m trainer widget [--dry-run]  # the home-screen widget's JSON (widget.py)` to the module docstring.

- [ ] **Step 2: Write `trainer/widget-tick.sh`**

A POSIX `sh` script, executable, run by cron every minute in waking hours. It refreshes when any of these holds, else exits 0 silently: `/srv/trainer/widget/widget.json` is missing; it is older than 30 minutes (`find /srv/trainer/widget -name widget.json -mmin +30`); `/srv/liftlog-sync/widget-poke` is newer than it; `/srv/trainer/state.json` is newer than it. Refresh means `exec /opt/trainer/run.sh widget`. Header comment: what each condition is for (periodic, backup landed, run or review finished).

- [ ] **Step 3: Update `deploy.sh`**

Change the `cp trainer/Dockerfile trainer/run.sh .` on the box to also copy `trainer/widget-tick.sh` and `chmod +x` it.

- [ ] **Step 4: Dry run locally against the fakes**

Run: `cd /Users/home/Projects/health && python3 -m unittest tests.test_trainer_widget tests.test_trainer_review tests.test_trainer_calendar`
Expected: all OK (main.py still imports).

- [ ] **Step 5: Commit, deploy, first run by hand**

Say it is a plain commit (nothing a user sees until the phone side lands). On Matt's yes:

```bash
cd /Users/home/Projects/health && git add trainer/main.py trainer/widget-tick.sh trainer/deploy.sh && git commit -m "Add the widget command and its minute tick"
sh trainer/deploy.sh
ssh root@91.98.23.69 'mkdir -p /srv/trainer/widget && /opt/trainer/run.sh widget --dry-run'
```

Expected: the JSON printed with today's real next session and the week's numbers. Then the real write and read-back:

```bash
ssh root@91.98.23.69 '/opt/trainer/run.sh widget && cat /srv/trainer/widget/widget.json'
```

- [ ] **Step 6: Add the cron line on the box**

Append to root's crontab (the trainer block already there):

```
# Trainer widget file: refresh when a backup landed, a run or review finished, or it is 30 min old.
* 6-23 * * * /opt/trainer/widget-tick.sh >> /var/log/trainer-widget.log 2>&1
```

Then run `/opt/trainer/widget-tick.sh` by hand once and `tail -3 /var/log/trainer-widget.log`. Expected: nothing written (file is fresh), exit 0; touch `/srv/liftlog-sync/widget-poke` and run it again, expected: a `widget: wrote` line.

## Part B: receiver (liftlog-garmin-sync)

### Task 3: `GET /widget` and the poke

**Files:**
- Modify: `/Users/home/Projects/liftlog-garmin-sync/receiver.py`
- Create: `/Users/home/Projects/liftlog-garmin-sync/tests/__init__.py` (empty), `/Users/home/Projects/liftlog-garmin-sync/tests/test_receiver.py`
- Modify: `/Users/home/Projects/liftlog-garmin-sync/README.md` (the `docker run` block gains the mount and env, one sentence on `/widget`)

**Interfaces:**
- Produces: `GET /widget` with header `X-Api-Key`: 401 `unauthorized\n` on a bad key, 404 empty body when the file is missing, 200 `application/json` with `Cache-Control: no-store` and the file bytes. Module globals `WIDGET = Path(os.environ.get("LIFTLOG_WIDGET", "/widget/widget.json"))` and `POKE = DATA / "widget-poke"`.

- [ ] **Step 1: Write the failing tests**

```python
"""Offline tests for receiver.py. Run: python3 -m unittest tests.test_receiver"""
import gzip
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

import receiver


class Server(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        receiver.API_KEY = "k" * 64
        receiver.DATA = self.tmp
        receiver.INBOX = self.tmp / "inbox"
        receiver.POKE = self.tmp / "widget-poke"
        receiver.WIDGET = self.tmp / "widget" / "widget.json"
        self.srv = ThreadingHTTPServer(("127.0.0.1", 0), receiver.Handler)
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.srv.server_port}"

    def tearDown(self):
        self.srv.shutdown()

    def get(self, path, key=None):
        req = urllib.request.Request(self.base + path, headers={"X-Api-Key": key} if key else {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, e.read(), dict(e.headers)

    def test_widget_needs_key(self):
        self.assertEqual(self.get("/widget")[0], 401)
        self.assertEqual(self.get("/widget", "wrong")[0], 401)

    def test_widget_missing_is_404_empty(self):
        code, body, _ = self.get("/widget", receiver.API_KEY)
        self.assertEqual((code, body), (404, b""))

    def test_widget_serves_file(self):
        receiver.WIDGET.parent.mkdir()
        receiver.WIDGET.write_text('{"next": {"title": "Pull"}}')
        code, body, headers = self.get("/widget", receiver.API_KEY)
        self.assertEqual(code, 200)
        self.assertEqual(body, b'{"next": {"title": "Pull"}}')
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_other_paths_still_404(self):
        self.assertEqual(self.get("/widget/", receiver.API_KEY)[0], 404)
        self.assertEqual(self.get("/widget?x=1", receiver.API_KEY)[0], 404)

    def test_backup_touches_poke(self):
        body = gzip.compress(b"sqlite")
        req = urllib.request.Request(self.base + "/", data=body, method="POST",
                                     headers={"X-Api-Key": receiver.API_KEY, "Content-Type": "application/octet-stream"})
        with urllib.request.urlopen(req) as r:
            self.assertEqual(r.status, 200)
        self.assertTrue(receiver.POKE.exists())
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/home/Projects/liftlog-garmin-sync && python3 -m unittest tests.test_receiver`
Expected: `test_widget_needs_key` and `test_widget_missing_is_404_empty` FAIL (404 with `not found\n` body, headers without Cache-Control); `test_backup_touches_poke` FAIL on `POKE`.

- [ ] **Step 3: Implement**

In `do_GET`, before the final 404: `if self.path == "/widget":` check the key exactly as `do_POST` does (same `hmac.compare_digest`, same log line with GET); 404 with empty body when `not WIDGET.exists()`; else read bytes and send 200 with `Content-Type: application/json`, `Cache-Control: no-store`, `Content-Length`. Factor the key check into `def _authorized(self) -> bool` used by both handlers. At the end of a successful `do_POST`, before `self._send(200, "stored\n")`: `POKE.touch()`. Update the module docstring: one sentence that `/widget` serves the trainer's widget file under the same key. Update the README `docker run` block with `-v /srv/trainer/widget:/widget:ro` and `-e LIFTLOG_WIDGET=/widget/widget.json`, and one sentence under "How it runs".

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/home/Projects/liftlog-garmin-sync && python3 -m unittest tests.test_receiver`
Expected: 5 OK.

- [ ] **Step 5: Commit (just a commit) and redeploy on Matt's yes**

```bash
cd /Users/home/Projects/liftlog-garmin-sync && git add receiver.py tests README.md && git commit -m "Serve the trainer's widget file and poke it after each backup"
scp receiver.py README.md root@91.98.23.69:/opt/liftlog-sync/src/
ssh root@91.98.23.69 'cd /opt/liftlog-sync/src && docker build -q -t liftlog-sync:latest . && docker rm -f liftlog-sync'
```

Then recreate the container with the README's `docker run` command, the key read on the box from `/srv/liftlog-sync/api_key` (never printed here), `--network coolify --memory 256m`, the existing Traefik labels for `lifts.mindshine.io` (read them back first with `docker inspect liftlog-sync --format '{{json .Config.Labels}}'` before the `rm`), plus the two new flags. Verify:

```bash
ssh root@91.98.23.69 'curl -s -o /dev/null -w "%{http_code}\n" https://lifts.mindshine.io/health; curl -s -H "X-Api-Key: $(cat /srv/liftlog-sync/api_key)" https://lifts.mindshine.io/widget | head -c 300'
```

Expected: `200` and the JSON from Task 2. Also `cmp` each file in `/opt/liftlog-sync/src` against the repo to confirm they are byte-identical.

## Part C: LiftLog

### Task 4: branch, docs, and the widget URL

**Files:**
- Create: `app/src/utils/trainer-widget-url.ts`, `app/src/utils/trainer-widget-url.spec.ts`
- Commit: `docs/superpowers/specs/2026-11-04-trainer-widget-design.md`, `docs/superpowers/plans/2026-11-05-trainer-widget.md`

**Interfaces:**
- Produces: `export function trainerWidgetUrl(endpoint: string | undefined): string | null` returning `${origin}/widget` for an `https:` or `http:` endpoint, `null` for empty, whitespace or unparsable input.

- [ ] **Step 1: Branch from the remote**

```bash
cd /Users/home/Projects/LiftLog && git fetch origin && git checkout -b trainer-widget origin/main && git add docs/superpowers && git commit -m "Design and plan for the trainer widget"
```

Note `.superpowers/` and `.playwright-mcp/` are untracked and stay so.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { trainerWidgetUrl } from '@/utils/trainer-widget-url';

describe('trainerWidgetUrl', () => {
  it('is the origin plus /widget', () => {
    expect(trainerWidgetUrl('https://lifts.mindshine.io')).toBe('https://lifts.mindshine.io/widget');
    expect(trainerWidgetUrl('https://lifts.mindshine.io/')).toBe('https://lifts.mindshine.io/widget');
    expect(trainerWidgetUrl(' https://lifts.mindshine.io/backup?x=1 ')).toBe('https://lifts.mindshine.io/widget');
    expect(trainerWidgetUrl('https://host:8443/x')).toBe('https://host:8443/widget');
  });
  it('is null when there is no usable endpoint', () => {
    expect(trainerWidgetUrl(undefined)).toBeNull();
    expect(trainerWidgetUrl('')).toBeNull();
    expect(trainerWidgetUrl('   ')).toBeNull();
    expect(trainerWidgetUrl('not a url')).toBeNull();
    expect(trainerWidgetUrl('ftp://x')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /Users/home/Projects/LiftLog/app && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx vitest run src/utils/trainer-widget-url.spec.ts`
Expected: FAIL, cannot resolve the module.

- [ ] **Step 4: Implement with `new URL(endpoint.trim())` in a try/catch**, protocol must be `https:` or `http:`.

- [ ] **Step 5: Run it to verify it passes**, then commit:

```bash
cd /Users/home/Projects/LiftLog && git add app/src/utils/trainer-widget-url.ts app/src/utils/trainer-widget-url.spec.ts && git commit -m "Derive the trainer widget URL from the remote backup endpoint"
```

### Task 5: the native module: config, worker, scheduling

**Files:**
- Create under `app/modules/trainer-widget/`:
  - `expo-module.config.json`
  - `index.ts`, `src/TrainerWidgetModule.ts`
  - `android/build.gradle`
  - `android/src/main/AndroidManifest.xml`
  - `android/src/main/res/xml/trainer_widget_info.xml`
  - `android/src/main/res/values/strings.xml`
  - `android/src/main/java/expo/modules/trainerwidget/TrainerWidgetModule.kt`
  - `android/src/main/java/expo/modules/trainerwidget/WidgetConfig.kt`
  - `android/src/main/java/expo/modules/trainerwidget/WidgetWork.kt`
  - `android/src/main/java/expo/modules/trainerwidget/WidgetFetchWorker.kt`
  - `android/src/main/java/expo/modules/trainerwidget/WidgetState.kt`
  - `android/src/main/java/expo/modules/trainerwidget/TrainerWidgetReceiver.kt` (placeholder receiver until Task 7 fills the widget)
- Test: `android/src/test/java/expo/modules/trainerwidget/WidgetFetchWorkerTest.kt` is not written (the worker is thin glue over HttpURLConnection and WorkManager); its parse guard lives in `WidgetState.parsePayload` and is tested in Task 6.

**Interfaces:**
- Consumes: nothing from the app yet.
- Produces, JS side (`src/TrainerWidgetModule.ts`): `setConfig(url: string | null, apiKey: string | null): void` and `refresh(): void`, exported as a default object; on iOS and web the functions are no-ops (`requireOptionalNativeModule('TrainerWidget')` returns null there).
- Produces, Kotlin side:
  - `object WidgetConfig { fun save(ctx: Context, url: String?, key: String?); fun url(ctx): String?; fun key(ctx): String?; fun configured(ctx): Boolean }` over SharedPreferences file `trainer_widget`, keys `url` and `api_key`; `configured` is both non-blank.
  - `object WidgetWork { fun schedulePeriodic(ctx); fun refreshNow(ctx, delaySeconds: Long = 0) }`: periodic unique name `trainer-widget-periodic`, 1 hour with 15 minute flex, `ExistingPeriodicWorkPolicy.KEEP`, constraint `NetworkType.CONNECTED`; one-time unique name `trainer-widget-now`, `ExistingWorkPolicy.REPLACE`, same constraint, exponential backoff 10 minutes.
  - `class WidgetFetchWorker(ctx, params) : CoroutineWorker`: when not configured, returns `Result.success()` without touching state. Otherwise GET `url` with `X-Api-Key`, connect and read timeouts 15 s. 200 and `WidgetState.parsePayload(body) != null`: write state `payload=body`, `fetched_at=now`, `status="ok"`. 404: `status="missing"`, `fetched_at=now`, payload untouched. Anything else or an exception: `status="error"`, payload untouched, `Result.retry()`. After every state write: `TrainerWidget().updateAll(ctx)`. State writes go through `updateAppWidgetState(ctx, PreferencesGlanceStateDefinition, id)` for each id from `GlanceAppWidgetManager(ctx).getGlanceIds(TrainerWidget::class.java)`.
  - `object WidgetState { val PAYLOAD = stringPreferencesKey("payload"); val FETCHED_AT = longPreferencesKey("fetched_at"); val STATUS = stringPreferencesKey("status"); fun parsePayload(json: String): Payload? }` where `Payload` is a Kotlin data class mirroring the spec's JSON (`generatedAt: String`, `weekStart: String`, `timezone: String`, `next: Next(date, title, line, isRun)`, `week: Week(runKm: Double, liftedKg: Long, activeMin: Long)`), parsed with `org.json`; any missing field returns null.
  - `TrainerWidgetModule : Module()` with `Name("TrainerWidget")`, `Function("setConfig") { url: String?, key: String? -> WidgetConfig.save; WidgetWork.schedulePeriodic; WidgetWork.refreshNow }`, `Function("refresh") { WidgetWork.refreshNow(ctx, delaySeconds = 90) }` (the trainer needs up to a minute to rewrite the file after a backup lands), and `OnActivityEntersForeground { WidgetWork.refreshNow(ctx) }` (a tap opens the app, which is the refresh on tap).

- [ ] **Step 1: Write the module config and gradle**

`expo-module.config.json`: `{"platforms": ["android"], "android": {"modules": ["expo.modules.trainerwidget.TrainerWidgetModule"]}}`.

`android/build.gradle`: copy the skeleton of `app/modules/workout-worker/android/build.gradle` without the JSON codegen parts; `group = 'expo.modules.trainerwidget'`, `namespace "expo.modules.trainerwidget"`, same `useManagedAndroidSdkVersions = false` block. Add a `buildscript` block with `classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:${kotlinVersion()}")` (the `kotlinVersion` closure comes from `applyKotlinExpoModulesCorePlugin()`; `node_modules/expo-modules-core/android/build.gradle` line 16 is the pattern) and `apply plugin: 'org.jetbrains.kotlin.plugin.compose'` after `applyKotlinExpoModulesCorePlugin()`. Dependencies: `androidx.glance:glance-appwidget:1.2.0`, `androidx.glance:glance-material3:1.2.0`, `androidx.work:work-runtime-ktx:2.12.0`, `androidx.datastore:datastore-preferences-core:1.2.1`, `testImplementation 'junit:junit:4.13.2'`, `testImplementation 'org.json:json:20250107'` (the `org.json` classes in `android.jar` are stubs on the JVM, so without this the Task 6 tests throw "not mocked").

- [ ] **Step 2: Write the manifest and the widget XML**

Manifest: `<receiver android:name=".TrainerWidgetReceiver" android:exported="true" android:label="@string/widget_label">` with the `android.appwidget.action.APPWIDGET_UPDATE` intent filter and `<meta-data android:name="android.appwidget.provider" android:resource="@xml/trainer_widget_info" />`.

`trainer_widget_info.xml`: `minWidth 250dp`, `minHeight 110dp`, `minResizeWidth 110dp`, `minResizeHeight 110dp`, `targetCellWidth 4`, `targetCellHeight 2`, `resizeMode horizontal|vertical`, `updatePeriodMillis 0`, `widgetCategory home_screen`, `description @string/widget_description`.

`strings.xml`: `widget_label` "Trainer", `widget_description` "Next session and this week's kilometers, kilograms and minutes", `widget_not_configured` "Set up automatic remote backup in LiftLog", `widget_waiting` "Waiting for the trainer", `widget_today` "Today", `widget_tomorrow` "Tomorrow", `widget_updated` "updated %1$s", `widget_ran` "ran this week", `widget_lifted` "lifted", `widget_active` "active", `widget_km` "km", `widget_kg` "kg", `widget_min` "min".

- [ ] **Step 3: Write the Kotlin files from the Interfaces block** (`TrainerWidgetReceiver` is `class TrainerWidgetReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget = TrainerWidget(); override fun onEnabled(ctx) { super.onEnabled(ctx); WidgetWork.schedulePeriodic(ctx); WidgetWork.refreshNow(ctx) } }`; until Task 7, `TrainerWidget` is a `GlanceAppWidget` whose `provideGlance` shows one `Text("Trainer")`).

- [ ] **Step 4: Write the TS binding**

`src/TrainerWidgetModule.ts`: `import { requireOptionalNativeModule } from 'expo'`; `const native = requireOptionalNativeModule<{ setConfig(url: string | null, apiKey: string | null): void; refresh(): void }>('TrainerWidget')`; export default `{ setConfig: (url, apiKey) => native?.setConfig(url, apiKey), refresh: () => native?.refresh() }`. `index.ts` re-exports the default.

- [ ] **Step 5: Compile the module**

Run: `cd /Users/home/Projects/LiftLog/app/android && ./gradlew :trainer-widget:compileDebugKotlin`
Expected: BUILD SUCCESSFUL. (Autolinking names the project after the folder, as `:workout-worker` shows; confirm with `PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx expo-modules-autolinking resolve -p android | grep trainer-widget`.)

- [ ] **Step 6: Commit**

```bash
cd /Users/home/Projects/LiftLog && git add app/modules/trainer-widget && git commit -m "Trainer widget module: config, fetch worker, scheduling"
```

### Task 6: `WidgetModel.kt`, the pure view decision, with JUnit tests

**Files:**
- Create: `app/modules/trainer-widget/android/src/main/java/expo/modules/trainerwidget/WidgetModel.kt`
- Test: `app/modules/trainer-widget/android/src/test/java/expo/modules/trainerwidget/WidgetModelTest.kt`

**Interfaces:**
- Consumes: `WidgetState.parsePayload` and `Payload` from Task 5.
- Produces:
  - `data class Copy(val notConfigured: String, val waiting: String, val today: String, val tomorrow: String, val updated: String /* "updated %1$s" */, val ran: String, val lifted: String, val active: String, val km: String, val kg: String, val min: String)`
  - `data class Total(val number: String, val unit: String, val label: String)`
  - `data class WidgetView(val caption: String?, val headline: String, val line: String?, val totals: List<Total>)` (totals empty in the two empty states; order km, kg, min)
  - `fun widgetView(configured: Boolean, payload: String?, nowMs: Long, copy: Copy): WidgetView`
  - `const val STALE_MS = 6 * 60 * 60 * 1000L`

- [ ] **Step 1: Write the failing tests**

```kotlin
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
        val ny = payload.replace("Europe/Lisbon", "America/New_York")
        // 04:30 UTC on the 5th is 23:30 on the 4th in New York: still Tomorrow there.
        assertEquals("Tomorrow", widgetView(true, ny, at("2026-11-05T04:30:00Z"), copy).caption)
        assertEquals("Today", widgetView(true, payload, at("2026-11-05T04:30:00Z"), copy).caption)
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd /Users/home/Projects/LiftLog/app/android && ./gradlew :trainer-widget:testDebugUnitTest`
Expected: compilation FAILS on unresolved `widgetView`, `Copy`, `Total`, `WidgetView`.

- [ ] **Step 3: Implement `widgetView`**

Rules: not configured gives `notConfigured`; null or unparsable payload gives `waiting`; otherwise `today = Instant.ofEpochMilli(nowMs).atZone(ZoneId.of(payload.timezone)).toLocalDate()`, `next = LocalDate.parse(payload.next.date)`; the day word is `copy.today` when equal, `copy.tomorrow` when `next == today + 1`, else `next.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)`; when `nowMs - Instant.parse(payload.generatedAt).toEpochMilli() > STALE_MS` append `" · " + copy.updated.format(generatedAt in payload tz as "EEE HH:mm", Locale.US)`. Numbers: km `String.format(Locale.US, "%.1f", runKm)`, kg `NumberFormat.getIntegerInstance(Locale.US).format(liftedKg)`, min the same formatter. `line` is `payload.next.line`, or null when blank.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/home/Projects/LiftLog/app/android && ./gradlew :trainer-widget:testDebugUnitTest`
Expected: BUILD SUCCESSFUL, 9 tests passed (see `app/modules/trainer-widget/android/build/reports/tests/testDebugUnitTest/index.html`).

- [ ] **Step 5: Commit**

```bash
cd /Users/home/Projects/LiftLog && git add app/modules/trainer-widget && git commit -m "Trainer widget: decide the headline, caption and totals from the fetched file"
```

### Task 7: the Glance layout, both sizes, and the tap

**Files:**
- Create: `app/modules/trainer-widget/android/src/main/java/expo/modules/trainerwidget/TrainerWidget.kt` (replaces the Task 5 placeholder)

**Interfaces:**
- Consumes: `widgetView`, `WidgetConfig.configured`, `WidgetState` keys, strings from `strings.xml`.
- Produces: `class TrainerWidget : GlanceAppWidget()` with `override val sizeMode = SizeMode.Responsive(setOf(WIDE, SMALL))` where `WIDE = DpSize(250.dp, 110.dp)` and `SMALL = DpSize(110.dp, 110.dp)`, `override val stateDefinition = PreferencesGlanceStateDefinition`, and `override fun onCompositionError(context, glanceId, appWidgetId, throwable)` that sets a `RemoteViews` built from `android.R.layout.simple_list_item_1` carrying `widget_waiting`.

- [ ] **Step 1: Write `provideGlance`**

`provideContent { val prefs = currentState<Preferences>(); val view = widgetView(WidgetConfig.configured(context), prefs[WidgetState.PAYLOAD], System.currentTimeMillis(), copyFrom(context.resources)); val size = LocalSize.current; if (size.width >= WIDE.width) Wide(view) else Small(view) }`. Both layouts sit in a `Column` with `GlanceModifier.fillMaxSize().background(Color(0xFFFFFFFF)).cornerRadius(12.dp).padding(14.dp).clickable(actionStartActivity(openIntent(context)))`, where `openIntent` is `Intent(Intent.ACTION_VIEW, Uri.parse("liftlog:///")).setPackage(context.packageName).addFlags(FLAG_ACTIVITY_NEW_TASK)` (the `liftlog` scheme is in `app.json`; `/` is the `(session)` route, the Workout tab).

Wide: caption `Text` 11sp, `#6b7280`, medium weight, uppercase via `.uppercase(Locale.US)`; headline 20sp medium `#1a1d23`, `maxLines = 1`; line 13sp `#4b5563`, `maxLines = 1`; then `Spacer(defaultWeight())`; then a `Row` of the three totals, each a `Column` with a `Row` of number (20sp medium `#1a1d23`) and unit (12sp `#6b7280`) over the label (11sp `#6b7280`). When `totals` is empty the row is not emitted and the headline gets `maxLines = 2`.

Small: caption, headline (`maxLines = 2`), `Spacer`, the first total only. No line.

`copyFrom(res: Resources): Copy` reads the eleven `widget_*` strings the `Copy` fields name.

- [ ] **Step 2: Compile**

Run: `cd /Users/home/Projects/LiftLog/app/android && ./gradlew :trainer-widget:compileDebugKotlin :trainer-widget:testDebugUnitTest`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
cd /Users/home/Projects/LiftLog && git add app/modules/trainer-widget && git commit -m "Trainer widget: the 4x2 and 2x2 layouts"
```

### Task 8: JS wiring from the remote backup settings

**Files:**
- Create: `app/src/services/trainer-widget-service.ts`, `app/src/store/settings/trainer-widget-effects.ts`, `app/src/store/settings/trainer-widget-effects.spec.ts`
- Modify: `app/src/services/index.ts` (add `trainerWidgetService` to the resolved services), `app/src/store/settings/effects.ts` (call `addTrainerWidgetEffects(addEffect)` next to `addRemoteBackupEffects`)

**Interfaces:**
- Consumes: `trainerWidgetUrl` (Task 4), the module default export (Task 5), actions `setRemoteBackupSettings` and `remoteBackupSucceeded` from `@/store/settings`, `createAddEffectTestBed` from `@/utils/__test__/add-effect-testbed`.
- Produces: `export interface TrainerWidgetService { setConfig(url: string | null, apiKey: string | null): void; refresh(): void }` and `export class NativeTrainerWidgetService implements TrainerWidgetService` delegating to the module; `export function addTrainerWidgetEffects(addEffect: AddEffectFn): void`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { remoteBackupSucceeded, setRemoteBackupSettings } from '@/store/settings';
import { addTrainerWidgetEffects } from '@/store/settings/trainer-widget-effects';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';

function bed() {
  const trainerWidgetService = { setConfig: vi.fn(), refresh: vi.fn() };
  const testBed = createAddEffectTestBed({ services: { trainerWidgetService } });
  addTrainerWidgetEffects(testBed.addEffect);
  return { testBed, trainerWidgetService };
}

describe('addTrainerWidgetEffects', () => {
  it('hands the widget the origin plus /widget and the key', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(
      setRemoteBackupSettings({ endpoint: 'https://lifts.mindshine.io/', apiKey: ' k ', includeFeedAccount: false }),
    );
    expect(trainerWidgetService.setConfig).toHaveBeenCalledWith('https://lifts.mindshine.io/widget', 'k');
  });

  it('clears the config when the endpoint is removed', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(setRemoteBackupSettings({ endpoint: '', apiKey: '', includeFeedAccount: false }));
    expect(trainerWidgetService.setConfig).toHaveBeenCalledWith(null, null);
  });

  it('refreshes after a backup lands', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(remoteBackupSucceeded());
    expect(trainerWidgetService.refresh).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/home/Projects/LiftLog/app && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx vitest run src/store/settings/trainer-widget-effects.spec.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

The service file exports the interface and the native class (`import TrainerWidget from '~/modules/trainer-widget'`). In `services/index.ts` add `const trainerWidgetService: TrainerWidgetService = new NativeTrainerWidgetService();` and include it in the returned object. The effects: on `setRemoteBackupSettings`, `const url = trainerWidgetUrl(action.payload.endpoint); const key = action.payload.apiKey?.trim() || null; trainerWidgetService.setConfig(url, url ? key : null)`; on `remoteBackupSucceeded`, `trainerWidgetService.refresh()`. Register in `applySettingsEffects` right after `addRemoteBackupEffects(addEffect)`. The `setRemoteBackupSettings` dispatched at hydration (effects.ts line 96) means startup is covered.

- [ ] **Step 4: Run the whole suite, lint and types**

Run: `cd /Users/home/Projects/LiftLog/app && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx vitest run && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx eslint . && PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx tsgo --noEmit`
Expected: vitest all pass (baseline 800 plus the new ones), eslint clean, tsgo only the known `exercise-notes-display.tsx` 'visibility' error.

- [ ] **Step 5: Commit**

```bash
cd /Users/home/Projects/LiftLog && git add app/src/services/trainer-widget-service.ts app/src/services/index.ts app/src/store/settings/trainer-widget-effects.ts app/src/store/settings/trainer-widget-effects.spec.ts app/src/store/settings/effects.ts && git commit -m "Give the trainer widget the remote backup endpoint and key"
```

### Task 9: the phone, then the PR

**Files:** none new. Worktree `/Users/home/Projects/LiftLog-injury-mode`, branch `test/combined-23-27`.

- [ ] **Step 1: Merge into the combined test branch**

```bash
cd /Users/home/Projects/LiftLog-injury-mode && git merge --no-edit trainer-widget
```

Expected: a clean merge (the widget touches no injury-mode file; `services/index.ts` and `settings/effects.ts` are the only shared files and the additions are new lines).

- [ ] **Step 2: Build and install**

From `/Users/home/Projects/LiftLog-injury-mode/app` with the Pixel connected: `PATH="/opt/homebrew/opt/node@25/bin:$PATH" npx expo run:android --variant debugOptimized --device 59300DLCH001L0` (the `android` script in `package.json`, which builds, installs over the existing app and keeps its data). If it builds but does not install, `adb -s 59300DLCH001L0 install -r android/app/build/outputs/apk/debugOptimized/app-debugOptimized.apk`. Confirm with `adb -s 59300DLCH001L0 shell dumpsys package com.limajuice.liftlog | grep lastUpdateTime`.

- [ ] **Step 3: Add the widget and check it**

On the phone: long-press the home screen, Widgets, LiftLog, "Trainer", place the 4x2. Screenshot over adb (`adb -s 59300DLCH001L0 exec-out screencap -p > <scratchpad>/widget-1.png`) and read it. Expected: today's real next session as the headline (matching `ssh root@91.98.23.69 'cat /srv/trainer/widget/widget.json'`), the three totals with this week's real numbers. If the headline reads "Waiting for the trainer", open LiftLog once (foreground refresh) and check again. Then resize to 2x2 and screenshot. Tap it: LiftLog opens on the Workout tab.

- [ ] **Step 4: Reboot and check it survives**

`adb -s 59300DLCH001L0 reboot`, wait for the lock screen, unlock, screenshot the home screen. Expected: the widget shows the same content.

- [ ] **Step 5: Log a lift and watch it move**

After Matt's next LiftLog session is backed up (or `Test` on the remote backup screen): within about two minutes the widget's kilograms change. `tail -3 /var/log/trainer-widget.log` on the box shows the write.

- [ ] **Step 6: PR, on Matt's yes**

It is a PR (a user would notice a new widget). From `/Users/home/Projects/LiftLog` on `trainer-widget`: `git log --oneline origin/main..HEAD` lists only this run's commits; push; open the PR against `main` with the two-line body:

```
A home-screen widget shows the trainer's next session and this week's kilometers, kilograms and minutes.
The plan and the week's progress were only visible by opening the calendar and the app.
```

Then update the burndown run file (task 8 state, log line) and ask Matt whether to close the Todoist task.
