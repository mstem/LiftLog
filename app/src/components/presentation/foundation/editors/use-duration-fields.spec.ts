import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Duration } from '@js-joda/core';
import { useDurationFields } from './use-duration-fields';

// Mirrors how the rest editor uses the fields: every update is stored by the
// parent and handed straight back in as the new duration.
function renderWithParent(initial: Duration) {
  let duration = initial;
  const hook = renderHook(
    ({ value }: { value: Duration }) =>
      useDurationFields(value, (d) => {
        duration = d;
        hook.rerender({ value: d });
      }),
    { initialProps: { value: initial } },
  );
  return { hook, current: () => duration };
}

describe('useDurationFields', () => {
  it('keeps what is being typed while the parent echoes each update back', () => {
    const { hook, current } = renderWithParent(Duration.ofSeconds(40));

    act(() => hook.result.current.updateSeconds('9'));
    act(() => hook.result.current.updateSeconds('90'));

    expect(hook.result.current.minutes).toBe('0');
    expect(hook.result.current.seconds).toBe('90');
    expect(current()).toEqual(Duration.ofSeconds(90));
  });

  it('tidies an overflowing entry into minutes once editing ends', () => {
    const { hook } = renderWithParent(Duration.ofSeconds(40));

    act(() => hook.result.current.updateSeconds('90'));
    act(() => hook.result.current.resetValues());

    expect(hook.result.current.minutes).toBe('1');
    expect(hook.result.current.seconds).toBe('30');
  });

  it('combines typed minutes with the seconds already there', () => {
    const { hook, current } = renderWithParent(Duration.ofSeconds(40));

    act(() => hook.result.current.updateMinutes('3'));

    expect(hook.result.current.minutes).toBe('3');
    expect(hook.result.current.seconds).toBe('40');
    expect(current()).toEqual(Duration.ofSeconds(220));
  });

  it('adds up what the boxes show when a second box is edited', () => {
    const { hook, current } = renderWithParent(Duration.ofSeconds(40));

    act(() => hook.result.current.updateSeconds('90'));
    act(() => hook.result.current.updateMinutes('2'));

    expect(current()).toEqual(Duration.ofSeconds(210));
  });

  it('still follows a duration changed from outside, such as a preset', () => {
    const { hook } = renderWithParent(Duration.ofSeconds(40));

    act(() => hook.rerender({ value: Duration.ofMinutes(5) }));

    expect(hook.result.current.minutes).toBe('5');
    expect(hook.result.current.seconds).toBe('0');
  });
});
