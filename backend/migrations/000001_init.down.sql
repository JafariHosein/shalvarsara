-- ============================================================================
--  000001_init (down) — drop everything created by the initial migration
-- ============================================================================

DROP TABLE IF EXISTS shipments       CASCADE;
DROP TABLE IF EXISTS payments        CASCADE;
DROP TABLE IF EXISTS order_items     CASCADE;
DROP TABLE IF EXISTS orders          CASCADE;
DROP TABLE IF EXISTS coupons         CASCADE;
DROP TABLE IF EXISTS wishlists       CASCADE;
DROP TABLE IF EXISTS cart_items      CASCADE;
DROP TABLE IF EXISTS carts           CASCADE;
DROP TABLE IF EXISTS reviews         CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images  CASCADE;
DROP TABLE IF EXISTS products        CASCADE;
DROP TABLE IF EXISTS categories      CASCADE;
DROP TABLE IF EXISTS addresses       CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

DROP TYPE IF EXISTS coupon_type;
DROP TYPE IF EXISTS review_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS user_role;
