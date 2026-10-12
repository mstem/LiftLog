# Injury mode, part 1: LiftLog core

Date: 2026-10-11. Status: draft for review.

## Problem

A lifter with an active shoulder injury keeps getting full Push/Pull/Legs sessions at pre-injury weights from LiftLog. Personal bests compare every set against numbers that cannot be lifted right now. Injury mode makes LiftLog program around an injury until it is resolved.

This is part 1 of 3. Part 2 syncs the injury with the health app through the lifelog server. Part 3 adds a heat pack card to hitlist on rehab days. Part 1 works on its own with an injury entered in LiftLog.

## Evidence the design rests on

A research pass on 2026-10-11 found no trial that cuts load by a fixed percentage or picks lifts by primary versus secondary muscle. Protocols set load by pain response, so this design does too.

- Pain monitoring model: pain during exercise up to 5/10, and back to the pre-exercise level before the next session; otherwise load drops. Holmgren et al. 2012, BMJ 344:e787, https://pmc.ncbi.nlm.nih.gov/articles/PMC3282676/ . The model comes from Silbernagel et al. 2007, AJSM, https://doi.org/10.1177/0363546506298279 .
- Of 86 RCTs on rotator-cuff-related shoulder pain, 67% set no pain rule. Those that did mostly used 3/10 or 4/10, and the thresholds are pragmatic. https://pmc.ncbi.nlm.nih.gov/articles/PMC11846222/
- Heavy loading was safe and no better than light loading. Ingwersen et al. 2017, OJSM, https://doi.org/10.1177/2325967117723292 . Protocol: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4318133/fullTextXML
- Self-managed loaded exercise: Littlewood et al., https://pmc.ncbi.nlm.nih.gov/articles/PMC3406993/
- Scapular exercise selection: Cools et al. 2014, BJSM 48:692, https://pubmed.ncbi.nlm.nih.gov/23687006/
- Test accuracy is limited. Painful arc: 53% sensitivity, 76% specificity (Hegedus 2012, https://pubmed.ncbi.nlm.nih.gov/22773322/). No scapular test separates pathologies (Wright 2013, https://doi.org/10.1136/bjsports-2012-091573). The self-screen therefore screens and routes; it does not diagnose.

The 50% first cut and the progression step size are design choices, not sourced numbers.

## Decisions

- Pain ceiling 5/10 (Holmgren).
- First cut 50% on flagged lifts.
- Lifts are flagged by position, not muscle.
- Rehab exercises are appended to gym-day sessions, at RoCTEx-style frequency (about 3 a week).
- Bests count sessions since the injury while it is active. All-time bests show in an Archive list. When the injury is resolved, bests return to all-time. No data is deleted.
- LiftLog owns injury programming. The trainer only reads LiftLog sessions.

## Scope

In: injury state, self-screen, position flags, the load rule with pain taps, the rehab block, and since-injury bests with an archive.

Out: sync with health or lifelog (part 2), the hitlist card (part 3), injuries outside the shoulder (the model allows them, but only the shoulder flag and rehab list ship), and swapping flagged lifts for alternatives (the existing swap dialog covers this by hand).

## Design

### 1. Injury state

A new Redux slice `injury`, following the pattern in `app/src/store/settings/`, persisted as JSON through `app/src/services/key-value-store.ts`:

```
{ slug, name, side: 'left' | 'right', structures: string[], onsetDate, painLimit: 5, firstCut: 0.5, status: 'active' | 'resolved', screenFindings, trackedFrom }
```

The app ships no personal defaults. Name, side, onset date and structures are entered on the device; the self-screen asks for the side when it starts a new injury. Injury settings are written into every backup file, local and remote, as an `injury_state` table, and a restore brings them back. Backups made before this have no table and leave the current settings alone.

`trackedFrom` is when injury mode was turned on. Injury-era history is work done on or after the onset date and after `trackedFrom`, so workouts logged between onset and turning the mode on still get the first cut. Injuries stored before this field existed are read with the start of the onset day.

Settings gets an Injury mode row: turn it on, enter or edit the injury, and mark it resolved. Only one injury is active at a time. Edits are saved when leaving the screen. Once an injury is resolved, starting injury mode again begins a fresh injury dated today; the shoulder-loaded overrides are kept.

### 2. Self-screen

The screen runs when injury mode is first turned on, and can be re-run from settings. Every page states that this is a screen, not a diagnosis, and that a physio's assessment comes first.

1. Red flags: trauma followed by weakness or a sudden inability to lift the arm; fever or a hot, swollen joint; unexplained weight loss or a history of cancer. Any yes ends the flow with "see a clinician now" and leaves injury mode off. On a re-run over an active injury, injury mode stays on and the message says so, because turning it off would restore full loads.
2. Self-checks, each with a short instruction:
   - Painful arc: pain between about 60° and 120° when raising the arm sideways.
   - Drop arm: does the arm drop when lowered slowly from overhead?
   - Active versus passive range: does the arm go further when the other hand lifts it?
   - Neck: does the pain change with neck movement, or are there pins and needles below the elbow?
3. Routing. If passive range is as limited as active range, if drop arm is positive together with a painful arc, or if the neck answer is yes, show "see a physio before loading". The user can still continue.
4. Candidate structures. Painful arc points to supraspinatus. Scapular symptoms point to serratus anterior, lower and middle trapezius, and rhomboids. These are suggestions the user confirms or edits. Results are stored in `screenFindings` and `structures`.

### 3. Position flags

The flag is not stored on `ExerciseDescriptor` (`app/src/models/exercise-models.ts`), which is unchanged. It is computed by the heuristic below, and overrides live in the injury slice.

The heuristic seed flags a lift when its name contains overhead, military, shoulder press, behind (the) neck, upright row, dip, or bench/floor press, or when its force is push and shoulders is the primary muscle. Primary muscles for the heuristic are read from the bundled `assets/exercises.json` by name, because built-in rows are copied into the database once and would never gain a new field. Standing Military Press and Barbell Bench Press are flagged. Barbell Squat and Barbell Curl are not. Overrides are stored in the injury slice and edited on the Injury settings screen, which lists the program's lifts with switches. The exercise editor is not changed.

### 4. Load rule

All of this lives in `app/src/services/session-service.ts`, `getNextExercise`, and applies only while injury mode is active.

- A flagged lift with no injury-era recording gets the carried-forward weight × `firstCut`, rounded down to the lift's increment.
- A flagged lift with injury-era recordings starts from its last injury-era weight, adjusted:
  - If the last session's next-day check said "worse", or any of its sets went over `painLimit`, drop one step.
  - If the last two sessions both passed, add one step.
  - Otherwise keep the weight.
- A step is the lift's `progressiveOverload.weightIncrement` (every overload type has one; defaults to 2.5).
- Unflagged lifts behave as they do today.

**Pain tap.** After each completed set of a flagged lift, the workout screen asks for pain from 0 to 10. The answer is stored on `RecordedSet` as an optional `pain`: optional fields on the stored JSON, no migration. A set above `painLimit` ends the lift for that session: its remaining sets are marked stopped, not failed, and `app/src/models/roll-over.ts` must not roll them forward.

**Next-day check.** On the first app open at least 12 hours after a session with flagged lifts, one prompt asks: "Is your shoulder worse than before that session?" The answer is stored in the injury slice, keyed by session id. If the prompt is unanswered, the session counts as passed only for its in-session pain.

### 5. Rehab block

Thirteen exercises are added to the library, each tagged with target structures and a dose. Doses start at the bottom of the source range.

| Exercise | Structures | Start dose | Source |
|---|---|---|---|
| Isometric abduction, wall | supraspinatus | 3×10 holds | Littlewood |
| Abduction 80–120°, dumbbell | supraspinatus, deltoid | 3×10 | Littlewood |
| Eccentric full can | supraspinatus | 3×15 | Holmgren |
| Side-lying external rotation, dumbbell | infraspinatus, teres minor, lower trapezius | 3×15 | Holmgren, Cools |
| Banded eccentric external rotation | infraspinatus, teres minor | 3×15 | Holmgren |
| Low row, isometric | rhomboids, middle and lower trapezius | 3×20 | RoCTEx, Cools |
| Push-up plus, elbows | serratus anterior | 3×20 | RoCTEx, Cools |
| Supine punch | serratus anterior | 3×15 | Cools |
| Wall slide | serratus anterior, lower trapezius | 3×15 | Cools |
| Prone horizontal abduction with external rotation | lower and middle trapezius | 3×15 | Cools |
| Prone extension | lower and middle trapezius | 3×15 | Cools |
| Side-lying forward flexion | lower trapezius | 3×15 | Cools |
| Cross-body posterior shoulder stretch | posterior capsule | 3×30 s | Holmgren |

While injury mode is active, each gym session gets a Rehab block at the end. The block holds the exercises whose structures overlap the injury's `structures`, plus the stretch. If no structures are set, it holds all thirteen. Rehab lifts follow the same pain and progression rule. Their step is 1 for dumbbell lifts; bodyweight and band lifts have no step and are changed by hand. The block's group id is reserved (`injury-mode:rehab`) and shown as "Rehab", so a group the user names "Rehab" is treated like any other group. "Rehab done" is derived: a session with any exercise in the reserved group that has a ticked set. Nothing is stored.

### 6. Bests

`selectAllTimeWeightedExerciseBests` in `app/src/store/stored-sessions/index.ts` takes an optional since-date. While an injury is active, the in-workout best highlighting and the stats page use the since-injury bests. The stats page (`app/src/app/stats/index.tsx`) adds an Archive section listing all-time bests. Marking the injury resolved switches everything back to all-time. Nothing is deleted.

## Edge cases

- Turning injury mode off mid-session has no effect until the next session is generated.
- An injury `onsetDate` in the future is rejected.
- A rehab exercise that already exists in the user's library under the same name is reused, not duplicated.
- A lift renamed after an override loses the override and falls back to the heuristic, because overrides are keyed by name.
- Plaintext export includes the `pain` value when present.

## Testing

Vitest specs sit next to the code; run them with `npm test` in `app/`.

- session-service: first cut on the first injury-era session; drop a step after pain above the limit or a "worse" answer; add a step after two passes; unflagged lifts unchanged.
- roll-over: stopped sets are not rolled forward.
- Flag heuristic: Standing Military Press and Barbell Bench Press are flagged; Barbell Squat and Barbell Curl are not.
- Self-screen routing: every red flag stops the flow; the physio-routing combinations.
- Bests: since-injury versus archive, and the switch back on resolve.
- Storage: an old session without `pain` loads.

Manual check on the Pixel: turn the mode on, run the screen, start a Push session, confirm the press is at 50%, tap pain 6 and see the lift stop, then check the Archive on the stats page.
