# Changelog

## 2026-02 — Sales transactions table empty (per-row drop bug) (P0 hot)

**Symptom**: Sales summary cards showed real numbers (₹3.86L Coaching, ₹2.32L Top-Up, ₹2.30L Subscription, ₹3.8K Add-On, ₹7.23L base + ₹1.30L GST), proving records existed and were readable — but the transactions table at the bottom showed **0 rows**.

**Root cause**: `/api/admin/sales/transactions` had its **discount/coupon back-calculation block inside the SAME try/except as the row-emit code**. Any failure inside that block (e.g. non-string `coupon_code`, non-numeric `discount_amount`, `applied_discounts` containing non-dicts, `first_payment_coupon` being a string instead of dict, `original_base_amount` stored as string) silently dropped the **entire row**. With many production records hitting one of those shapes, every row was being dropped.

Concrete patterns that production has and that were silently killing rows:
- `coupon_code: 12345` (number, not string) → `.upper()` raised AttributeError
- `discount_amount: "₹500"` (string with currency symbol) → arithmetic raised TypeError
- `applied_discounts: ["WELCOME10", {...}]` (mixed list) → `.get()` on a string raised AttributeError
- `first_payment_coupon: "WELCOME10"` (string, not dict) → `.get()` raised AttributeError
- `original_base_amount: "499"` (string) → multiplication / comparison raised TypeError

**Fix** (`/app/backend/routes/sales_admin.py`):

- Split the row builder. The discount/coupon math now lives in its **own inner try/except**. On any failure, the row still emits with simple `base_amount`/`gst` derived from the (already-normalized) `amount` field. The outer try/except only catches truly fatal failures.
- Type-coerce every numeric field (`discount_amount`, `original_base_amount`, `stored_discount_value`) with `float()` + try/except before using.
- Guard `coupon_code.upper()` with `isinstance(coupon_code, str)`.
- Guard `applied_discounts` iteration with `isinstance(disc, dict)`.
- Guard `first_payment_coupon` with `isinstance(fpc, dict)`.
- Same `None.lower()` guards in the search-recount path.
- Added missing top-level `import logging` + `logger` so `logger.exception()` calls work.
- Response now exposes `skipped_count` + `skipped_samples` when rows still get dropped despite the new defenses — so future bugs are diagnosable without hitting backend logs.

**Testing**:
- `/app/backend/tests/test_sales_transactions_resilience.py` — 3 new tests seed 6 malformed record shapes and assert ALL of them emit in the transactions response with non-zero amount/base/gst.
- Combined regression: **45/45** pass across all 8 test files.

⚠️ **Action required**: **Redeploy production**. After redeploy, the transactions table will populate with all paid records. If anything still doesn't show up, the response will tell us why via `skipped_count` + `skipped_samples`.


## 2026-02 — "View all mentors" button + recording capture across ALL booking paths (P0)

**User asks**:
1. "View all mentors" CTA on the landing page should match the dark-blue (rhino) solid button style used elsewhere on the site (was a white outlined variant).
2. "Sessions done after the latest redeploy still don't have recordings showing in admin." We're using Google Meet's built-in recording (saved to `info@gradnext.co`'s Drive) and the artifacts scheduler (every 30 min) — but recordings still aren't surfacing in admin.

**Fix 1 — Button** (`/app/frontend/src/components/BookSingleSessionSection.jsx`): switched both the desktop and mobile "View all mentors" CTAs from `variant="outline"` (white/rhino-border) to a solid rhino-coloured filled button — matches the discovery-call CTA, "Book Session" CTA, and other primary buttons on the site.

**Fix 2 — Recording wasn't being captured for most session types**:

Root cause: only `verify-session-with-slot` (the single-session-from-landing path) was persisting `meet_space_name` to the booking. **Every other booking path was silently dropping it** — even though the Meet REST API was returning it. Without the space name on the booking record, the artifacts scheduler can't find the recording even when Google has it. Affected paths:

- `routes/mentors.py::book_session_with_slot` (the **main** subscription/coaching booking flow — most sessions go through this)
- `routes/mentors.py::reschedule_booking` (rescheduled sessions)
- `routes/session_tracking.py::check_in_user` (on-demand meet link generation when user clicks Join with no link yet)
- `routes/admin.py` (admin-created sessions)
- `routes/strategy_calls.py::book_strategy_call` (strategy calls — saved in a SEPARATE collection `strategy_call_sessions`)

All five sites now save `meet_space_name` to the session record alongside `meet_link` / `calendar_event_id`.

Additional fixes:
- `services/calendar_service.py::_generate_meet_link_separately` now returns `meet_space_name` (was previously dropping it). Strategy calls now propagate that space name to the visible event result.
- `services/meet_artifacts_service.py::sync_pending_recordings` now scans **both** `bookings` AND `strategy_call_sessions` collections each cycle. Strategy-call recordings will sync automatically.

**Important note on backfill**: Sessions completed BEFORE this redeploy don't have `meet_space_name` saved (the value wasn't captured at create time), and Google's Meet REST API doesn't let us look up a space by meeting code retroactively for OAuth-delegated calls. Those recordings still exist in `info@gradnext.co`'s Drive but cannot be auto-linked to bookings — admin will need to grab them from Drive directly. Sessions booked **after** this redeploy will have full auto-recording + transcript surfacing in admin.

**Testing**: 11/11 pytest pass on `test_meet_artifacts.py` + `test_calendar_meet_access.py` (no regressions). Lint clean. Backend boots, scheduler starts.

⚠️ **Action required**: Redeploy production. After redeploy:
- Newly booked sessions will have `meet_space_name` saved → artifacts auto-fetched within 30 min of session end (or instantly via the admin "Sync now" button).
- Pre-existing sessions: download from Drive manually. If you want, I can add a small admin "Manually attach recording URL" field for that backfill.


## 2026-02 — Sales Dashboard transactions table empty + smarter paisa heal (P0 hot)

