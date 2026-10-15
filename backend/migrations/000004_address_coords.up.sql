-- ---------- map pin on shipping addresses -----------------------------------
--
-- The coordinates are optional: an address is still valid without a pin, but
-- when the customer picks a point on the map the courier gets an exact
-- destination. They always travel as a pair, which the CHECK below enforces,
-- so half a coordinate can never reach the database.

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE addresses
    ADD CONSTRAINT addresses_coords_pair_chk CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    ),
    ADD CONSTRAINT addresses_lat_range_chk CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT addresses_lng_range_chk CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);
