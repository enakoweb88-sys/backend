CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cost" DECIMAL(14,2) NOT NULL,
  "cycle" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "nextBilling" TIMESTAMP(3) NOT NULL,
  "receiptUrl" TEXT,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscriptions_addedById_idx" ON "subscriptions"("addedById");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "report_files" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" TEXT NOT NULL,
  "data" TEXT,
  "generatedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "report_files_generatedBy_idx" ON "report_files"("generatedBy");
ALTER TABLE "report_files" ADD CONSTRAINT "report_files_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
