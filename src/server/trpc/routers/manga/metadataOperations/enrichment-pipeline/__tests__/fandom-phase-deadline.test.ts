/**
 * @jest-environment node
 *
 * Guards the deadline the orchestrator shares with the Fandom enrichment phase.
 *
 * Regression target: the 90s cap only stopped awaiting the phase. It kept
 * running and wrote chapters/volumes while the reconcile and prune phases ran.
 */
import { FandomPhaseDeadline } from '../fandom-phase-deadline';

describe('FandomPhaseDeadline', () => {
  it('starts unexpired and flips once', () => {
    const deadline = new FandomPhaseDeadline();
    expect(deadline.expired).toBe(false);
    deadline.expire();
    expect(deadline.expired).toBe(true);
  });

  it('settle waits for a tracked write to finish', async () => {
    const deadline = new FandomPhaseDeadline();
    let finished = false;
    const write = new Promise<void>(resolve => { setTimeout(() => { finished = true; resolve(); }, 20); });
    expect(deadline.track(write)).toBe(write);
    await deadline.settle();
    expect(finished).toBe(true);
  });

  it('settle does not throw when the tracked write fails', async () => {
    const deadline = new FandomPhaseDeadline();
    const write = Promise.reject(new Error('db down'));
    const tracked = deadline.track(write);
    await expect(deadline.settle()).resolves.toBeUndefined();
    await expect(tracked).rejects.toThrow('db down');
  });

  it('settle returns immediately when nothing is in flight', async () => {
    await expect(new FandomPhaseDeadline().settle()).resolves.toBeUndefined();
  });
});
