-- 0033_rejection_reason.sql
-- Capture why a request was declined. Today the Inbox "Reject" sets status =
-- 'rejected' but stores no reason, so the shop is left guessing. The specialist
-- now provides a reason; the shop sees "Declined — <reason>".
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
