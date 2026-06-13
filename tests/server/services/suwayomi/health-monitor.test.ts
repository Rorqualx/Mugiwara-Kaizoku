/**
 * @jest-environment node
 *
 * SuwayomiHealthMonitor — wedge detection + self-heal trigger
 *
 * Drives runCheckOnce() directly (no fake timers) to verify the consecutive-
 * failure threshold, eligibility gating, and streak-reset semantics that decide
 * when a wedged-but-alive Suwayomi server gets killed for the supervisor to
 * restart.
 */

import {
  SuwayomiHealthMonitor,
  type Eligibility,
  type HealthMonitorDeps,
} from '@/server/services/suwayomi/health-monitor';

const ELIGIBLE: Eligibility = { run: true };

function makeDeps(over: Partial<HealthMonitorDeps> = {}): {
  deps: HealthMonitorDeps;
  probe: jest.Mock<Promise<boolean>, []>;
  isEligible: jest.Mock<Promise<Eligibility>, []>;
  recover: jest.Mock<Promise<void>, [string]>;
} {
  const probe = jest.fn<Promise<boolean>, []>().mockResolvedValue(true);
  const isEligible = jest.fn<Promise<Eligibility>, []>().mockResolvedValue(ELIGIBLE);
  const recover = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  const deps: HealthMonitorDeps = { probe, isEligible, recover, ...over };
  return { deps, probe, isEligible, recover };
}

describe('SuwayomiHealthMonitor', () => {
  it('does not recover while the server answers probes', async () => {
    const { deps, recover } = makeDeps({ probe: jest.fn().mockResolvedValue(true) });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 3 });

    await mon.runCheckOnce();
    await mon.runCheckOnce();

    expect(recover).not.toHaveBeenCalled();
    expect(mon.getMetrics().lastHealthyAt).not.toBeNull();
    expect(mon.getMetrics().consecutiveFailures).toBe(0);
  });

  it('recovers exactly once when failures reach the threshold', async () => {
    const { deps, recover } = makeDeps({ probe: jest.fn().mockResolvedValue(false) });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 3 });

    await mon.runCheckOnce(); // fail 1
    await mon.runCheckOnce(); // fail 2
    expect(recover).not.toHaveBeenCalled();

    await mon.runCheckOnce(); // fail 3 -> recover
    expect(recover).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledWith(expect.stringContaining('3 consecutive'));
    // Counter resets after triggering so it doesn't double-fire next tick.
    expect(mon.getMetrics().consecutiveFailures).toBe(0);
    expect(mon.getMetrics().recoveriesTriggered).toBe(1);
  });

  it('skips the probe entirely when ineligible and never accrues failures', async () => {
    const ineligible: Eligibility = { run: false, reason: 'warmup-grace' };
    const { deps, probe, recover } = makeDeps({
      isEligible: jest.fn<Promise<Eligibility>, []>().mockResolvedValue(ineligible),
    });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 2 });

    await mon.runCheckOnce();
    await mon.runCheckOnce();
    await mon.runCheckOnce();

    expect(probe).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
    expect(mon.getMetrics().consecutiveFailures).toBe(0);
  });

  it('clears the failure streak after a single healthy probe', async () => {
    const probe = jest
      .fn<Promise<boolean>, []>()
      .mockResolvedValueOnce(false) // 1
      .mockResolvedValueOnce(false) // 2
      .mockResolvedValueOnce(true) // healthy — resets streak
      .mockResolvedValue(false); // subsequent fails start from zero
    const { deps, recover } = makeDeps({ probe });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 3 });

    await mon.runCheckOnce(); // fail 1
    await mon.runCheckOnce(); // fail 2
    await mon.runCheckOnce(); // healthy -> reset
    expect(mon.getMetrics().consecutiveFailures).toBe(0);

    await mon.runCheckOnce(); // fail 1 (post-reset)
    await mon.runCheckOnce(); // fail 2
    expect(recover).not.toHaveBeenCalled(); // would have fired at 3 without the reset
  });

  it('an ineligible tick mid-streak resets accumulated failures', async () => {
    let eligible = true;
    const isEligible = jest.fn<Promise<Eligibility>, []>(async () =>
      eligible ? { run: true } : { run: false, reason: 'restart-scheduled' },
    );
    const { deps, recover } = makeDeps({
      probe: jest.fn().mockResolvedValue(false),
      isEligible,
    });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 3 });

    await mon.runCheckOnce(); // fail 1
    await mon.runCheckOnce(); // fail 2
    eligible = false;
    await mon.runCheckOnce(); // ineligible -> reset
    eligible = true;
    await mon.runCheckOnce(); // fail 1 again

    expect(recover).not.toHaveBeenCalled();
    expect(mon.getMetrics().consecutiveFailures).toBe(1);
  });

  it('swallows probe errors without throwing or recovering', async () => {
    const { deps, recover } = makeDeps({
      probe: jest.fn<Promise<boolean>, []>().mockRejectedValue(new Error('boom')),
    });
    const mon = new SuwayomiHealthMonitor(deps, { unhealthyThreshold: 1 });

    await expect(mon.runCheckOnce()).resolves.toBeUndefined();
    expect(recover).not.toHaveBeenCalled();
  });

  it('start()/stop() toggle running state idempotently', () => {
    const { deps } = makeDeps();
    const mon = new SuwayomiHealthMonitor(deps, { intervalMs: 60_000 });

    expect(mon.isRunning()).toBe(false);
    mon.start();
    mon.start(); // idempotent
    expect(mon.isRunning()).toBe(true);
    mon.stop();
    mon.stop(); // idempotent
    expect(mon.isRunning()).toBe(false);
  });
});
