/**
 * Formats a rate such as workouts per week or per month: a whole number when it
 * rounds cleanly, one decimal place otherwise.
 */
export function formatRate(value: number) {
  return Math.abs(value - Math.round(value)) < 0.05
    ? Math.round(value).toString()
    : value.toFixed(1);
}
