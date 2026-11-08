import { REHAB_GROUP } from '@/models/injury/rehab';
import { SKI_GROUP } from '@/models/ski-prep';

/**
 * Translation key for a group's title, for the reserved ids the app adds on
 * its own. Undefined for a group the user named, which shows as typed.
 */
export function groupLabelKey(
  group: string,
): 'injury.rehab.group' | 'settings.ski_prep.title' | undefined {
  if (group === REHAB_GROUP) {
    return 'injury.rehab.group';
  }
  if (group === SKI_GROUP) {
    return 'settings.ski_prep.title';
  }
  return undefined;
}

/** The ski block is the start of Legs day, so it opens instead of collapsing. */
export function startsExpanded(group: string): boolean {
  return group === SKI_GROUP;
}
