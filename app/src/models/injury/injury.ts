import { LocalDate, OffsetDateTime, ZoneId } from '@js-joda/core';
import type { ArcPain } from '@/models/injury/screen';

export type InjurySide = 'left' | 'right';
export type InjuryStatus = 'active' | 'resolved';
export type NextDayAnswer = 'worse' | 'notWorse';

export interface ScreenFindings {
  redFlags: boolean;
  /** True for pain in the middle of the raise only; kept for older screens. */
  painfulArc: boolean | undefined;
  /** Where raising the arm hurts. Absent on screens taken before it was asked. */
  arcPain?: ArcPain;
  dropArm: boolean | undefined;
  passiveAsLimitedAsActive: boolean | undefined;
  neckSymptoms: boolean | undefined;
  scapularSymptoms: boolean | undefined;
  /** ISO date the screen was taken */
  takenOn: string;
}

export interface Injury {
  slug: string;
  name: string;
  side: InjurySide;
  structures: string[];
  /** ISO local date, e.g. 2026-04-25 */
  onsetDate: string;
  painLimit: number;
  firstCut: number;
  status: InjuryStatus;
  screenFindings: ScreenFindings | undefined;
  /**
   * ISO offset date-time when injury mode was turned on for this injury.
   * Workouts logged before it are not injury-era history, even when they fall
   * on or after the onset date. Injuries stored before this field existed get
   * the start of the onset day, so their history keeps counting as before.
   */
  trackedFrom: string;
}

export interface InjuryState {
  isHydrated: boolean;
  injury: Injury | undefined;
  /** normalized exercise name -> forced flag; absent means use the heuristic */
  flagOverrides: Record<string, boolean>;
  /** session id -> answer to "worse than before that session?" */
  nextDayAnswers: Record<string, NextDayAnswer>;
  /**
   * Set when stored settings could not be read at startup. Saving is held
   * back until the next start so the unread settings are not overwritten.
   */
  saveBlocked?: boolean;
}

export const emptyInjuryState: InjuryState = {
  isHydrated: false,
  injury: undefined,
  flagOverrides: {},
  nextDayAnswers: {},
};

/**
 * Body region of an injury started in LiftLog. The user's own condition
 * (name, side, structures) is entered on the device, never shipped in the app.
 */
export const shoulderInjurySlug = 'shoulder';

export const defaultPainLimit = 5;
export const defaultFirstCut = 0.5;

export function parseInjuryState(json: string | undefined): InjuryState {
  if (!json) {
    return { ...emptyInjuryState, isHydrated: true };
  }
  try {
    const raw = JSON.parse(json) as Partial<InjuryState>;
    const injury: Injury | undefined = raw.injury
      ? ({
          trackedFrom: raw.injury.onsetDate
            ? startOfDay(raw.injury.onsetDate).toString()
            : undefined,
          painLimit: defaultPainLimit,
          firstCut: defaultFirstCut,
          structures: [],
          status: 'active' as const,
          screenFindings: undefined,
          ...(raw.injury as Partial<Injury>),
        } as Injury)
      : undefined;
    return {
      isHydrated: true,
      injury,
      flagOverrides: raw.flagOverrides ?? {},
      nextDayAnswers: raw.nextDayAnswers ?? {},
    };
  } catch {
    return { ...emptyInjuryState, isHydrated: true };
  }
}

function startOfDay(isoDate: string): OffsetDateTime {
  return LocalDate.parse(isoDate)
    .atStartOfDay(ZoneId.systemDefault())
    .toOffsetDateTime();
}

/**
 * Start of injury-era history: the later of the onset day's start and the
 * moment the mode was turned on. Only work done from here on counts.
 */
export function injuryEraStart(
  injury: Pick<Injury, 'onsetDate' | 'trackedFrom'>,
): OffsetDateTime {
  const onset = startOfDay(injury.onsetDate);
  const tracked = OffsetDateTime.parse(injury.trackedFrom);
  return tracked.isAfter(onset) ? tracked : onset;
}

export function serializeInjuryState(state: InjuryState): string {
  const { isHydrated: _, saveBlocked: __, ...rest } = state;
  return JSON.stringify(rest);
}