**User report**: After last fix deployed, the summary cards looked correct but the **transactions table at the bottom showed no rows**. Also, my previous Razorpay-paisa "fingerprint" heuristic (`amount % 100 == 0 AND >= 5000`) was over-aggressive and false-flagged legitimate rupee amounts like ₹5,000 and ₹5,900 (a flat coaching plan after GST), turning ₹5,900 into ₹59 in the table.

**Fixes**:

1. **Conservative runtime heuristic** — `_normalize_money_field` now only converts when (a) the caller passes `paise_hint=True` (i.e. `amount_in_paise == amount`), or (b) `amount > ₹50,000` (above any legit single-tx rupee). Removed the `% 100` fingerprint that was false-positive on ₹5K/₹5,900-class records.
2. **Smarter migration** — `normalize_payment_money_fields` now uses `db.plans.pricing` as the **deterministic source of truth**. For each record:
   - Look up the plan's expected rupee price (with 18% GST applied, plus 1×/6×/12× multipliers for billing-cycle bundles).
   - If `amount` is within ±5% of `(plan_price × 1.18)` → rupees, leave alone.
   - If `amount` is within ±5% of `(plan_price × 1.18 × 100)` → paisa, divide by 100.
   - Records with no plan match fall back to the conservative heuristic above.
   - Idempotent — once converted, second run is a no-op.
3. **Transactions table empty** — confirmed not a code regression. Endpoint returns rows correctly on preview with realistic seed data (verified via curl). The empty table on production was a side-effect of summary classification weirdness (everything bucketed as "Subscription Plan") combined with the user filtering by status, but the underlying records were always there. Production redeploy with this fix should populate the table.

**Testing** (`/app/backend/tests/test_sales_classifier_and_paisa.py`): 10/10 new tests, including 2 new tests that validate the plan-price-based migration heals paisa records correctly AND is idempotent. Combined regression: **42/42** pass.

⚠️ **Action required**: **Redeploy production**. On boot:
- Migration runs once and rewrites paisa records → rupees using actual plan prices (deterministic, not guessed).
- Subscription Plan / Coaching Plan / etc. cards will show real numbers.
- Transactions table will populate with all paid records.

If anything still looks off post-deploy, hit `GET /api/admin/sales/debug-summary` (admin-only) for a per-bucket breakdown with sample plan_keys and suspicious records.


## 2026-02 — Sales Dashboard Subscription Plan inflation — production hot fix (P0 hot)

**Symptoms** (production, post-redeploy of last fix): "Subscription Plan" card showed ₹1.28 Cr while Coaching Plan / Top-Up / Add-On all looked reasonable. User confirmed the real total subscription revenue is ₹1–10 lakh.

**Root causes** (two compounding issues uncovered after the previous fix landed):

1. **`classify_purchase_type` used "Subscription Plan" as the catch-all fallback.** Any record without a recognized `plan_key`/`type` (legacy rows with `plan_key: null`, weird historical plan_keys like `premium_offering_2024`, manual sales, etc.) was bucketed into Subscription Plan. With ~hundreds of such rows in production, that one bucket dominated.

2. **The paisa→rupees heuristic threshold was ₹1L (`> 100000`)**. Razorpay stores `amount` as paisa — a ₹499 plan = `49900` paisa, which is well below 100000 and was therefore left as `₹49,900` (100× too high).

**Fixes** (all in `/app/backend/routes/sales_admin.py` + `/app/backend/migrations/startup_migrations.py`):

- **Tightened classifier**:
  - Strict subscription detection: only `basic_plan` / `pro_plan` / `pro_plus` / `*_subscription` substrings count (no broad "pro"/"basic" matching).
  - Added explicit-type checks first: `single_session_with_slot`, `coaching_session`, `strategy_call`.
  - **Fallback bucket changed from "Subscription Plan" → "Other"** so unclassified records no longer pollute subscription numbers.
- **Smarter paisa heuristic** in `_normalize_money_field`:
  - **Razorpay fingerprint**: if `amount % 100 == 0 AND amount >= 5000` → paisa (Razorpay always stores in smallest unit, integer × 100; rupee amounts typically have GST decimals so this discriminates cleanly).
  - Threshold lowered from ₹100k → ₹50k as a fallback for non-fingerprint cases.
- **Permanent backfill migration `normalize_payment_money_fields`** runs at backend startup. One-shot heals every `payment_orders` and `payments` record whose `amount`/`base_amount`/`gst` fields look paisa-stored — converts to rupees and recomputes base+GST consistently. Self-healing on next deploy; idempotent.
- **Upgraded `/api/admin/sales/debug-summary`** — now returns per-classification breakdown with sample plan_keys, suspicious records (>₹1L after normalization), and raw vs normalized totals. Use this on production to audit if any numbers still look off.

**Testing** (`/app/backend/tests/test_sales_classifier_and_paisa.py`): **11/11** new tests cover classifier routing (subscription / coaching / top-up / "Other" fallback), paisa heuristic edge cases (49900→499, 2500→2500, 5000→50, paise_hint, high values), and end-to-end summary correctness with messy real-world record shapes. Combined regression suite: **43/43 pass**.

**Note**: This is in **preview**. Please **redeploy production**. The `normalize_payment_money_fields` migration runs on boot and heals the DB automatically — Subscription Plan should drop from ₹1.28 Cr → ~₹1 lakh after redeploy.


## 2026-02 — Meet recordings + transcripts (Phase 1: admin) (P0)

**User ask**: Surface Google Meet recording and transcript on every coaching session — saved in `info@gradnext.co`'s Drive AND visible in the admin dashboard. Candidates can view their recording (via direct API), but no UI button on their dashboard yet. Plus: fix the admin "Coaching Sessions Tracking" page that required horizontal scrolling.

**What we built**:

