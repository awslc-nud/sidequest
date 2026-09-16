/**
 * Server-side Upload Admission Queue (§4.2b).
 *
 * A bounded semaphore that sits in front of the expensive part of /api/upload
 * (the disk write + the database write) and caps how many requests, across ALL
 * attendees combined, are doing that work at the same time. Protects a single
 * consumer host from the "50 people photograph the speaker at once" burst.
 */

import { uploadConcurrency, uploadQueueDepth, uploadQueueDisabled } from '../env';

export interface AdmissionStats {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueueDepth: number;
}

export type AdmissionResult =
  | { admitted: true; release: () => void }
  | { admitted: false };

export interface UploadAdmissionQueue {
  /** Attempt to enter the critical section. Never throws. */
  tryEnqueue(): Promise<AdmissionResult>;
  /** Active + queued counters (test hook). */
  stats(): AdmissionStats;
}

export function createUploadAdmissionQueue(options: {
  maxConcurrent?: number;
  maxQueueDepth?: number;
  disabled?: boolean;
}): UploadAdmissionQueue {
  const maxConcurrent = options.maxConcurrent ?? 4;
  const maxQueueDepth = options.maxQueueDepth ?? 40;
  const disabled = options.disabled ?? false;

  let activeCount = 0;
  const waiters: Array<() => void> = [];

  const release = (): void => {
    if (disabled) return;
    activeCount -= 1;
    if (waiters.length > 0) {
      const next = waiters.shift()!;
      activeCount += 1;
      next(); // resolves the waiting request handler, letting it proceed
    }
  };

  return {
    async tryEnqueue(): Promise<AdmissionResult> {
      if (disabled) return { admitted: true, release: () => undefined };
      if (activeCount < maxConcurrent) {
        activeCount += 1;
        return { admitted: true, release };
      }
      if (waiters.length >= maxQueueDepth) {
        return { admitted: false };
      }
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
      return { admitted: true, release };
    },
    stats(): AdmissionStats {
      return { active: activeCount, queued: waiters.length, maxConcurrent, maxQueueDepth };
    },
  };
}

/** Process-wide instance, tuned from env (§4.2b defaults: 4 concurrent / 40 queued). */
export const uploadAdmissionQueue: UploadAdmissionQueue = createUploadAdmissionQueue({
  maxConcurrent: uploadConcurrency(),
  maxQueueDepth: uploadQueueDepth(),
  disabled: uploadQueueDisabled(),
});
