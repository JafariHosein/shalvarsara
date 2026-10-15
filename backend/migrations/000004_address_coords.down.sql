ALTER TABLE addresses
    DROP CONSTRAINT IF EXISTS addresses_lng_range_chk,
    DROP CONSTRAINT IF EXISTS addresses_lat_range_chk,
    DROP CONSTRAINT IF EXISTS addresses_coords_pair_chk;

ALTER TABLE addresses DROP COLUMN IF EXISTS longitude;
ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;
