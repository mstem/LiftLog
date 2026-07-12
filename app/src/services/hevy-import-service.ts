import * as FileSystem from 'expo-file-system/legacy';
import { Session } from '@/models/session-models';
import type { SessionJSON } from '@/models/storage/versions/latest';
import { uuid } from '@/utils/uuid';

// ---------------------------------------------------------------------------
// Exercise name mapping: Hevy name → LiftLog catalog name
// Exercises not listed here keep their Hevy name as a custom exercise.
// ---------------------------------------------------------------------------
const EXERCISE_NAME_MAP: Record<string, string> = {
  'Ab Wheel': 'Ab Roller',
  'Band Pullaparts': 'Band Pull Apart',
  'Bench Press (Barbell)': 'Barbell Bench Press - Medium Grip',
  'Bench Press (Dumbbell)': 'Dumbbell Bench Press',
  'Bench Press (Smith Machine)': 'Smith Machine Bench Press',
  'Bent Over Row (Barbell)': 'Bent Over Barbell Row',
  'Bent Over Row (Dumbbell)': 'Bent Over Two-Dumbbell Row',
  'Bicep Curl (Cable)': 'Standing Biceps Cable Curl',
  'Bicep Curl (Dumbbell)': 'Dumbbell Bicep Curl',
  'Cable Fly Crossovers': 'Cable Crossover',
  'Chest Dip': 'Dips - Chest Version',
  'Chest Fly (Dumbbell)': 'Dumbbell Flyes',
  'Deadlift (Barbell)': 'Barbell Deadlift',
  'Decline Bench Press (Barbell)': 'Decline Barbell Bench Press',
  'Decline Push Up': 'Decline Push-Up',
  'EZ Bar Biceps Curl': 'EZ-Bar Curl',
  'Face Pull': 'Face Pull',
  'Floor Press (Dumbbell)': 'Dumbbell Floor Press',
  'Glute Ham Raise': 'Glute Ham Raise',
  'Goblet Squat': 'Goblet Squat',
  'Hack Squat (Machine)': 'Hack Squat',
  'Hanging Leg Raise': 'Hanging Leg Raise',
  'Incline Bench Press (Barbell)': 'Barbell Incline Bench Press - Medium Grip',
  'Incline Bench Press (Dumbbell)': 'Incline Dumbbell Press',
  'Incline Chest Press (Machine)': 'Leverage Incline Chest Press',
  'Inverted Row': 'Inverted Row',
  'Knee Raise Parallel Bars': 'Knee/Hip Raise On Parallel Bars',
  'Lat Pulldown (Cable)': 'Wide-Grip Lat Pulldown',
  'Leg Extension (Machine)': 'Leg Extensions',
  'Leg Press (Machine)': 'Leg Press',
  'Leg Press Horizontal (Machine)': 'Leg Press',
  'Low Cable Fly Crossovers': 'Low Cable Crossover',
  'Lunge (Dumbbell)': 'Dumbbell Lunges',
  'Lying Leg Curl (Machine)': 'Lying Leg Curls',
  'Plank': 'Plank',
  'Preacher Curl (Dumbbell)': 'Preacher Hammer Dumbbell Curl',
  'Pull Up': 'Pullups',
  'Pullover (Dumbbell)': 'Straight-Arm Dumbbell Pullover',
  'Push Up': 'Pushups',
  'Rear Delt Reverse Fly (Cable)': 'Cable Rear Delt Fly',
  'Rear Delt Reverse Fly (Dumbbell)': 'Seated Bent-Over Rear Delt Raise',
  'Renegade Row (Dumbbell)': 'Alternating Renegade Row',
  'Reverse Lunge (Dumbbell)': 'Crossover Reverse Lunge',
  'Romanian Deadlift (Dumbbell)': 'Romanian Deadlift',
  'Seated Cable Row - Bar Grip': 'Seated Cable Rows',
  'Seated Cable Row - Bar Wide Grip': 'Seated Cable Rows',
  'Seated Lateral Raise (Dumbbell)': 'Cable Seated Lateral Raise',
  'Seated Leg Curl (Machine)': 'Seated Leg Curl',
  'Seated Overhead Press (Dumbbell)': 'Seated Dumbbell Press',
  'Seated Palms Up Wrist Curl': 'Seated Dumbbell Palms-Up Wrist Curl',
  'Seated Shoulder Press (Machine)': 'Machine Shoulder (Military) Press',
  'Seated Triceps Press': 'Seated Triceps Press',
  'Shoulder Press (Dumbbell)': 'Dumbbell Shoulder Press',
  'Shrug (Dumbbell)': 'Dumbbell Shrug',
  'Single Arm Cable Crossover': 'Single-Arm Cable Crossover',
  'Single Arm Lat Pulldown': 'One Arm Lat Pulldown',
  'Single Leg Glute Bridge': 'Single Leg Glute Bridge',
  'Skullcrusher (Barbell)': 'EZ-Bar Skullcrusher',
  'Skullcrusher (Dumbbell)': 'Lying Dumbbell Tricep Extension',
  'Split Squat (Dumbbell)': 'Split Squat with Dumbbells',
  'Squat (Barbell)': 'Barbell Squat',
  'Squat (Bodyweight)': 'Bodyweight Squat',
  'Squat (Dumbbell)': 'Dumbbell Squat',
  'Standing Calf Raise (Dumbbell)': 'Standing Dumbbell Calf Raise',
  'Standing Calf Raise (Machine)': 'Standing Calf Raises',
  'Straight Arm Lat Pulldown (Cable)': 'Straight-Arm Pulldown',
  'Triceps Extension (Dumbbell)': 'Lying Dumbbell Tricep Extension',
  'Triceps Kickback (Dumbbell)': 'Tricep Dumbbell Kickback',
  'Triceps Rope Pushdown': 'Triceps Pushdown - Rope Attachment',
  'Walking Lunge (Dumbbell)': 'Dumbbell Walking Lunge',
};

