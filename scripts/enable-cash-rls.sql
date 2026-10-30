-- Cash uses the authenticated backend (Prisma), not direct browser table access.
-- No browser policies: deny direct anon/authenticated access by default.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.cash_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
COMMIT;
