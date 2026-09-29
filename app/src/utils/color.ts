/**
 * Turns a theme colour into a translucent version of itself, for tinting a
 * background without changing how readable the text on top of it is. Works in
 * either theme, since what shows through is the surface underneath.
 */
export function withOpacity(color: string, opacity: number): string {
  const hex = color.trim().replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length < 6) {
    return color;
  }
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) {
    return color;
  }
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
