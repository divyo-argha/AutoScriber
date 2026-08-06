import { db } from '@/lib/db';
import fs from 'fs';

export const CONTROL_POLL_INTERVAL = 3000;

/** Reads the current controlStatus of a job ('running' when unset/failed to read). */
export async function getJobControlStatus(jobId: string): Promise<string> {
  try {
    const job = await db.transcriptionJob.findUnique({
      where: { id: jobId },
      select: { controlStatus: true },
    });
    return job?.controlStatus || 'running';
  } catch {
    return 'running';
  }
}

export function isCancelRequested(controlStatus: string): boolean {
  return controlStatus === 'cancel_requested' || controlStatus === 'cancelled';
}

/**
 * Blocks while the job is paused. Resolves 'running' once resumed or
 * 'cancelled' if the user cancels while paused.
 */
export async function waitWhilePaused(jobId: string): Promise<'running' | 'cancelled'> {
  for (;;) {
    const control = await getJobControlStatus(jobId);
    if (control === 'running') return 'running';
    if (isCancelRequested(control)) return 'cancelled';
    await new Promise(resolve => setTimeout(resolve, CONTROL_POLL_INTERVAL));
  }
}

/**
 * Sleep that aborts early when the job is paused or cancelled, so the UI
 * controls stay responsive. Returns 'running' if the sleep completed.
 */
export async function sleepWithControl(jobId: string, ms: number): Promise<'running' | 'cancelled'> {
  const step = CONTROL_POLL_INTERVAL;
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    const control = await getJobControlStatus(jobId);
    if (isCancelRequested(control)) return 'cancelled';
    if (control === 'paused') {
      const resumed = await waitWhilePaused(jobId);
      if (resumed === 'cancelled') return 'cancelled';
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(step, ms - elapsed)));
  }
  return 'running';
}

/** Mark the job cancelled and delete its persisted audio file. */
export async function cancelJob(jobId: string, audioPath: string | null): Promise<void> {
  try {
    await db.transcriptionJob.update({
      where: { id: jobId },
      data: { status: 'cancelled', controlStatus: 'cancelled' },
    });
  } catch (err) {
    console.error('[jobs] Failed to mark job cancelled:', err);
  }
  if (audioPath) {
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      console.log(`[jobs] Deleted audio for cancelled job: ${audioPath}`);
    } catch (err) {
      console.error('[jobs] Failed to delete cancelled job audio:', err);
    }
  }
}
