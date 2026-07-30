#!/usr/bin/env -S node --experimental-strip-types
/**
 * One-time migration: convert pasted Hevy routine data into a LiftLog-compatible
 * SQLite import file.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-hevy-routine.ts \
 *     [input.json] [output.db]
 *
 * Defaults:
 *   input  → scripts/hevy-routines.json
 *   output → scripts/liftlog-import.db
 *
 * Then import output.db via LiftLog → Settings → Restore/Import.
 * On iOS simulator you can drag the file into the simulator or use the
 * Files app; on a real device use AirDrop or the Files app.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------
interface CardioExercise {
  type: 'cardio';
  name: string;
  sets: number;
  durationSeconds?: number;
  notes?: string;
  supersetWithNext?: boolean;
}

interface WeightedExercise {
  type: 'weighted';
  name: string;
  sets: number;
  reps: number;
  notes?: string;
  restSeconds?: number;
  supersetWithNext?: boolean;
}

type Exercise = CardioExercise | WeightedExercise;

interface Routine {
  name: string;
  exercises: Exercise[];
}

interface InputData {
  routines: Routine[];
}

// ---------------------------------------------------------------------------
// Payload builders (LiftLog v2 program blueprint format)
// ---------------------------------------------------------------------------
function cardioSets(count: number, durationSeconds: number) {
  return Array.from({ length: count }, () => ({
    target: { type: 'time', value: `PT${durationSeconds}S` },
    trackDuration: true,
    trackDistance: false,
    trackResistance: false,
    trackIncline: false,
    trackWeight: false,
    trackSteps: false,
  }));
}

function restJson(seconds: number) {
  const iso = `PT${seconds}S`;
  const failIso = `PT${seconds * 2}S`;
  return { minRest: iso, maxRest: iso, failureRest: failIso };
}

function exerciseBlueprint(ex: Exercise) {
  if (ex.type === 'cardio') {
    return {
      type: 'CardioExerciseBlueprint',
      name: ex.name,
      sets: cardioSets(ex.sets, ex.durationSeconds ?? 30),
      notes: ex.notes ?? '',
      link: '',
      supersetWithNext: ex.supersetWithNext ?? false,
    };
  }
  return {
    type: 'WeightedExerciseBlueprint',
    name: ex.name,
    sets: ex.sets,
    repsPerSet: ex.reps,
    progressiveOverload: { type: 'NoProgressiveOverload' },
    restBetweenSets: restJson(ex.restSeconds ?? 90),
    supersetWithNext: ex.supersetWithNext ?? false,
    notes: ex.notes ?? '',
    link: '',
  };
}

function programPayload(routine: Routine, today: string) {
  return {
    version: 2,
    name: routine.name,
    lastEdited: today,
    sessions: [
      {
        version: 2,
        name: routine.name,
        notes: '',
        exercises: routine.exercises.map(exerciseBlueprint),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const inputFile = process.argv[2] ?? 'scripts/hevy-routines.json';
const outputFile = process.argv[3] ?? 'scripts/liftlog-import.db';

if (!existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

// Fixed date so the output is deterministic
const today = '2026-06-28';

const input: InputData = JSON.parse(readFileSync(inputFile, 'utf-8'));

if (existsSync(outputFile)) {
  unlinkSync(outputFile);
}

const db = new DatabaseSync(outputFile);

// Full schema — matches LiftLog after all Drizzle migrations have run
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id   INTEGER PRIMARY KEY,
    hash TEXT    NOT NULL,
    created_at NUMERIC
  );

  CREATE TABLE IF NOT EXISTS data_migration (
    id TEXT PRIMARY KEY NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS program (
    id      TEXT    PRIMARY KEY NOT NULL,
    active  INTEGER NOT NULL,
    payload TEXT    NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS single_active_program
    ON program (active)
    WHERE program.active = 1;

  CREATE TABLE IF NOT EXISTS exercise (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_follow_request (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_followed_user (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_follower_user (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_identity (
    id      INTEGER PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    CONSTRAINT single_feed_identity CHECK(id = 0)
  );

  CREATE TABLE IF NOT EXISTS feed_items (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_revoked_follow_secrets (
    secret TEXT PRIMARY KEY NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_unpublished_sessions (
    sessionId TEXT PRIMARY KEY NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feed_pending_user (
    id      TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL
  );
`);

// Mark all Drizzle schema migrations as applied.
// created_at must be >= last migration's 'when' (0005 = 1781512672435).
db.prepare(
  `INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`
).run('', 1781512672435);

// Insert programs
const insert = db.prepare(
  `INSERT OR REPLACE INTO program (id, active, payload) VALUES (?, 0, ?)`
);

for (const routine of input.routines) {
  const id = randomUUID();
  const payload = JSON.stringify(programPayload(routine, today));
  insert.run(id, payload);
  console.log(`✓ ${routine.name}  (${id})`);
}

db.close();
console.log(`\nWrote: ${outputFile}`);
console.log('Import via LiftLog → Settings → Restore/Import.');
