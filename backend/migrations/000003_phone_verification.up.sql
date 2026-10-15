-- ============================================================================
--  000003_phone_verification — one-time SMS codes for phone-verified sign-up
--
--  Sign-up asks for a code sent to the customer's mobile. The codes live in
--  their own table so retries, expiry and attempt counting are all auditable,
--  and so a real SMS panel can be wired in later without touching users.
--
--  Until a panel is connected the API runs with SMS_TEST_MODE=true and hands
--  the code back in the response; the flag is what flips that off.
-- ============================================================================

CREATE TABLE IF NOT EXISTS phone_verifications (
    id          BIGSERIAL   PRIMARY KEY,
    phone       TEXT        NOT NULL,
    code        TEXT        NOT NULL,
    purpose     TEXT        NOT NULL DEFAULT 'register',
    attempts    INTEGER     NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification reads the newest open code for one phone and purpose.
CREATE INDEX IF NOT EXISTS phone_verifications_lookup_idx
    ON phone_verifications (phone, purpose, created_at DESC);

-- Set when an account proved ownership of its number at sign-up. Kept separate
-- from phone so a later profile edit cannot silently claim a verified number.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
