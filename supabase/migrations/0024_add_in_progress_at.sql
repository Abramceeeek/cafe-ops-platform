ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "in_progress_at" timestamp with time zone;
