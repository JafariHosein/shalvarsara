-- ============================================================================
--  000001_init — core schema for the ShalvarSara storefront
--
--  Money: every amount is an integer number of Toman (never a float).
--  The ZarinPal boundary converts Toman <-> Rial; see internal/service/payment.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fast ILIKE search on product titles

-- ---------- enums -----------------------------------------------------------
CREATE TYPE user_role      AS ENUM ('customer', 'admin');
CREATE TYPE order_status   AS ENUM ('pending', 'paid', 'processing', 'shipped', 'delivered', 'canceled');
CREATE TYPE payment_status AS ENUM ('initiated', 'verified', 'failed');
CREATE TYPE review_status  AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE coupon_type    AS ENUM ('percent', 'fixed');

-- ---------- updated_at helper ----------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- users -----------------------------------------------------------
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    email         TEXT NOT NULL UNIQUE,          -- stored lowercased by the app
    phone         TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'customer',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- addresses -------------------------------------------------------
CREATE TABLE addresses (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_name TEXT NOT NULL,
    phone         TEXT NOT NULL,
    province      TEXT NOT NULL,
    city          TEXT NOT NULL,
    postal_code   TEXT NOT NULL,
    line1         TEXT NOT NULL,
    line2         TEXT NOT NULL DEFAULT '',
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_id_idx ON addresses (user_id);
-- At most one default address per user.
CREATE UNIQUE INDEX addresses_one_default_idx ON addresses (user_id) WHERE is_default;
CREATE TRIGGER addresses_set_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- categories ------------------------------------------------------
CREATE TABLE categories (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    parent_id  BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX categories_parent_id_idx ON categories (parent_id);
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- products --------------------------------------------------------
CREATE TABLE products (
    id             BIGSERIAL PRIMARY KEY,
    title          TEXT NOT NULL,
    slug           TEXT NOT NULL UNIQUE,
    short_desc     TEXT NOT NULL DEFAULT '',
    description    TEXT NOT NULL DEFAULT '',
    category_id    BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    brand          TEXT NOT NULL DEFAULT '',
    gender         TEXT NOT NULL DEFAULT '',   -- مردانه / زنانه / بچگانه
    pant_type      TEXT NOT NULL DEFAULT '',   -- جین / پارچه‌ای / کتان / کارگو / اسلش
    fabric         TEXT NOT NULL DEFAULT '',
    price          BIGINT NOT NULL CHECK (price >= 0),           -- Toman
    discount_price BIGINT CHECK (discount_price >= 0),           -- Toman, NULL = no discount
    stock          INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku            TEXT UNIQUE,
    rating_avg     NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
    rating_count   INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    sold_count     INT NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMPTZ,                                  -- soft delete
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (discount_price IS NULL OR discount_price <= price)
);
CREATE INDEX products_category_id_idx ON products (category_id);
CREATE INDEX products_active_idx      ON products (is_active) WHERE deleted_at IS NULL;
CREATE INDEX products_price_idx       ON products (price);
CREATE INDEX products_created_at_idx  ON products (created_at DESC);
CREATE INDEX products_title_trgm_idx  ON products USING gin (title gin_trgm_ops);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- product images --------------------------------------------------
CREATE TABLE product_images (
    id         BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    alt        TEXT NOT NULL DEFAULT '',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product_id_idx ON product_images (product_id);

-- ---------- product variants ------------------------------------------------
-- A variant is a concrete purchasable combination (size + colour).
CREATE TABLE product_variants (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size        TEXT NOT NULL,                    -- e.g. "32" or "L"
    color       TEXT NOT NULL,                    -- Persian colour name
    color_hex   TEXT NOT NULL DEFAULT '#000000',
    stock       INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku         TEXT UNIQUE,
    extra_price BIGINT NOT NULL DEFAULT 0 CHECK (extra_price >= 0),
    UNIQUE (product_id, size, color)
);
CREATE INDEX product_variants_product_id_idx ON product_variants (product_id);

-- ---------- reviews ---------------------------------------------------------
CREATE TABLE reviews (
    id         BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT NOT NULL DEFAULT '',
    status     review_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id)
);
CREATE INDEX reviews_product_status_idx ON reviews (product_id, status);
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- carts -----------------------------------------------------------
-- One cart per signed-in user; guests get a cart keyed by an opaque session id.
CREATE TABLE carts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE TRIGGER carts_set_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cart_items (
    id         BIGSERIAL PRIMARY KEY,
    cart_id    BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity   INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cart_items_cart_id_idx ON cart_items (cart_id);
-- COALESCE so a NULL variant cannot create duplicate rows for the same product.
CREATE UNIQUE INDEX cart_items_unique_idx
    ON cart_items (cart_id, product_id, COALESCE(variant_id, 0));
CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- wishlists -------------------------------------------------------
CREATE TABLE wishlists (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

-- ---------- coupons ---------------------------------------------------------
CREATE TABLE coupons (
    id         BIGSERIAL PRIMARY KEY,
    code       TEXT NOT NULL UNIQUE,             -- stored uppercase by the app
    type       coupon_type NOT NULL,
    amount     BIGINT NOT NULL CHECK (amount > 0),
    min_order  BIGINT NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    max_uses   INT NOT NULL DEFAULT 0 CHECK (max_uses >= 0),  -- 0 = unlimited
    used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    expires_at TIMESTAMPTZ,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER coupons_set_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- orders ----------------------------------------------------------
-- Shipping details are snapshotted so an order stays readable if the user later
-- edits or deletes the address it was placed with.
CREATE TABLE orders (
    id            BIGSERIAL PRIMARY KEY,
    code          TEXT NOT NULL UNIQUE,          -- public reference, e.g. SS-1403-000123
    user_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    address_id    BIGINT REFERENCES addresses(id) ON DELETE SET NULL,
    status        order_status NOT NULL DEFAULT 'pending',
    subtotal      BIGINT NOT NULL CHECK (subtotal >= 0),
    discount      BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
    shipping_cost BIGINT NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    total         BIGINT NOT NULL CHECK (total >= 0),
    coupon_id     BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
    note          TEXT NOT NULL DEFAULT '',

    ship_receiver_name TEXT NOT NULL DEFAULT '',
    ship_phone         TEXT NOT NULL DEFAULT '',
    ship_province      TEXT NOT NULL DEFAULT '',
    ship_city          TEXT NOT NULL DEFAULT '',
    ship_postal_code   TEXT NOT NULL DEFAULT '',
    ship_line1         TEXT NOT NULL DEFAULT '',

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_id_idx    ON orders (user_id);
CREATE INDEX orders_status_idx     ON orders (status);
CREATE INDEX orders_created_at_idx ON orders (created_at DESC);
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE order_items (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    BIGINT REFERENCES products(id) ON DELETE SET NULL,
    variant_id    BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
    title         TEXT NOT NULL,                 -- snapshot
    variant_label TEXT NOT NULL DEFAULT '',      -- e.g. "۳۲ / سرمه‌ای"
    image_url     TEXT NOT NULL DEFAULT '',
    unit_price    BIGINT NOT NULL CHECK (unit_price >= 0),
    quantity      INT NOT NULL CHECK (quantity > 0)
);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);

-- ---------- payments --------------------------------------------------------
CREATE TABLE payments (
    id         BIGSERIAL PRIMARY KEY,
    order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    gateway    TEXT NOT NULL DEFAULT 'zarinpal',
    authority  TEXT,
    ref_id     TEXT,
    amount     BIGINT NOT NULL CHECK (amount >= 0),   -- Rial, as sent to the gateway
    status     payment_status NOT NULL DEFAULT 'initiated',
    card_pan   TEXT NOT NULL DEFAULT '',
    message    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_id_idx  ON payments (order_id);
CREATE INDEX payments_authority_idx ON payments (authority);
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- shipments -------------------------------------------------------
CREATE TABLE shipments (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    carrier       TEXT NOT NULL DEFAULT '',
    tracking_code TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending',
    shipped_at    TIMESTAMPTZ,
    delivered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER shipments_set_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