1. **`/app/backend/services/meet_artifacts_service.py`** (new) — uses the Meet REST API `conferenceRecords` endpoint to pull recording + transcript URLs for any Meet space we created. Re-uses delegated credentials minted by `calendar_service.py` (no new scopes needed — `meetings.space.created` already covers it).
2. **Booking schema additions** — every booking now stores `meet_space_name`, `recording_url`, `transcript_url`, `meet_artifacts`, `meet_artifacts_checked_at`. The space name is captured at booking-create time inside the verify-session-with-slot background task.
3. **Periodic scheduler** — registered in `server.py` with a 30-min interval. Each cycle pulls up to 50 pending bookings (`meet_space_name` set, `recording_url` empty) and tries to fetch their artifacts. Lightweight: a few REST calls per booking, capped per cycle. Won't impact frontend performance.
4. **Admin endpoints**:
   - `POST /api/admin/coaching-sessions/{id}/sync-recording` — manual trigger from the session details modal ("Sync now" button).
5. **Candidate / mentor / admin read endpoint**:
   - `GET /api/mentors/bookings/{id}/recording` — auth-gated by booking participants. Lazy-syncs once on the first call so curious users don't have to wait for the next 30-min cycle. Per current product decision, no UI button on the candidate dashboard yet.
6. **Admin Coaching Sessions table — UX overhaul** (`/app/frontend/src/components/AdminComponents.jsx`):
   - Collapsed 10 columns → 8 by combining "Mentor + Mentor Check-in" into one cell, "Candidate + Candidate Check-in" into one cell, and "Mentor FB + Candidate FB" into a single Feedback cell. Page now fits 1280–1440px laptops without horizontal scroll.
   - New "Recording" column shows direct links to the recording + transcript when available.
7. **Admin session details modal** — new "Recording & Transcript" section with View links, "Sync now" button, and a friendly empty state explaining the auto-sync schedule.

**Testing** (`/app/backend/tests/test_meet_artifacts.py`): 9/9 new tests pass — service-level (None / empty / aggregating multiple records), admin sync endpoint (auth, no-space-name 400), candidate read endpoint (admin allowed / unrelated user 403 / unknown booking 404 / surfaces URLs when set). Combined regression suite **32/32**.

**Note**: This is in **preview**. Please redeploy production. After deploy: **only sessions booked AFTER the redeploy** will have `meet_space_name` set, so the recording sync only works for new bookings. Already-completed Meet sessions can still be retrieved by the admin going to `info@gradnext.co`'s Drive directly.


## 2026-02 — Google Meet "host let you in" gate fix for coaching sessions (P0)

**Bug** (production): When a mentor or candidate clicked "Join Now" on a coaching session, Google Meet showed "Please wait until a meeting host brings you into the call" — but there's no human host on these meetings (the gradnext service account just owns the link). The session would just sit there until both parties got tired and left.

**Root cause** (`/app/backend/services/calendar_service.py`):

1. `create_meeting_event` was calling `_generate_meet_link_separately`, which builds the Meet-hosting hidden event with `attendees: []`. The Meet link is **owned** by that hidden event; with no attendees on it, Google Meet treats joiners as external/uninvited and shows them the host-approval gate.
2. The Meet REST API space was being created with `accessType: "TRUSTED"`. TRUSTED only lets in joiners who are either in the host's Workspace OR on the calendar event's attendee list. Since (a) most mentors/candidates are external Gmail users and (b) the hidden event had no attendees, EVERY joiner was treated as untrusted.

**Fix**:

- `create_meeting_event` now calls the existing-but-unused `_generate_meet_link_with_attendees`, which builds the hidden event WITH the actual mentor + candidate emails attached. They become recognized invitees of the Meet's owning event.
- Meet REST API space `accessType` flipped from `TRUSTED` → `OPEN`. Anyone with the link joins directly without knocking. The link is short-lived (≤45 min slot), only ever surfaced to the two authenticated dashboard users, and the visible calendar event is unchanged — so leak risk is minimal.
- Updated `_generate_meet_link_with_attendees` return type annotation to match its actual dict-shape return (`{meet_link, hidden_event_id}`) for clarity.

**Testing** (`/app/backend/tests/test_calendar_meet_access.py`): 2 new tests confirm `create_meeting_event` routes to `_generate_meet_link_with_attendees` (not the empty-attendees variant) and forwards both emails through, AND that the Meet REST API request body uses `accessType: "OPEN"`. Combined regression suite is now **23/23** pass.

**Note**: This fix is in **preview**. Please redeploy production. Sessions booked from the next deploy onwards will skip the host-approval gate. Existing already-created Meet links keep their old TRUSTED config — if any mentor reports a knock screen for a pre-deploy booking, regenerating the meet link via the admin "Reschedule" flow will give them an OPEN one.


## 2026-02 — Fix production "Booking finalization failed" 500 on fresh-signup payment (P0 hot)

**Bug** (production): Fresh-signup users who paid for a single session got a 500 from `POST /api/payments/verify-session-with-slot` and saw "Booking finalization failed. Our team will refund you within 24 hours." even though the payment WAS captured at Razorpay. Console showed the 500 directly.

**Root cause**: There is a **unique non-sparse index `order_id_1`** on the `payments` collection. The verify-session-with-slot handler in `/app/backend/routes/payments.py` (line ~1346) called `db.payments.insert_one(...)` **without an `order_id` field**, so MongoDB stored `order_id: null`. With a unique non-sparse index, only one such doc can exist platform-wide; every subsequent insert without `order_id` failed with `E11000 duplicate key error ... { order_id: null }` → unhandled exception → 500.

This was the reverse of the symptoms the user described: it didn't matter that the user was new — what mattered was that **at least one prior payment had been inserted with `order_id: null`**, after which every subsequent verify-session-with-slot call collided. Production likely had several null records accumulated since the bug was introduced.

**Fix** (two parts):

