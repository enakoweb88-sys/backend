ALTER TABLE "leave_requests"
  ADD COLUMN "employeeId" TEXT,
  ADD COLUMN "startDate" DATE,
  ADD COLUMN "endDate" DATE,
  ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_dates_valid"
  CHECK (("startDate" IS NULL AND "endDate" IS NULL) OR
    ("startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "endDate" >= "startDate"));
CREATE INDEX "leave_requests_status_endDate_idx" ON "leave_requests"("status", "endDate");
