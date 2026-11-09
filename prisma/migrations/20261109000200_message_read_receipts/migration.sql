CREATE TABLE "message_read_receipts" (
  "userId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_read_receipts_pkey" PRIMARY KEY ("userId", "messageId"),
  CONSTRAINT "message_read_receipts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "message_read_receipts_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "message_read_receipts_messageId_idx" ON "message_read_receipts"("messageId");
ALTER TABLE "message_read_receipts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "message_read_receipts" FROM PUBLIC;
DO $$ DECLARE browser_role text; BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.message_read_receipts FROM %I', browser_role);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'enako_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "message_read_receipts" TO enako_runtime;
    CREATE POLICY enako_backend_access ON "message_read_receipts" FOR ALL TO enako_runtime USING (true) WITH CHECK (true);
  END IF;
END $$;
