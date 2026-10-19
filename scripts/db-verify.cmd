@echo off
REM Checks the invariants the 000005_integrity_hardening migration enforces:
REM that no row in the live database would violate any of the new unique
REM indexes. A non-zero count means the index could not have been created (or
REM that something bypassed it).
REM
REM Override the connection with PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
setlocal
call "%~dp0_pg-env.cmd" || exit /b 1
set "OUT=%TEMP%\dbcheck.txt"

echo === applied migrations === > "%OUT%"
"%PSQL%" -At -c "SELECT version FROM schema_migrations ORDER BY version;" >> "%OUT%" 2>&1

echo === duplicate checks (every count must be 0) === >> "%OUT%"
"%PSQL%" -At -c "SELECT 'dup_primary_images=' || count(*) FROM (SELECT product_id FROM product_images WHERE is_primary GROUP BY product_id HAVING count(*) > 1) t;" >> "%OUT%" 2>&1
"%PSQL%" -At -c "SELECT 'dup_phones=' || count(*) FROM (SELECT phone FROM users WHERE phone <> '' GROUP BY phone HAVING count(*) > 1) t;" >> "%OUT%" 2>&1
"%PSQL%" -At -c "SELECT 'dup_email_lower=' || count(*) FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1) t;" >> "%OUT%" 2>&1
"%PSQL%" -At -c "SELECT 'dup_coupon_upper=' || count(*) FROM (SELECT upper(code) FROM coupons GROUP BY upper(code) HAVING count(*) > 1) t;" >> "%OUT%" 2>&1

echo === new columns === >> "%OUT%"
"%PSQL%" -At -c "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE (table_name='orders' AND column_name='coupon_code') OR (table_name='users' AND column_name='token_version') ORDER BY 1;" >> "%OUT%" 2>&1

echo === new indexes (want 12) === >> "%OUT%"
"%PSQL%" -At -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('users_email_lower_uniq','coupons_code_upper_uniq','product_images_one_primary_idx','users_phone_key','order_items_product_id_idx','cart_items_variant_id_idx','wishlists_product_id_idx','reviews_user_id_idx','orders_address_id_idx','orders_coupon_id_idx','payments_status_idx','shipments_status_idx');" >> "%OUT%"

echo === coupon_code backfill (with_code | missing) === >> "%OUT%"
"%PSQL%" -At -c "SELECT count(*) FILTER (WHERE coupon_code <> '') || '|' || count(*) FILTER (WHERE coupon_id IS NOT NULL AND coupon_code = '') FROM orders;" >> "%OUT%" 2>&1

echo === product stock in step with variants (want 0 mismatches) === >> "%OUT%"
"%PSQL%" -At -c "SELECT count(*) FROM products p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AND p.stock <> (SELECT COALESCE(SUM(v.stock),0) FROM product_variants v WHERE v.product_id = p.id);" >> "%OUT%" 2>&1

echo DONE >> "%OUT%"
type "%OUT%"
