-- Per-user system events: stamp the triggering user so the event log can be
-- owner-scoped (admins see all; users see their own; NULL = system, admin-only).
-- Additive — nullable column, no backfill (existing events stay system-owned).

ALTER TABLE "SystemEvent" ADD COLUMN "userId" TEXT;

CREATE INDEX "SystemEvent_userId_idx" ON "SystemEvent"("userId");

ALTER TABLE "SystemEvent"
  ADD CONSTRAINT "SystemEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
