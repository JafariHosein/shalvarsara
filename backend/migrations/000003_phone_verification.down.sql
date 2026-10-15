DROP TABLE IF EXISTS phone_verifications;

ALTER TABLE users DROP COLUMN IF EXISTS phone_verified_at;
