/** Where raising the arm out to the side hurts. */
export type ArcPain = 'none' | 'middle' | 'top' | 'whole';

export interface ScreenAnswers {
  traumaWithWeakness: boolean;
  feverOrHotJoint: boolean;
  arcPain: ArcPain | undefined;
  dropArm: boolean | undefined;
  passiveAsLimitedAsActive: boolean | undefined;
  neckSymptoms: boolean | undefined;
  scapularSymptoms: boolean | undefined;
}

export type ScreenOutcome =
  | { kind: 'clinician' }
  | { kind: 'physio' | 'ok'; suggestedStructures: string[] };

export function screenOutcome(a: ScreenAnswers): ScreenOutcome {
  if (a.traumaWithWeakness || a.feverOrHotJoint) {
    return { kind: 'clinician' };
  }
  const suggestedStructures = [
    // Painful arc, about 60-120 degrees: the cuff tendon pinched under the acromion.
    ...(a.arcPain === 'middle' ? ['supraspinatus'] : []),
    // High arc, near the top: the AC joint, or the shoulder blade not rotating up.
    ...(a.arcPain === 'top'
      ? ['AC joint', 'serratus anterior', 'lower trapezius']
      : []),
    ...(a.scapularSymptoms
      ? [
          'serratus anterior',
          'lower trapezius',
          'middle trapezius',
          'rhomboids',
        ]
      : []),
  ].filter((s, i, all) => all.indexOf(s) === i);
  const physio =
    a.passiveAsLimitedAsActive === true ||
    (a.dropArm === true && a.arcPain === 'middle') ||
    // Pain through the whole raise is too irritable to load without a look.
    a.arcPain === 'whole' ||
    a.neckSymptoms === true;
  return { kind: physio ? 'physio' : 'ok', suggestedStructures };
}
