/**
 * The name a rename rewrites, or undefined when the pencil should not show.
 * Renaming rewrites history, plans and notes, so it is offered only on a lift
 * already saved, and only while the editor still shows that lift; a lift
 * picked from search but not yet saved would rename the wrong history.
 */
export function renameFrom(
  savedName: string | undefined,
  shownName: string,
): string | undefined {
  return savedName !== undefined && savedName === shownName
    ? savedName
    : undefined;
}
