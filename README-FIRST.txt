================================================================================
 SHALVARSARA (شلوارسرا) — START HERE
 A Persian RTL e-commerce store. Backend in Go, storefront in React.
================================================================================

Thanks for testing this. Everything below is already written; you do not need
to know the codebase to get it running. Allow about 15 minutes the first time.


--------------------------------------------------------------------------------
 WHAT YOU NEED INSTALLED
--------------------------------------------------------------------------------

   Go 1.23+          https://go.dev/dl/
   Node.js 20+       https://nodejs.org/
   PostgreSQL 16     https://www.postgresql.org/download/
   Git (optional)

Two Windows quirks that catch almost everyone:

  * `go version` may fail even though Go is installed — it is not on PATH.
    Open a NEW terminal after installing, or run:
        set "PATH=C:\Program Files\Go\bin;%PATH%"

  * PowerShell refuses to run `npm`. Always go through cmd:
        cmd /c "npm run dev"


--------------------------------------------------------------------------------
 THE 6 STEPS
--------------------------------------------------------------------------------

Full detail is in "how to run.txt" in this same folder. The short version:

  1. Create the database (run from this folder):
         powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1

     Defaults to superuser postgres/postgres. If yours differs, pass -SuperUser
     and -SuperPassword. Safe to run twice.

  2. Create the backend config:
         cd backend
         copy .env.example .env

  3. Generate the two JWT secrets (run from the folder ABOVE backend):
         powershell -ExecutionPolicy Bypass -File scripts/gen-secrets.ps1

     It prints two lines. Paste them over JWT_ACCESS_SECRET and
     JWT_REFRESH_SECRET in backend/.env. The API WILL NOT START until you do —
     the example secrets are published in the repo, so they are rejected.

  4. Install dependencies:
         cd backend
         go mod download
         cd ..\frontend
         cmd /c "npm ci"

  5. Load the demo data:
         cd ..\backend
         go run ./cmd/seed

     Creates 50 products with images, sizes and colours, 3 categories,
     2 coupons, ~150 reviews and the two accounts below.

  6. Start it. Open TWO terminals and leave both running.

     Terminal 1:
         cd backend
         go run ./cmd/api
       Wait for: INF API listening addr=:8080 env=development

     Terminal 2:
         cd frontend
         cmd /c "npm run dev"
       Wait for: Local: http://localhost:5173/

     Then open http://localhost:5173


--------------------------------------------------------------------------------
 ACCOUNTS
--------------------------------------------------------------------------------

   Admin     admin@example.com     / Admin@12345
   Customer  customer@example.com  / Customer@12345

   The admin account is created from backend/.env (ADMIN_EMAIL / ADMIN_PASSWORD).
   Sign-up uses a phone number plus an SMS code; with SMS_TEST_MODE=true the code
   is printed on the register page, so no SMS provider is needed.

   Payments go to the ZarinPal SANDBOX. No real money moves, and the sandbox
   accepts any merchant id.


--------------------------------------------------------------------------------
 WHAT IS WORTH TESTING
--------------------------------------------------------------------------------

   - Browse the catalogue, filter, and open a product (sizes, colours, gallery)
   - Add to cart, change quantities, apply coupon WELCOME10 (needs 300,000 Toman)
   - Register with a phone number, then check the SMS code appears on screen
   - Complete an order end to end, then open it from "My orders"
   - Sign in as the admin and walk /admin: products, orders, coupons, reviews
   - Toggle dark mode (the toggle in the header) and resize the window
     — the layout is RTL, so check the mirror-image behaviour

   If something breaks, please note WHICH page, what you clicked, and what you
   expected to happen. Browser console errors help a lot too.


--------------------------------------------------------------------------------
 IF SOMETHING DOES NOT WORK
--------------------------------------------------------------------------------

   "connect database" / "connection refused"
       PostgreSQL is not running, or the password in backend/.env differs.

   "config: JWT_ACCESS_SECRET still holds the example value"
       Step 3 above was skipped.

   "port 8080 already in use"
       scripts\stop-api.cmd   (kills whatever is on the API port)

   "npm.ps1 cannot be loaded"
       Use cmd /c "npm ..." instead of calling npm directly.

   Blank page / every request fails
       The API is not reachable. Open http://127.0.0.1:8080/api/v1/health
       in the browser — it should return {"status":"ok",...}.

   Section 12 of "how to run.txt" has the full list with causes and fixes.


--------------------------------------------------------------------------------
 WHAT IS IN THIS FOLDER
--------------------------------------------------------------------------------

   how to run.txt     the complete, step-by-step run guide (start here)
   README.md          project overview + full API reference
   PROGRESS.md        what is done, what is left, known issues
   backend/           Go API (cmd/, internal/, migrations/)
   frontend/          React storefront (src/, public/)
   scripts/           the setup and verification helpers
   docker-compose.yml optional all-in-one Docker route (see how to run.txt § 9)

   There is no node_modules or database dump in here — steps 4 and 5 create
   those. Nothing secret is included either: backend/.env is generated in step 2
   and only .env.example is shipped.

================================================================================