function mapExerciseName(hevyName: string): string {
  return EXERCISE_NAME_MAP[hevyName] ?? hevyName;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------
interface HevyRow {
  title: string;
  start_time: string;
  end_time: string;
  exercise_title: string;
  superset_id: string;
  exercise_notes: string;
  set_index: string;
  weight_kg: string;
  reps: string;
  distance_km: string;
  duration_seconds: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): HevyRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!);
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const values = parseCsvLine(l);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? '';
      });
      return row as unknown as HevyRow;
    });
}

// ---------------------------------------------------------------------------
// Date/time helpers
// ---------------------------------------------------------------------------
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// "27 Jun 2026, 14:58" → Date (treated as UTC)
function parseHevyDateTime(s: string): Date {
  // Split on space and comma
  const parts = s.split(/[\s,]+/).filter(Boolean);
  // parts: ["27", "Jun", "2026", "14:58"]
  const day = parts[0]!.padStart(2, '0');
  const mon = MONTH_MAP[parts[1]!] ?? '01';
  const year = parts[2]!;
  const time = parts[3] ?? '00:00';
  return new Date(`${year}-${mon}-${day}T${time}:00Z`);
}

function toIsoLocalDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toIsoOffsetDateTime(d: Date): string {
  return d.toISOString().replace('Z', '+00:00');
}

// Duration in seconds → ISO 8601 duration string
function secsToIsoDuration(seconds: number): string {
  return `PT${seconds}S`;
}

// ---------------------------------------------------------------------------
// Session builder
// ---------------------------------------------------------------------------
type CardioSetBlueprintJSON = {
  target:
    | { type: 'time'; value: string }
    | { type: 'distance'; value: { value: string; unit: 'kilometre' } };
  trackDuration: boolean;
  trackDistance: boolean;
  trackResistance: boolean;
  trackIncline: boolean;
  trackWeight: boolean;
  trackSteps: boolean;
};

type CardioRecordedSetJSON = {
  blueprint: CardioSetBlueprintJSON;
  completionDateTime: string;
  duration?: string;
  distance?: { value: string; unit: 'kilometre' };
  resistance?: undefined;
  incline?: undefined;
  weight?: undefined;
  steps?: undefined;
};

function buildCardioExercise(
  mappedName: string,
  rows: HevyRow[],
  endTimeStr: string,
  notes: string | undefined,
  supersetWithNext: boolean,
) {
  const setBlueprints: CardioSetBlueprintJSON[] = rows.map((r) => {
    const hasDuration = !!r.duration_seconds;
    const hasDistance = !!r.distance_km;
    return {
      target: hasDuration
        ? { type: 'time' as const, value: secsToIsoDuration(parseInt(r.duration_seconds)) }
        : { type: 'distance' as const, value: { value: r.distance_km, unit: 'kilometre' as const } },
      trackDuration: hasDuration,
      trackDistance: hasDistance,
      trackResistance: false,
      trackIncline: false,
      trackWeight: false,
      trackSteps: false,
    };
  });

  const recordedSets: CardioRecordedSetJSON[] = rows.map((r, i) => {
    const hasDuration = !!r.duration_seconds;
    const hasDistance = !!r.distance_km;
    return {
      blueprint: setBlueprints[i]!,
      completionDateTime: endTimeStr,
      duration: hasDuration ? secsToIsoDuration(parseInt(r.duration_seconds)) : undefined,
      distance: hasDistance ? { value: r.distance_km, unit: 'kilometre' as const } : undefined,
    };
  });

  return {
    type: 'RecordedCardioExercise' as const,
    blueprint: {
      type: 'CardioExerciseBlueprint' as const,
      name: mappedName,
      sets: setBlueprints,
      notes: '',
      link: '',
      supersetWithNext,
    },
    sets: recordedSets,
    notes,
  };
}