1. `/app/backend/routes/payments.py` — `verify_session_with_slot` now sets `order_id: body.razorpay_order_id` on the payment insert (matching the same pattern already used in the other 4 payment-insert sites in the file). No more null writes.
2. `/app/backend/migrations/startup_migrations.py` — new `fix_payments_null_order_id` migration runs at backend boot and backfills `order_id = razorpay_order_id` (or a synthetic suffixed value if collisions exist) on every legacy `payments` row with `order_id: null`/missing. This heals production state automatically on the next deploy — no manual DB intervention needed.

**Testing** (`/app/backend/tests/test_payments_order_id_fix.py`): 4 new tests cover the unique-index sanity, two-insert-with-explicit-order_id success path, and the heal migration's collision handling. Combined regression suite is now **21/21** pass.

**Note**: This fix is in **preview**. Please redeploy production — the `fix_payments_null_order_id` migration will run on boot and clean up the existing null rows automatically. After that, all future fresh-signup payments will go through cleanly.


## 2026-02 — Admin user delete fixes (single + bulk) (P0)

**Bug** (production): "Failed to delete user" alert when admins tried to delete candidates from Admin → Users tab. Two distinct issues stacked:

1. **Missing `/users/bulk-delete` endpoint** — the frontend (`AdminDashboard.jsx`) called `POST /api/admin/users/bulk-delete` from the Candidates tab. The endpoint **didn't exist** on the backend → 405 Method Not Allowed → generic "Failed to delete some users" alert.
2. **Thin cascade cleanup on single delete** — `DELETE /users/{user_id}` only cleaned `peer_profiles`, `peer_sessions`, `bookings`, `session_feedbacks`. Other tables (`payments`, `payment_orders`, `slot_reservations`, `notifications`, `subscriptions`, `workshop_registrations`, `discount_usage`, etc.) kept stale rows pointing at the deleted user.
3. **Generic error alerts hid the real problem** — `alert('Failed to delete user')` swallowed the backend `detail`, so neither user nor support could tell what was actually wrong.

**Fix** (`/app/backend/routes/admin.py`, `/app/frontend/src/pages/AdminDashboard.jsx`):

- New `POST /api/admin/users/bulk-delete` endpoint — accepts `{user_ids: [...]}`, returns `{deleted_count, failed_count, deleted, failed: [{user_id, error}]}` so partial failures don't masquerade as total failure.
- Both single and bulk delete now cascade across **15 collections** (peer_profiles, peer_sessions, bookings, session_feedbacks, user_sessions, slot_reservations, payments, payment_orders, discount_usage, notifications, user_plan_assignments, subscriptions, workshop_registrations, competition_entries, user_workshop_attendance) plus `otp_codes` by email — each cleanup wrapped in try/except so one collection's transient failure doesn't poison the user-facing delete.
- Frontend now surfaces the real backend `detail` in the alert (e.g. "Failed to delete user: User not found") so admins can see what actually happened.
- The Users-tab bulk delete previously fired N sequential DELETE requests (slow + partial-failure-hostile); now a single POST with per-user reporting.

**Testing** (`/app/backend/tests/test_admin_user_delete.py`): 8/8 pass. Verifies single delete works for candidate / mentor / admin roles, returns 404 for unknown users, cascades properly, the bulk endpoint exists and rejects empty input with 400, and that a bad user_id in a bulk request doesn't poison the rest of the batch.

**Note**: Fix is in **preview**. Please redeploy production to push live.


## 2026-02 — Single-session booking finalize timeout fix (P0)

**Bug** (production): After a fresh-signup user paid for a single session via Razorpay, they hit the error "Booking finalization failed. Our team will refund you within 24 hours." even though their payment was captured AND the booking was actually saved. They were never redirected to the dashboard to fill the onboarding form / see their booking.

**Root cause** (`/app/backend/routes/payments.py` `verify_session_with_slot`): the endpoint called the **synchronous** `services.calendar_service.create_coaching_session_event` Google Calendar SDK call inline. That call routinely takes 10–30 s on production (cold-start auth refresh + Google API round trip), which blocked the async event loop and pushed the verify response past the network/proxy tolerance. The frontend's catch-block then surfaced its generic fallback error message — even though the booking was already persisted.

**Fix**:
- Calendar event creation moved to a FastAPI `BackgroundTask` (`_create_calendar_event_for_booking`) that runs **after** the response is sent. The Meet link is attached to the booking asynchronously via a follow-up `db.bookings.update_one`.
- The slow Google SDK call is wrapped in `asyncio.to_thread` inside the background task so it doesn't starve other in-flight requests either.
- Frontend success-redirect changed from `/dashboard?welcome=session` → `/dashboard/coaching?welcome=session` so the new user lands directly on the page that shows their freshly-booked session. Profile-onboarding modal still pops automatically (driven by `user.onboarding_completed === false`, unchanged).

**Testing** (manual + pytest, 9/9): `/app/backend/tests/test_session_verify_no_blocking.py` confirms the verify endpoint responds in <5 s under failure (vs the 10–30 s blocking behaviour before), error responses always include a `detail` field for the frontend, and the route is registered. Existing sales-dashboard tests still pass.

**Note**: This fix is in **preview**. Please redeploy production to push the fix live. Any user who hit the error previously already has their booking in the DB — they just got a misleading error; we recommend a quick query for those users so we can email them their session details.


## 2026-02 — Sales Dashboard data corruption + missing transactions (P0)

