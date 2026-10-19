-- ============================================================================
--  000005_integrity_hardening — invariants the application relied on but the
--  schema did not enforce, plus the indexes the real query patterns need.
--
--  Every statement is IF NOT EXISTS / guarded so the migration is safe to run
--  against a database that already has some of these objects.
-- ============================================================================

-- ---------- orders: snapshot the coupon code --------------------------------
--
-- The code was recovered by joining `coupons`, so editing a coupon rewrote the
-- code shown on every past invoice and deleting it erased the code entirely.
-- Prices and titles are already snapshotted for exactly this reason.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT NOT NULL DEFAULT '';

-- Backfill from the live coupon row; orders whose coupon was deleted keep ''.
UPDATE orders o
SET coupon_code = c.code
FROM coupons c
WHERE c.id = o.coupon_id
  AND o.coupon_code = '';

-- ---------- users: session invalidation -------------------------------------
--
-- Stateless JWTs could not be revoked: a refresh token stayed valid for its
-- full 30-day TTL after logout, and changing a password did not evict an
-- attacker. Tokens now carry this counter and are rejected once it moves.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

-- ---------- case-insensitivity belongs to the schema ------------------------
--
-- Both columns are compared against a normalized value (`lower(email)`,
-- `upper(code)`) but only had a byte-wise UNIQUE, so a row inserted by an
-- import or a future write path that forgot to normalize could never be found
-- by its own lookup while a second, differently-cased duplicate coexisted.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_uniq ON coupons (upper(code));

-- ---------- product_images: one primary per product -------------------------
--
-- Only application code enforced this, and not atomically: two concurrent
-- requests could interleave into two primaries (the gallery then shows an
-- arbitrary image) or zero.
CREATE UNIQUE INDEX IF NOT EXISTS product_images_one_primary_idx
    ON product_images (product_id) WHERE is_primary;

-- ---------- one account per mobile number -----------------------------------
--
-- The sign-up flow already refuses a number that is in use, but nothing in the
-- database did, so the 60-second cooldown was the only limit on minting
-- unlimited accounts from one SIM. Partial index so the '' default and any
-- legacy blank rows stay allowed.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key
    ON users (phone) WHERE phone <> '';

-- ---------- indexes for the hot foreign-key paths ---------------------------
--
-- Each of these is a sequential scan today: the best-seller aggregate and the
-- "did this customer buy it" review check filter order_items by product, and
-- every cascade (variant/product/user/address/coupon delete) probes a child
-- column that has no index.
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items (product_id);
CREATE INDEX IF NOT EXISTS cart_items_variant_id_idx  ON cart_items (variant_id);
CREATE INDEX IF NOT EXISTS wishlists_product_id_idx   ON wishlists (product_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx        ON reviews (user_id);
CREATE INDEX IF NOT EXISTS orders_address_id_idx      ON orders (address_id);
CREATE INDEX IF NOT EXISTS orders_coupon_id_idx       ON orders (coupon_id);
CREATE INDEX IF NOT EXISTS payments_status_idx        ON payments (status);
CREATE INDEX IF NOT EXISTS shipments_status_idx       ON shipments (status);
