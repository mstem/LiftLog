import { describe, it, expect } from 'vitest';
import { groupSupersets } from '@/components/smart/group-supersets';

function chains(links: boolean[]) {
  return groupSupersets(links).map((p) =>
    p ? `${p.chain}${p.isFirst ? '<' : ''}${p.isLast ? '>' : ''}` : '-',
  );
}

describe('groupSupersets', () => {
  it('marks nothing when no exercise supersets', () => {
    expect(chains([false, false, false])).toEqual(['-', '-', '-']);
  });

  it('pairs an exercise with the one it links to', () => {
    expect(chains([true, false, false])).toEqual(['0<', '0>', '-']);
  });

  it('keeps consecutive links in one chain', () => {
    expect(chains([true, true, false])).toEqual(['0<', '0', '0>']);
  });

  it('numbers separate chains so neighbours differ', () => {
    expect(chains([true, false, true, false])).toEqual([
      '0<',
      '0>',
      '1<',
      '1>',
    ]);
  });

  it('ignores a link on the last exercise, which points at nothing', () => {
    expect(chains([false, false, true])).toEqual(['-', '-', '-']);
  });

  it('handles an empty session', () => {
    expect(groupSupersets([])).toEqual([]);
  });
});