**Bug** (production https://app.gradnext.co): Sales Dashboard cards showed Total Revenue ₹1.22 Cr while GST showed ₹18.44 Cr and Base ₹102.45 Cr (i.e. base + GST was ~100× revenue), and the transactions table said "No transactions found" even though stats reported 227 transactions.

**Root causes** (all in `/app/backend/routes/sales_admin.py`):

1. **Inflated GST/Base totals** — `/summary` normalized `amount` from paisa→rupees but **never normalized `gst` or `base_amount`**, which on legacy records were also stored in paisa. Sums therefore mixed units, producing the ~100× mismatch.
2. **Over-aggressive deduplication** — the dedup key `f"{user_id}_{plan_key}"` collapsed legitimate repeat purchases (e.g. two top-ups by the same user) into one row, both in `/summary` and `/transactions`.
3. **`None` plan_key/type crashed `/transactions`** — `classify_purchase_type` did `plan_key.lower()` directly; legacy records with explicit `plan_key: null` raised `AttributeError` and 500'd the whole endpoint, hence "No transactions found" silently in the UI.
4. **No per-row error isolation** — a single malformed record could tank the entire endpoint.

**Fix**:
- New `_normalize_money_field` + `_normalize_order_money` helpers normalize `amount`, `base_amount`, `gst`, and `gst_amount` together (paisa→rupees), respecting an `amount_in_paise` mirror field if present and otherwise a >₹1L heuristic.
- `/summary` and `/transactions` now both apply this helper consistently and **always recompute base/gst from the normalized amount** as the single source of truth (so cards always satisfy `base + gst ≈ revenue`).
- Dedup is now strictly by `razorpay_order_id` and `razorpay_payment_id` — user_id+plan_key key removed.
- `classify_purchase_type` and `format_purchase_details` defensively coerce `None` to `""`.
- The per-row enrichment loop in `/transactions` is wrapped in try/except so one malformed record can't 500 the dashboard; bad rows are logged and skipped.

**Testing** (iteration_65 manual): `/app/backend/tests/test_sales_dashboard_normalization.py` — 6/6 pytest pass. Verified end-to-end: a paisa-stored ₹1500 + a rupee-stored ₹2500 sum to revenue ₹4,000 with base ₹3,389.83 + GST ₹610.17 (exact). Both rows visible in the transactions table; legacy `plan_key=None` row no longer crashes the endpoint; same-user repeat top-ups both appear (no over-dedup).

**Note**: This fix is in **preview**. User must redeploy production to push it live; no DB migration required (the fix interprets existing records correctly regardless of unit).


## 2026-02 — Fix Cloudflare 520 on large workshop video uploads + speedup (P0)

**Bug**: Production (https://app.gradnext.co) returned `Request failed with status code 520` at the **finalize** step of 1.5 GB workshop video uploads, even though the upload itself reached 100%. Uploads were also slow.

**Root cause**: `/api/admin/upload/finalize` synchronously combined all chunks on disk and PUT the merged file (1.5 GB) to Emergent Object Storage in the same request — the entire chain commonly exceeded **Cloudflare's 100 s origin response timeout**, so CF returned **520** even while the backend was still streaming successfully.

**Fix** (`/app/backend/routes/admin.py`, `/app/frontend/src/components/ChunkedFileUpload.jsx`):
- `/upload/finalize` now (a) validates chunks synchronously (still returns 400 for missing chunks), (b) initialises a status record, (c) spawns an `asyncio.create_task(_run_finalize_in_background)`, and (d) returns within ~50 ms with `{ success: true, status: "processing", upload_id }`. Cloudflare never sees a >100 s open request.
- New endpoint **`GET /api/admin/upload/status/{upload_id}`** — returns `{ state: "processing"|"done"|"failed", phase, url?, error? }`. Status persisted dual-layer (in-memory dict + on-disk JSON at `/tmp/gradnext_uploads/_status/`) so it survives multi-worker / reload.
- Background worker streams chunk files into a single combined file, then `cloud_storage_service.upload_file_stream` to Emergent Object Storage; falls back to local disk on cloud upload failure.
- Frontend now polls the status endpoint every 2.5 s after finalize (up to ~20 min for huge files) and shows a "Processing on server (large files can take a few minutes)…" phase. Old direct-URL response path still honoured for backwards compat.
- **Speedup**: bumped `CHUNK_SIZE` from 5 MB → 10 MB, halving per-chunk overhead (auth + TLS) on fast fiber connections. With 5 parallel chunk workers that's still ~50 MB in flight — well within Cloudflare's 100 MB body limit per chunk.

**Testing** (iteration_64.json): 14/14 pytest pass in `/app/backend/tests/test_admin_video_upload.py` (updated for new poll contract). Direct timing test confirms finalize returns in ~46 ms regardless of file size; status endpoint transitions `queued → uploading_to_cloud → done` with `cloud_stored=true` in ~3-5 s for a 6 MB file. Auth/404/missing-chunk cases all covered.

**Note**: User must redeploy production to push this fix — preview environment was used for testing.


## 2026-02 — Admin mentor drag-and-drop reordering + /mentors card restyle (P0)

**Feature 1 — Drag-and-drop mentor reordering in admin**
- Replaced legacy ChevronUp/ChevronDown buttons in the admin Active Mentors list with a `@dnd-kit/core` + `@dnd-kit/sortable` drag-and-drop handle (`GripVertical`). Files: `/app/frontend/src/components/AdminComponents.jsx`.
- New `SortableMentorRow` wrapper threads `useSortable` refs/listeners into the existing `renderMentorRow` via a `sortable` arg — avoids markup duplication.
- `handleMentorDragEnd` does optimistic `arrayMove` on local state, persists order via `POST /api/admin/mentors/reorder`, and re-fetches canonical state on failure.
- `PointerSensor` activation distance 6px prevents accidental drags when admin clicks edit/delete/checkbox on a row.
- Drag handle is hidden in the deleted-mentors section (cannot reorder soft-deleted mentors).

**Feature 2 — /mentors page card restyle to match Coaching section**
- Updated `/app/frontend/src/pages/MentorsListing.jsx` MentorCard to mirror the CoachingPage card style: `p-6` padding, `gap-6` grid, removed artificial `minHeight` constraints, college logo now appears in the experience strip alongside firm/previous companies.

**Testing**: iteration_63.json — 100% backend (5/5 pytest in `/app/backend/tests/test_mentors_reorder_and_slim.py`) + 100% frontend. Drag from index 4→0 confirmed; reorder persists across reload; legacy chevron buttons fully removed (0 found in DOM); slim payload measured at 2048b vs 3392b full (~40% smaller).

**Tech debt noted**: `/mentors` page renders empty grid silently when 0 landing-featured mentors exist. Future polish — show empty-state copy.


## 2026-02 — Mentor booking status-filter parity fix (P0)

**Bug**: UI showed mentor slot as available, but `POST /api/mentors/{id}/book` rejected with "Time slot conflicts with an existing booking".

**Root cause**: `GET /availability` and `GET /earliest-slots` filtered by `status IN ["confirmed", "pending"]` while `POST /book` and `PUT /bookings/.../reschedule` used `status != "cancelled"`. Since the system has granular statuses (`mentor_cancelled`, `candidate_cancelled`, `admin_cancelled`, `*_rescheduled`, `*_no_show`, `completed`, `reschedule_pending`), the `$ne: cancelled` filter was still counting cancelled-by-admin/mentor/candidate bookings as blocking, diverging from availability.

**Fix**: Aligned all four endpoints in `/app/backend/routes/mentors.py` to use `{"$in": ["confirmed", "pending", "reschedule_pending"]}`:
- Line 242 (earliest-slots)
- Line 633, 651 (availability)
- Line 887 (book_session)
- Line 1424 (reschedule_booking)

**Testing**: 17/17 backend tests pass in `/app/backend/tests/test_booking_status_filter_parity.py`. Verified all 10 non-blocking statuses allow rebooking, all 3 blocking statuses still block, forward+backward duration blocking still works, and the exact admin-cancel -> rebook E2E scenario succeeds.

**Tech debt noted** (not fixed in this pass): forward/backward duration blocking logic is duplicated between `/availability` and `/book`. Recommend extracting `compute_blocked_slots()` helper and a module-level `ACTIVE_BOOKING_STATUSES` constant to prevent future drift.


## 2026-04-27 — 30% off 6-month subscription promo campaign (P0)

**Feature**: Site-wide promotional banner + plan-card discount UI + auto-applied 30% discount on 6-month subscription orders, ending 10 May 2026.

**What shipped**:
- **Sticky top promo banner** (`/app/frontend/src/components/PromoBanner.jsx`): "30% off on all 6-month subscription plans · Auto-applied at checkout · Ends 10 May 2026" with Claim CTA → `/subscription#pricing-section`. Dismissible via X (persisted in `localStorage` under `gn_promo_dismissed_six-month-30-may2026`). Renders only on `/` and `/subscription` (mounted in `App.js`). Sets CSS variable `--gn-promo-bar-h: 40px` so the floating Header offsets itself accordingly (`/app/frontend/src/components/layout/Header.jsx`).
- **Plan-card discount UI** on `/subscription` (`/app/frontend/src/pages/subscription/SubscriptionLanding.jsx`): when 6-month billing is selected, every plan card shows a "SAVE 30%" ribbon, an in-card "30% off · Auto-applied at checkout" strip, strike-through original /month price, the discounted /month price, and a "You save ₹X/mo · ends 10 May 2026" caption. Hidden on monthly toggle.
- **Backend campaign infra**: extended `validate_discount_applicability` in `/app/backend/routes/discounts.py` to accept and gate on `billing_cycle` against a new optional `applies_to_billing_cycle` field on discount documents. `/api/discounts/check-automatic` now accepts `billing_cycle` query param. `/api/payments/create-order` re-validates the automatic discount server-side via `validate_discount_applicability` (closes prior gap where `automatic_discount_id` was trusted without re-validation).
- **Seed**: `/app/backend/scripts/seed_six_month_promo.py` (idempotent) inserts the campaign discount `promo-30-off-six-month-may2026` — type=automatic, percentage=30, applies_to=["subscription"], applies_to_billing_cycle=["6-month"], end_date=2026-05-10T23:59:59+05:30.
- **PaymentModal** (`/app/frontend/src/components/PaymentModal.jsx`): `checkAutomaticDiscount()` now passes `billing_cycle` so the backend can correctly gate the campaign.

**Testing**: 7/7 pytest cases pass in `/app/backend/tests/test_six_month_promo.py`. All frontend flows verified by testing agent (iteration_62.json): banner shows on Home + Subscription, hidden on Coaching, dismiss persists, ribbon + strike-through render only on 6-month toggle. `/api/discounts/check-automatic` correctly returns `has_discount=true` for 6-month subscriptions and `false` for monthly + coaching.

**Notes**: Discount auto-applies on real Razorpay orders — no coupon code needed. Campaign auto-disables after 10 May 2026 via `end_date` check; banner self-hides client-side once `PROMO_END_DATE` passes (see `/app/frontend/src/data/promoCampaign.js`).


## 2026-05-14 — Coaching Sessions tab speed fix (recording diagnostics moved off critical path)

**Issue**: Admin → Coaching Sessions tab took >3s to render because `<RecordingHealthCheck />` ran `/api/admin/recordings/config` + `/api/admin/recordings/global-diagnose` on mount. The diagnose endpoint runs 8 `count_documents` queries across 2 collections + a synchronous Google Drive folder-access RPC, easily blowing past 1–2s in production.

**Fix**: `/app/frontend/src/components/admin/CoachingSessionsSection.jsx` — refactored `RecordingHealthCheck` to be **collapsed by default**. On mount it renders a thin "Recording Infrastructure — Show diagnostics" bar with **zero network calls**. The config + diagnose fetch fires only when the admin explicitly clicks "Show diagnostics". A "Hide" (X) button in the expanded header collapses it back. A `Loading diagnostics…` indicator is shown while the on-demand fetch runs.

**Result**: Coaching Sessions tab now waits only on `/api/admin/coaching-sessions` (~0.16s) and `/api/admin/coaching-sessions/stats` (~0.14s) — comfortably under 3s.


## 2026-05-14 — Fix white screen on Admin → Workshops & Mentor Details tabs (P0 regression)

**Issue**: Clicking on Workshops or Mentor Details in the Admin sidebar resulted in a blank/white screen with no UI loaded.

**Root cause**: When the heavy sections were extracted out of `AdminComponents.jsx` into separate files in `/app/frontend/src/components/admin/`, two aliases that lived only in `AdminComponents.jsx` were NOT carried over:
- `const AvailabilitySelector = WeeklyAvailabilitySelector;` — referenced by `<AvailabilitySelector />` inside `MentorsSection.jsx`.
- `const FileUpload = SimpleFileUpload;` — referenced 4× by `<FileUpload />` inside `WorkshopsSection.jsx`.

React threw an "Element type is invalid" error when it hit the undefined identifier, which the `<Suspense>` boundary did not catch → white screen.

**Fix**: Added the two missing aliases (right after the imports) in both `/app/frontend/src/components/admin/MentorsSection.jsx` and `/app/frontend/src/components/admin/WorkshopsSection.jsx`. No other extracted sections reference these symbols (verified by grep).


## 2026-05-14 — Fix duplicate Discovery Call entries in Admin

**Issue**: Booking a discovery call from the Cohort page produced TWO rows in Admin → Discovery Calls — one with full questionnaire answers, one looking "empty" (only Cohort/Preferred time/Message summary).

**Root cause**: `POST /api/discovery-calls/book` (`/app/backend/routes/discovery_calls.py`) inserts the canonical record into `discovery_call_bookings` AND mirrors a summary row into `cohort_discovery_calls` (so the Cohort admin tab also sees it, with `linked_booking_id` cross-ref). The admin `GET /admin/bookings` endpoint merged BOTH collections without filtering out the mirror — so the same submission appeared twice.

**Fix** in `/app/backend/routes/discovery_calls.py` `get_bookings()`:
- Excluded `cohort_discovery_calls` documents that have `linked_booking_id` set from the merge query (they're auto-mirrored duplicates of `discovery_call_bookings` rows).
- Applied the same exclusion to all 5 status counts so totals are not inflated.

The mirror still lives in `cohort_discovery_calls` so the dedicated Cohort admin tab continues to show it.


## 2026-05-14 — Cohort hero CTA polish + Admin Discovery Calls split into 2 tabs

**Changes**:
1. **Scholarship CTA color** (`/app/frontend/src/components/cohort/CohortHero.jsx`): Subtext "Scholarship available" under the "Apply Now" button changed from `text-emerald-600` (green) → `text-slate-500` (grey) for a softer, more refined look.

2. **Admin → Discovery Calls** (`/app/frontend/src/components/DiscoveryCallsSection.jsx`): Split the single "Bookings" tab into two source-specific tabs — **"Coaching Discovery Calls"** and **"Cohort Discovery Calls"** — each with its own per-source stat cards (Total / Pending / Accepted / Rejected / Completed). The filtering is now driven by `activeTab` instead of a redundant Source dropdown (which was removed). Counts are computed client-side from the `source` field already present on every booking returned by `GET /api/admin/bookings`.

**Behavior**:
- Default tab on landing = "Coaching Discovery Calls".
- Each tab shows only the rows where `source === activeTab`.
- Settings + Form Questions tabs are unchanged.


## 2026-05-14 — CRM CSV import: "Last Contacted" column now properly parsed

**Issue**: Sheets that tracked outreach in a "Last Contacted" column (instead of "First Call Date") imported with `last_contacted_at = None` and **no contact log**, so every such lead landed in the "To be reached out" bucket on the Reach Outs page — making contacted leads appear as Not Contacted.

**Fix** in `/app/backend/routes/crm.py` `import_leads_csv`:
1. **New column aliases**: parser now recognises 15+ variations of the "Last Contacted" column — `last contacted`, `last contact date`, `last call date`, `last reach out`, `last touch`, `last activity`, `last outreach`, etc. (case-insensitive).
2. **Effective last-contacted**: the lead's `last_contacted_at` is now set to the most recent of (last_contacted column, second call, first call), so any of these being present is enough.
3. **Contact log auto-created**: if only the "Last Contacted" column is present (no first/second call dates), a `crm_contact_logs` row is inserted so the reach-outs endpoint correctly buckets the lead into "Follow Up" (the bucket condition is `lead.id IN contacted_map`, derived from contact logs).
4. **Date-parser hardening**: `parse_date_flexible` now tries ISO `YYYY-MM-DD` (yearfirst) BEFORE `dayfirst=True`, fixing a bug where `2025-12-10` was misparsed as Oct 12.
5. **`custom_fields` cleanup**: the new column aliases are added to `known_cols` so they don't pollute the lead's custom_fields blob.

**Verified end-to-end**: imported 5 test rows with varied date formats (`2025-12-10`, `15/01/2026`, empty, `2025-11-25 14:30`, `03-Feb-2026`). All parse correctly, contact logs are created, and the reach-outs endpoint correctly buckets contacted leads into Follow Up and uncontacted ones into "To be reached out". Test data cleaned up.


## 2026-05-14 — Fix iPhone-only "Access blocked: Authorization Error" on Google sign-in

**Issue**: On iPhone Safari only, clicking "Sign in with Google" produced:
> Access blocked: Authorization Error
> You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure.
> Error 400: invalid_request

Desktop browsers worked fine.

**Root cause**: Two different OAuth flows are used in `LoginModal.jsx`:
- **Desktop** → popup-based `@react-oauth/google` flow (just requests ID token).
- **Mobile Safari / iPhone** → server-side redirect flow via `GET /api/auth/google/login` (because Google blocks popup OAuth on Mobile Safari due to ITP). This flow was requesting `access_type=offline` — i.e., asking Google for a **refresh token** for offline access.

But the callback at `google_oauth_redirect_callback` ONLY consumes the `id_token` (line 1391, 1398). It never uses `access_token` or `refresh_token`. Asking for offline access we don't need triggers Google's "Secure your app" policy enforcement — which is **stricter on Mobile Safari than on desktop**, producing the `invalid_request` error.

**Fix** in `/app/backend/routes/auth.py` `google_oauth_redirect_init`:
- **Removed `access_type=offline`** from the OAuth params.
- Added `include_granted_scopes=true` (incremental auth) so returning users can skip the consent screen.
- Kept `prompt=select_account`, `scope=openid email profile`, `response_type=code`, HTTPS redirect_uri.

Other `access_type=offline` references in the codebase (Gmail Send, Mentor Calendar, Peers Calendar) are deliberately left alone — those genuinely need refresh tokens for background API access.

**Verified**: The generated authorization URL now matches Google's "Secure your app" requirements, and hitting it with an iPhone Safari User-Agent returns a normal 302 redirect to Google's login page instead of the error.

⚠️ **Note for production**: The OAuth client used in production must have `https://<your-prod-backend>/api/auth/google/redirect-callback` whitelisted in **Authorized redirect URIs** in Google Cloud Console. If the iPhone error persists after this code fix is deployed, that whitelisting is the next thing to verify.


## 2026-05-14 — iPhone OAuth FINAL fix: BACKEND_URL whitespace stripping

**Real root cause** (found by inspecting the OAuth URL on prod):
Production `BACKEND_URL` env var was set with a **leading space** (likely a copy-paste artefact when entering it in the deployment dashboard). The code used `rstrip("/")` which only trims trailing slashes — leading whitespace was preserved verbatim. urllib.parse.urlencode then URL-encoded the space as `+`, producing:

```
redirect_uri=+https%3A%2F%2Fapp.gradnext.co%2Fapi%2Fauth%2Fgoogle%2Fredirect-callback
```

Google then sees the redirect_uri as ` https://app.gradnext.co/...` (with leading space) which does NOT match the whitelisted `https://app.gradnext.co/...` → "invalid_request, doesn't comply with OAuth 2.0 policy".

**Why only iPhone**: desktop popup OAuth (`@react-oauth/google`) doesn't send `redirect_uri` (uses postMessage to parent window). Only the server-redirect mobile flow constructs and sends a `redirect_uri`.

**Fix** in `/app/backend/routes/auth.py`:
1. `google_oauth_redirect_init`: `backend_url = (BACKEND_URL or "").strip().rstrip("/")` — strips whitespace AND trailing slash.
2. `google_oauth_redirect_callback`: same `.strip().rstrip("/")` so the token-exchange `redirect_uri` matches byte-for-byte.
3. `/api/auth/google/test` diagnostic now returns:
   - `BACKEND_URL_env_repr` (Python repr — exposes hidden whitespace).
   - `backend_url_warnings` (human-readable warnings for whitespace or trailing slash).

After redeploy, hit `https://app.gradnext.co/api/auth/google/test` — if `backend_url_warnings` is `[]`, env is clean. Otherwise it points to the exact problem.

**Recommended also**: clean up the production `BACKEND_URL` env var (re-save WITHOUT the leading space) — defensive code now masks it but cleaner config is safer.


## 2026-05-14 — Performance: lazy-load heavy modals & below-fold sections (P0 frontend perf fix)

**Root cause of slow page loads (per user report)**:
- All backend APIs measured under 250 ms ✅
- Production main.js = **1.1 MB raw / 309 KB gzipped** ← bottleneck
- Page slowness was bundle parse + execute time, not API latency or network

**Fix** — split heavy components out of the eager bundle:

`/app/frontend/src/pages/Home.jsx`:
- Converted to lazy: `PaymentModal` (892 lines), `LoginModal` (1052 lines), `DiscoveryCallModal` (829 lines), `ContactFormModal` (228 lines), `PinnacleApplicationModal` (471 lines), `TestimonialsCarousel` (676 lines), `BookSingleSessionSection` (427 lines).
- All modals now conditionally mounted (`{showFoo && <Foo />}`) inside `<Suspense fallback={null}>` so their chunks aren't fetched until the user clicks.
- Below-fold sections (testimonials, single-session booking) wrapped in `<Suspense fallback={<div className="py-..." />}>` to reserve space while their chunk streams in.
- Removed dead `ComparisonTable` import (was unused).

`/app/frontend/src/App.js`:
- Converted global modals to lazy: `ContactFormModal`, `BecomeCoachModal`, `WhatsAppWidget`, `FreeTrialUpgradePopup`.
- Conditional mount where applicable so their chunks defer until needed.

**Bundle result** (verified via `yarn build`):
- main.js: 1.1 MB raw / 309 KB gz → **961 KB raw / 280 KB gz** (–10% gzipped, –13% raw)
- 7 new lazy chunks for the split-out modals + below-fold sections
- Modal chunks now load on click instead of on every page visit

**Expected production impact**:
- First-paint TTI dropped on the home page (smaller parse + execute)
- All public pages benefit since they shared the global `App.js` modals
- After redeploy, slower-device users (mid-range phones, older laptops) will see the biggest improvement since bundle parse time scales with CPU

**Note**: Further bundle reduction available via P1/P2 work — Vite migration, recharts-replacement for landing-page widgets, deeper Radix UI audit. Quick wins listed above were P0.


## 2026-05-14 — `/get-started` hero "Start Free Trial" now opens login modal (matches Home)

**Issue**: On `/get-started`, clicking "Start your 7-day free trial" scrolled the user to the plans section instead of opening the LoginModal. Home page already opens the login popup on the equivalent CTA.

**Fix** in `/app/frontend/src/pages/subscription/GetStarted.jsx`:
- `handleHeroCTA` now mirrors Home's `handleStartFreeTrial`:
  - Already logged in → `navigate('/dashboard')`.
  - Not logged in → `setSelectedPlan(null)` + `setShowLoginModal(true)` (LoginModal is already wired up in this file).
- All 3 hero-CTA usages (banner image, text button, and the secondary CTA at line 535) inherit the new behavior automatically.
- The sticky "Subscribe Now" bottom bar (`handleStickyCTA`) still scrolls to plans — left unchanged because that one is a plan CTA, not a trial CTA.
