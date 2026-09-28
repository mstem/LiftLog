import { Duration } from '@js-joda/core';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useDurationFields(
  duration: Duration,
  onDurationUpdated: (duration: Duration) => void,
  readonly?: boolean,
) {
  const [hours, setHours] = useState(duration.toHours().toString());
  const [minutes, setMinutes] = useState(
    (duration.toMinutes() % 60).toString(),
  );
  const [seconds, setSeconds] = useState((duration.seconds() % 60).toString());

  // The duration this editor last reported. When the parent hands that same
  // value straight back, the fields already show what was typed; rewriting them
  // then moves digits between boxes under the cursor (90s becoming 1m 30s
  // mid-entry). Only a duration changed from elsewhere, or leaving the field,
  // tidies the fields.
  const lastEmitted = useRef<Duration | undefined>(undefined);
  const emit = (updated: Duration) => {
    lastEmitted.current = updated;
    onDurationUpdated(updated);
  };

  // Totals come from what the boxes show, not from the stored duration: after
  // typing 90 into seconds the duration is 1m 30s while the boxes read 0 : 90,
  // and editing minutes next has to build on the 90 the user can see.
  const total = (h: string, m: string, sec: string) =>
    Duration.ofSeconds(toNumber(h) * 3600 + toNumber(m) * 60 + toNumber(sec));

  const updateHours = (text: string) => {
    setHours(text);
    if (!isNaN(Number.parseInt(text))) {
      emit(total(text, minutes, seconds));
    }
  };
  const updateMinutes = (text: string) => {
    setMinutes(text);
    if (!isNaN(Number.parseInt(text))) {
      emit(total(hours, text, seconds));
    }
  };
  const updateSeconds = (text: string) => {
    setSeconds(text);
    if (!isNaN(Number.parseInt(text))) {
      emit(total(hours, minutes, text));
    }
  };

  const resetValues = useCallback(() => {
    setHours(duration.toHours().toString());
    setMinutes((duration.toMinutes() % 60).toString());
    setSeconds((duration.seconds() % 60).toString());
  }, [duration]);
  useEffect(() => {
    if (lastEmitted.current?.equals(duration)) {
      return;
    }
    resetValues();
  }, [readonly, resetValues, duration]);

  return {
    hours,
    minutes,
    seconds,
    updateHours,
    updateMinutes,
    updateSeconds,
    resetValues,
  };
}

function toNumber(text: string) {
  const value = Number.parseInt(text);
  return isNaN(value) ? 0 : value;
}