function buildWeightedExercise(
  mappedName: string,
  rows: HevyRow[],
  endTimeStr: string,
  notes: string | undefined,
  supersetWithNext: boolean,
) {
  const maxReps = rows.reduce((max, r) => Math.max(max, parseInt(r.reps) || 0), 0);

  const potentialSets = rows.map((r) => ({
    weight: {
      value: String(parseFloat(r.weight_kg) || 0),
      unit: 'kilograms' as const,
    },
    set: {
      repsCompleted: parseInt(r.reps) || 0,
      completionDateTime: endTimeStr,
    },
  }));

  return {
    type: 'RecordedWeightedExercise' as const,
    blueprint: {
      type: 'WeightedExerciseBlueprint' as const,
      name: mappedName,
      sets: rows.length,
      repsPerSet: maxReps,
      progressiveOverload: { type: 'NoProgressiveOverload' as const },
      restBetweenSets: {
        minRest: 'PT1M30S',
        maxRest: 'PT3M',
        failureRest: 'PT5M',
      },
      supersetWithNext,
      notes: '',
      link: '',
    },
    potentialSets,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function parseHevyCsvFile(fileUri: string): Promise<Session[]> {
  const text = await FileSystem.readAsStringAsync(fileUri);
  return parseHevyCsvText(text);
}

export function parseHevyCsvText(text: string): Session[] {
  const rows = parseCsv(text);

  // Group rows by session key (title + start_time), preserving order
  const sessionKeys: string[] = [];
  const sessionMap = new Map<string, HevyRow[]>();
  for (const row of rows) {
    const key = `${row.title}||${row.start_time}`;
    if (!sessionMap.has(key)) {
      sessionKeys.push(key);
      sessionMap.set(key, []);
    }
    sessionMap.get(key)!.push(row);
  }

  const sessions: Session[] = [];

  for (const key of sessionKeys) {
    const sessionRows = sessionMap.get(key)!;
    const firstRow = sessionRows[0]!;

    const startDate = parseHevyDateTime(firstRow.start_time);
    const endDate = parseHevyDateTime(firstRow.end_time);
    const dateStr = toIsoLocalDate(startDate);
    const endTimeStr = toIsoOffsetDateTime(endDate);

    // Collect exercises in order of first appearance
    const exerciseKeys: string[] = [];
    const exerciseRowMap = new Map<string, HevyRow[]>();
    const exerciseSupersetId = new Map<string, string | null>();

    for (const row of sessionRows) {
      const exKey = row.exercise_title;
      if (!exerciseRowMap.has(exKey)) {
        exerciseKeys.push(exKey);
        exerciseRowMap.set(exKey, []);
        exerciseSupersetId.set(exKey, row.superset_id.trim() || null);
      }
      exerciseRowMap.get(exKey)!.push(row);
    }

    // Determine supersetWithNext for each exercise position
    const supersetFlags = exerciseKeys.map((exKey, i) => {
      const thisId = exerciseSupersetId.get(exKey);
      if (thisId === null) return false;
      const nextKey = exerciseKeys[i + 1];
      if (!nextKey) return false;
      return exerciseSupersetId.get(nextKey) === thisId;
    });

    // Build recorded exercises
    const recordedExercises = exerciseKeys.map((exKey, i) => {
      const exRows = exerciseRowMap.get(exKey)!;
      const mappedName = mapExerciseName(exKey);
      const notes = exRows[0]!.exercise_notes.trim() || undefined;
      const isSuperset = supersetFlags[i]!;

      // Exercise is cardio if no row has weight_kg or reps
      const isCardio = exRows.every((r) => !r.weight_kg && !r.reps);

      if (isCardio) {
        return buildCardioExercise(mappedName, exRows, endTimeStr, notes, isSuperset);
      } else {
        return buildWeightedExercise(mappedName, exRows, endTimeStr, notes, isSuperset);
      }
    });

    const sessionJson = {
      version: 2,
      id: uuid(),
      date: dateStr,
      bodyweight: undefined,
      blueprint: {
        version: 2,
        name: firstRow.title,
        exercises: recordedExercises.map((e) => e.blueprint),
        notes: '',
      },
      recordedExercises,
    } as unknown as SessionJSON;

    sessions.push(Session.fromJSON(sessionJson));
  }

  return sessions;
}
