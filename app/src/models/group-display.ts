import { REHAB_GROUP } from '@/models/injury/rehab';
import { SKI_GROUP } from '@/models/ski-prep';
import { HOME_GROUP } from '@/models/home-group';

/**
 * Translation key for a group's title, for the reserved ids the app adds on
 * its own. Undefined for a group the user named, which shows as typed.
 */
export function groupLabelKey(
  group: string,
):
  | 'injury.rehab.group'
  | 'settings.ski_prep.title'
  | 'workout.home_mode.title'
  | undefined {
  if (group === REHAB_GROUP) {
    return 'injury.rehab.group';
  }
  if (group === SKI_GROUP) {
    return 'settings.ski_prep.title';
  }
  if (group === HOME_GROUP) {
    return 'workout.home_mode.title';
  }
  return undefined;
}

/**
 * The ski block is the start of Ski Legs, and the home block is a lift to do,
 * so both open instead of collapsing.
 */
export function startsExpanded(group: string): boolean {
  return group === SKI_GROUP || group === HOME_GROUP;
}
