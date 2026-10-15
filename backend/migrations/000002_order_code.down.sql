-- Reverts 000002_order_code.
DROP INDEX IF EXISTS payments_authority_unique_idx;
ALTER TABLE orders DROP COLUMN IF EXISTS paid_at;
DROP SEQUENCE IF EXISTS order_code_seq;
