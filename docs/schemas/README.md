# JSON schemas

## `workout-worker/`

The wire contract for the JS ↔ native workout worker. **These files are hand-maintained and are the
source of truth.** Both sides conform to them; neither side generates them.

Two consumers, which is why the files must not be moved or bulk-rewritten:

| Consumer | How |
| --- | --- |
| TypeScript | `app/src/models/workout-worker-messages.spec.ts` validates real payloads against these files with ajv |
| Kotlin | `app/modules/workout-worker/android/src/main/resources/schema` is a **symlink** to this directory; `jsonSchemaCodegen` generates the `com.limajuice.liftlog` data classes from it |

### Changing a message shape

Edit the schema by hand, alongside the TypeScript. Conventions to match:

- Optional fields go in `properties` but **not** in `required` (see `bodyweight` in `Session.json`).
- `Session.json` and `SessionBlueprint.json` pin `version` as a `const`. Bump it in lockstep with
  the `toJSON()` writers, or every `WorkoutUpdatedEvent` test fails.
- Cross-file references use `"$ref": "./Foo.json"`.

You are not relying on discipline alone: `workout-worker-messages.spec.ts` builds payloads from the
real models and validates them here, so TS drift fails the test suite. Kotlin drift shows up as a
codegen/compile error.

### Why these aren't generated

There used to be an `npm run json-schema` script (`ts-json-schema-generator`). It was removed in
2026-07 because it could no longer reproduce these files, and running it **deleted 22 of them** —
including definitions the hand-written Kotlin depends on (`WeightedExerciseBlueprint`,
`CardioExerciseBlueprint`, `ProgressiveOverload`, `RecordedExercise`), which would have broken the
Android build.

The cause is structural, not a config slip. The storage JSON types are now derived from the
migration chain — `typeof sessionMigrations.$finalType`, plus indexed access such as
`SessionJSON['recordedExercises'][number]`. Those inferred shapes contain no named type aliases, so
the generator has nothing to name and inlines them: 40 definitions collapsed to 18 (21 with
`expose: 'all'`). No generator setting recovers the names — they'd have to be re-declared as
explicit interfaces.

Generating the contract from one side was the mistake. The schema *is* the interop boundary, so it
lives here as its own artefact. If you ever want generation back, it means declaring explicit named
wire interfaces and asserting they match the storage types.
