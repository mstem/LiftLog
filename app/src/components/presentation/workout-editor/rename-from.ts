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

/**
 * The name to offer a rename on in the plan editor: only a lift the saved
 * plan already has. Adding a lift puts a placeholder such as 'Exercise 4'
 * into the plan being edited first, and renaming that would rewrite every
 * past lift sharing the placeholder name.
 */
export function savedNameInPlan(
  savedNames: readonly string[],
  name: string | undefined,
): string | undefined {
  return name !== undefined && savedNames.includes(name) ? name : undefined;
}
