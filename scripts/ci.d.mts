export function r10Problems(
  root: string,
  base: string | undefined,
): { skipped: true } | { ref: string; count: number; problems: string[] }
