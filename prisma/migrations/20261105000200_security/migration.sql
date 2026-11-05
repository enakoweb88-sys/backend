-- DropForeignKey
ALTER TABLE "cash_collections" DROP CONSTRAINT "cash_collections_collectorId_fkey";

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "authSessionId" TEXT,
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "department" TEXT,
ADD COLUMN     "expenseDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "receiptRef" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "ledgerAppliedAt" TIMESTAMP(3),
ADD COLUMN     "requestHash" TEXT;

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "department" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "seats" TEXT;

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "providerCheckedAt" TIMESTAMP(3),
ADD COLUMN     "providerReference" TEXT,
ADD COLUMN     "providerTransactionId" TEXT,
ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "statusLookupHash" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(14,2);

-- AlterTable
ALTER TABLE "cash_collections" ADD COLUMN     "cashUserId" TEXT,
ALTER COLUMN "collectorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT,
    "ipAddress" TEXT,
    "roleAtIssue" "RoleName" NOT NULL,
    "passwordVersion" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "secure_files" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "scope" TEXT NOT NULL,
    "parentId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "secure_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "branch" TEXT NOT NULL DEFAULT '',
    "terminalId" TEXT NOT NULL,
    "jobLabel" TEXT NOT NULL DEFAULT 'Cash Collector',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL,
    "cashUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "amountInXaf" DECIMAL(14,2),
    "exchangeRate" DECIMAL(14,4),
    "type" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "proofUrl" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "channel" TEXT,
    "charges" DECIMAL(14,2) DEFAULT 0,
    "idempotencyKey" TEXT,
    "requestHash" TEXT,
    "ledgerAppliedAt" TIMESTAMP(3),

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_float_accounts" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalIn" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalOut" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_float_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_exchange_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flag" TEXT NOT NULL DEFAULT '',
    "buyingRate" TEXT NOT NULL DEFAULT '',
    "sellingRate" TEXT NOT NULL DEFAULT '',
    "change24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_documents" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "scope" TEXT NOT NULL,
    "parentId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "cash_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_kyc_submissions" (
    "id" TEXT NOT NULL,
    "applicantType" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "payload" JSONB NOT NULL,
    "documents" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_kyc_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_expiresAt_idx" ON "rate_limit_buckets"("expiresAt");

-- CreateIndex
CREATE INDEX "secure_files_ownerId_scope_idx" ON "secure_files"("ownerId", "scope");

-- CreateIndex
CREATE INDEX "secure_files_scope_parentId_idx" ON "secure_files"("scope", "parentId");

-- CreateIndex
CREATE INDEX "secure_files_expiresAt_idx" ON "secure_files"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "cash_users_email_key" ON "cash_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cash_users_terminalId_key" ON "cash_users"("terminalId");

-- CreateIndex
CREATE INDEX "cash_sessions_cashUserId_revokedAt_idx" ON "cash_sessions"("cashUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "cash_audit_logs_actorId_createdAt_idx" ON "cash_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transactions_reference_key" ON "cash_transactions"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "cash_transactions_idempotencyKey_key" ON "cash_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "cash_transactions_status_idx" ON "cash_transactions"("status");

-- CreateIndex
CREATE INDEX "cash_transactions_createdAt_idx" ON "cash_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cash_float_accounts_channel_key" ON "cash_float_accounts"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "cash_exchange_rates_code_key" ON "cash_exchange_rates"("code");

-- CreateIndex
CREATE INDEX "cash_documents_ownerId_scope_idx" ON "cash_documents"("ownerId", "scope");

-- CreateIndex
CREATE INDEX "cash_documents_scope_parentId_idx" ON "cash_documents"("scope", "parentId");

-- CreateIndex
CREATE INDEX "cash_documents_expiresAt_idx" ON "cash_documents"("expiresAt");

-- CreateIndex
CREATE INDEX "cash_kyc_submissions_status_idx" ON "cash_kyc_submissions"("status");

-- CreateIndex
CREATE INDEX "refresh_tokens_authSessionId_idx" ON "refresh_tokens"("authSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotencyKey_key" ON "transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "support_tickets_ownerId_idx" ON "support_tickets"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_idempotencyKey_key" ON "Donation"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_providerReference_key" ON "Donation"("providerReference");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_providerTransactionId_key" ON "Donation"("providerTransactionId");

-- CreateIndex
CREATE INDEX "cash_collections_cashUserId_idx" ON "cash_collections"("cashUserId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_authSessionId_fkey" FOREIGN KEY ("authSessionId") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_collections" ADD CONSTRAINT "cash_collections_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_collections" ADD CONSTRAINT "cash_collections_cashUserId_fkey" FOREIGN KEY ("cashUserId") REFERENCES "cash_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashUserId_fkey" FOREIGN KEY ("cashUserId") REFERENCES "cash_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
