/** Current time as Unix epoch milliseconds (Number, safe well past year ~2255). */
export function nowMs(): number {
  return Date.now();
}

/** BigInt form for storage/comparison against Prisma BigInt columns. */
export function nowMsBigInt(): bigint {
  return BigInt(Date.now());
}

/** Format epoch-ms as an ISO 8601 UTC string (§3.7 ALREADY_CLAIMED message). */
export function isoFormat(epochMs: number | bigint): string {
  return new Date(Number(epochMs)).toISOString();
}
