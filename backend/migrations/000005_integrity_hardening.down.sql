-- Exact inverse of 000005_integrity_hardening.up.sql.

DROP INDEX IF EXISTS shipments_status_idx;
DROP INDEX IF EXISTS payments_status_idx;
DROP INDEX IF EXISTS orders_coupon_id_idx;
DROP INDEX IF EXISTS orders_address_id_idx;
DROP INDEX IF EXISTS reviews_user_id_idx;
DROP INDEX IF EXISTS wishlists_product_id_idx;
DROP INDEX IF EXISTS cart_items_variant_id_idx;
DROP INDEX IF EXISTS order_items_product_id_idx;

DROP INDEX IF EXISTS users_phone_key;
DROP INDEX IF EXISTS product_images_one_primary_idx;
DROP INDEX IF EXISTS coupons_code_upper_uniq;
DROP INDEX IF EXISTS users_email_lower_uniq;

ALTER TABLE users DROP COLUMN IF EXISTS token_version;

ALTER TABLE orders DROP COLUMN IF EXISTS coupon_code;
