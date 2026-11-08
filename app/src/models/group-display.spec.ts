import { describe, expect, it } from 'vitest';
import { groupLabelKey, startsExpanded } from '@/models/group-display';
import { REHAB_GROUP } from '@/models/injury/rehab';
import { SKI_GROUP } from '@/models/ski-prep';

describe('groupLabelKey', () => {
  it('gives the reserved blocks a label instead of their id', () => {
    expect(groupLabelKey(REHAB_GROUP)).toBe('injury.rehab.group');
    expect(groupLabelKey(SKI_GROUP)).toBe('settings.ski_prep.title');
  });

  it('shows a group the user named as typed', () => {
    expect(groupLabelKey('Mobility')).toBeUndefined();
  });
});

describe('startsExpanded', () => {
  it('opens the ski block and keeps other groups collapsed', () => {
    expect(startsExpanded(SKI_GROUP)).toBe(true);
    expect(startsExpanded(REHAB_GROUP)).toBe(false);
    expect(startsExpanded('Mobility')).toBe(false);
  });
});
