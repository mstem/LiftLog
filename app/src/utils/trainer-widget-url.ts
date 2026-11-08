/**
 * Where the trainer widget fetches its file: the remote backup endpoint's
 * origin plus /widget. The receiver that takes the backup serves the widget
 * file under the same key, so the widget needs no setting of its own. Only
 * https, as the backup screen requires: Android blocks plain http and the key
 * would travel in the clear.
 */
export function trainerWidgetUrl(endpoint: string | undefined): string | null {
  const trimmed = endpoint?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') {
      return null;
    }
    return `${url.origin}/widget`;
  } catch {
    return null;
  }
}
