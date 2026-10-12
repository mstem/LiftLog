export interface ScreenAnswers {
  traumaWithWeakness: boolean;
  feverOrHotJoint: boolean;
  painfulArc: boolean | undefined;
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
    ...(a.painfulArc ? ['supraspinatus'] : []),
    ...(a.scapularSymptoms
      ? [
          'serratus anterior',
          'lower trapezius',
          'middle trapezius',
          'rhomboids',
        ]
      : []),
  ];
  const physio =
    a.passiveAsLimitedAsActive === true ||
    (a.dropArm === true && a.painfulArc === true) ||
    a.neckSymptoms === true;
  return { kind: physio ? 'physio' : 'ok', suggestedStructures };
}
