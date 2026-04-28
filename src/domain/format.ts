export function formatMetric(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatOptionalMetric(value: number | null): string {
  return value === null ? "-" : formatMetric(value);
}

export function formatCount(value: number | null | undefined): string {
  return value === null || value === undefined ? "-" : value.toLocaleString("en-US");
}
