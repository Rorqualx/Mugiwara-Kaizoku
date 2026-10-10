/**
 * Deadline shared between the orchestrator and the Fandom enrichment phase.
 *
 * The orchestrator stops awaiting the phase after a timeout but cannot cancel
 * it. Once expired, the phase must not start any further writes — the
 * orchestrator has moved on to reconcile and prune phases that would race
 * them. An apply already in flight is tracked so the orchestrator can let it
 * finish before those phases run.
 */
export class FandomPhaseDeadline {
  private isExpired = false;
  private inFlight: Promise<void> | null = null;

  get expired(): boolean {
    return this.isExpired;
  }

  expire(): void {
    this.isExpired = true;
  }

  /** Register a write so `settle` can wait for it; returns the same promise. */
  track(write: Promise<void>): Promise<void> {
    this.inFlight = write;
    return write;
  }

  /** Wait for a tracked write to finish. Never rejects — the phase owns its errors. */
  async settle(): Promise<void> {
    if (this.inFlight) await this.inFlight.catch(() => undefined);
  }
}
