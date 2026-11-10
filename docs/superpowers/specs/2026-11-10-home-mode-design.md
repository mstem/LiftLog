# Home mode

Status: approved by Matt, 2026-11-10. Todoist: https://app.todoist.com/app/task/6hxR4j6JQpvhg475

## What it does

A switch on the workout screen, "At home", turns today's workout into one Matt can do with his home equipment. Each gym lift becomes the closest home lift, at the heaviest home weight that fits, with more reps to make up for the lighter load. The Mobility, Rehab and Ski blocks stay as they are, since they already use bodyweight, bands, dumbbells and the kettlebell. Switching it off before ticking a set puts the gym workout back.

## Home equipment

- Dumbbells: two of 7.5 kg, two of 5 kg
- Kettlebell: 12 kg
- Weight bench
- Ab roller
- Loop bands without handles, no door anchor
- Pilates ring
- Pilates inflatable cushion (balance disc)

The list lives in code for the first version, in `app/src/models/home-mode.ts`, the way the ski block does. A Settings screen to edit it comes later if the equipment changes.

## How each lift changes

A fixed table maps each planned lift, by normalized name, to its home version. A lift with no home version moves into a collapsed "Gym only" block at the end of the workout. It does not roll over to the next workout, because Matt skipped it on purpose.

Weight: the heaviest home load that is not over the gym weight. For a dumbbell in each hand that is the pair together (15 or 10 kg), as Matt logs it.

Reps: planned reps times gym weight over home weight, kept between the planned reps and 20. When the result hits 20, the set note says "Lower over 3 s, stop one or two reps short of failure", which keeps the effort up when the load cannot go higher. Bodyweight lifts keep their reps.

Progression: home lifts progress by reps, using the existing AdjustByReps overload, and log under their own names. Gym history and the weights the gym lifts carry forward stay untouched.

## The table, from the current program

Push

| Gym lift (last weight) | Home lift | Load | Reps |
|---|---|---|---|
| Incline Bench Press (Barbell), 40 kg, 4x12 | Incline Dumbbell Press on the bench | 15 kg (2x7.5) | 20, slow |
| Decline Bench Press (Barbell), 20 kg, 3x8 | Decline Push Up, feet on the bench | bodyweight | 8 |
| Cable Chest Press, 7.5 kg | Band Chest Press, loop across the back | band | as planned |
| Cable Fly Crossovers, 5 kg, 4x12 | Dumbbell Fly on the bench | 10 kg (2x5) | 12 |
| Single Arm Cable Crossover, 8 kg, 3x12 | Single Arm Band Chest Fly, loop across the back | band | 12 |
| Triceps Pushdown (Rope), 15 kg, 4x12 | Band Overhead Triceps Extension, loop under the back foot | band | 12 |
| Triceps Kickback (Cable), 5 kg, 3x12 | Dumbbell Triceps Kickback | 5 kg | 12 |
| Seated Triceps Press, 22.5 kg, 3x10 | Seated Dumbbell Triceps Press, one dumbbell in both hands | 7.5 kg | 20, slow |
| Push Up | unchanged | | |

Pull

| Gym lift (last weight) | Home lift | Load | Reps |
|---|---|---|---|
| Cable Rear Delt Fly, 5 kg, 3x15 | Bent-over Dumbbell Rear Delt Fly | 10 kg (2x5) | 15 |
| Bent Over Barbell Row, 55 kg, 6x5 | One-arm Kettlebell Row, hand on the bench | 12 kg | 20, slow |
| Seated Cable Rows, 30 kg, 3x15 | Seated Band Row, band round the feet | band | 15 |
| Wide-Grip Lat Pulldown, 35 kg, 4x15 | Overhead Band Pulldown: loop held overhead, pulled apart down to the chest | band | 15 |
| Pullups, Inverted Row | Gym only: no bar at home | | |
| Band Pull Apart, Standing Biceps Stretch | unchanged | | |

Legs

| Gym lift (last weight) | Home lift | Load | Reps |
|---|---|---|---|
| Hack Squat, 60 kg, 6x8 | Goblet Squat | 12 kg | 20, slow |
| Leg Press, 127 kg, 4x10 | Dumbbell Step-up onto the bench | 15 kg (2x7.5) | 20, slow |
| Hip Thrust (Machine), 60 kg, 4x11 | Single-leg Hip Thrust, shoulders on the bench | 12 kg | 20, slow |
| Lying Leg Curls, 50 kg, 4x12 | Dumbbell Romanian Deadlift | 15 kg (2x7.5) | 20, slow |
| Leg Extensions, 55 kg, 3x12 | Heel-elevated Goblet Squat | 12 kg | 20, slow |
| Standing Calf Raises, 45 kg, 4x12 | Single-leg Calf Raise | 7.5 kg | 20, slow |
| Hanging Leg Raise | Lying Leg Raise on the bench | bodyweight | 12 |
| Front Box Jump | Tuck Jump | bodyweight | 15 |
| TRX Squat, TRX Suspended Lunge, TRX Hamstring Curl, TRX Pistol Squat | Gym only: no TRX at home | | |
| Ab Roller, Bulgarian Split Squat, Dumbbell Lunges, Dumbbell Bicep Curl, Squat Jump | unchanged | | |

The Pilates ring adds one lift to home Legs day, a Pilates Ring Adductor Squeeze (3x15, 3 s hold), in place of the adductor work the leg press gives. The cushion is for the Kettlebell One-Legged Deadlift in the Ski block, as an option in that lift's note.

## Where it plugs in

- `app/src/models/home-mode.ts`: the equipment, the table, and `withHomeEquipment(blueprint)`, which rewrites a day the way `withSkiBlock` and `withRehabBlock` do.
- The workout screen: an "At home" switch, shown until the first set of a planned lift is ticked. It rebuilds the current workout, keeping any sets already logged in the Mobility, Rehab and Ski blocks.
- Finishing the workout: home lifts count as swaps, so the save-to-plan dialog never offers them.
- Library: each new home lift gets muscles, so the body graph counts it.
- Garmin: each new home lift gets a match in liftlog-garmin-sync `mapper.FIXED`, probed on one old activity first, per the standing rule.

## Not in the first version

- Editing the equipment list in Settings.
- Choosing home or gym per lift instead of per workout.
- Home versions of the Workout 4 day. It is paused while Ski prep runs, and it repeats the Pull lifts, so Pull's table covers it.

## Answers from Matt

No pull-up bar, no door anchor, no TRX. The bands are loops without handles, so every band lift loops around the body, the feet or the hands. Band lifts log at 0 kg and progress by reps.
