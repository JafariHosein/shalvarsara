-- ============================================================================
--  000002_order_code — human-friendly order numbers + payment bookkeeping
--
--  Orders get a public code like "SS-1405-001001": the Jalali year plus a
--  monotonic sequence value. A sequence is used instead of the primary key so
--  the number stays readable even after the table grows into the millions.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS order_code_seq START 1001;

-- Set when the payment for the order is verified, so the account page can show
-- "paid on ..." without guessing from updated_at.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- A canceled or failed order can be retried; keeping a unique authority per
-- payment is what makes verification idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS payments_authority_unique_idx
    ON payments (authority) WHERE authority IS NOT NULL;
