CREATE TABLE "user_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "analytics" BOOLEAN NOT NULL DEFAULT true,
  "mfa" BOOLEAN NOT NULL DEFAULT false,
  "aiWorkspace" BOOLEAN NOT NULL DEFAULT false,
  "emailNotif" BOOLEAN NOT NULL DEFAULT true,
  "pushNotif" BOOLEAN NOT NULL DEFAULT true,
  "smsNotif" BOOLEAN NOT NULL DEFAULT false,
  "slackConnected" BOOLEAN NOT NULL DEFAULT false,
  "awsConnected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refresh_tokens" ADD COLUMN "device" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "location" TEXT;
