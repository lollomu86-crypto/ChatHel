# ChatHel — PRD & Status

## Problem Statement
ChatHel: piattaforma chiusa per ospiti di hotel. Accesso via QR/codice + nickname. Chat (reception, pubblica, privata, AI), bacheca eventi, aree con prenotazione, dashboard hotel. Linguaggio default: italiano. Stile: moderno/giovane.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Session-token auth (X-Guest-Token, X-Admin-Token). LLM via emergentintegrations (OpenAI GPT-5.2). WebSocket per realtime. Web Push (VAPID).
- **Frontend**: React + Router + Tailwind + Shadcn + Sonner. i18next (10 lingue). Service worker + manifest PWA.
- **Demo hotel auto-seeded**: code `WELCOME2026`, admin pw `admin123`. 4 aree + 3 eventi + 8 template coupon.

## User Personas
1. **Ospite** — vuole conoscere altri ospiti, info veloci, prenotazioni, eventi, regali.
2. **Hotel staff (admin)** — gestisce eventi, aree, ospiti, catalogo coupon, reception.

## Core Requirements
- Accesso QR/codice + nickname (no account permanente).
- Chat reception, pubblica, privata 1:1, AI concierge (multilingua).
- Bacheca eventi, aree con prenotazione.
- Dashboard hotel CRUD + check-out ospiti + QR ospiti stampabile.
- Realtime, multilingua, push.

## Implemented timeline
- **2026-06-11 v1.0 MVP**: Core completo + AI (testing 100%).
- **2026-06-11 v1.1**: Logo brand integrato + palette blu royal/navy.
- **2026-06-11 v1.2**: Foto reale Sofia, testo naturale, logo H+C ritagliato.
- **2026-06-11 v1.3**: Domanda del giorno (Step 1).
- **2026-06-11 v1.4**: Sfide nella chat pubblica con accept/decline (Step 2).
- **2026-06-11 v1.5**: QR scanner via fotocamera + QR ospiti in admin (Step 3).
- **2026-06-11 v1.6**: WebSocket realtime + polling fallback 20s (Step 4).
- **2026-06-11 v1.7**: Coupon regalo (guest + hotel) con mock payment + catalogo (Step 5).
- **2026-06-11 v1.8**: i18n 10 lingue + auto-detect + AI multilingua + traduzione on-demand (Step 6).
- **2026-06-11 v1.9**: Web Push (VAPID, service worker, PWA, push prompt) (Step 7).
- **2026-06-11 v2.0**: Repo pronto al push (README, LICENSE, .env.example, .gitignore).
- **2026-06-11 v2.0.1**: Bug fix challenge empty-note + admin select hydration warning. Test 3/3 pass.

## Backlog
- P1: Group chats ("gruppo piscina", "gruppo barca")
- P1: Stripe payment reale per coupon (mantenendo mock come fallback demo)
- P2: Bundle promozionali attività locali (sconti gruppi, partner)
- P2: Stati temporanei sincronizzati nella chat pubblica (badge accanto nickname)
- P2: Multi-hotel per admin
- P2: FastAPI lifespan migration (deprecazione `@app.on_event`)

## Next Tasks
1. Group chats
2. Stripe real payment
3. Local-partner bundles
4. iOS PWA install banner (Add to Home Screen)

## Feature update — 2026-02-12 — Welcome Coupon + Onboarding + Stays History

- **Welcome Coupon (auto)**: `/api/stays/join` now auto-emits a coupon when the hotel has `welcome_coupon_template_id`. Demo hotel `WELCOME2026` backfilled to "Caffè espresso ☕". Response includes `welcome_coupon` so the frontend toasts the gift name. Broadcast via WebSocket + push reaches `/app/coupons`.
- **Progressive Onboarding** (skippable): new component `OnboardingProfile.jsx` triggered after first email register (localStorage flag `chathel_onboarding_pending`). Captures photo URL + bio via `PATCH /auth/profile`. Google sign-in returns `is_new=true` to drive the same gate.
- **Stays History page**: `GET /api/stays/history` (joined with hotel names). New route `/app/profile/history` with `StaysHistory.jsx`. Teaser card on `/app/profile` shows "Sei stato in N hotel" linking to the page.

### Verified
- 7/7 backend tests passing (iteration_4.json), frontend E2E verified via Playwright by testing agent.

### Deferred (P1 backlog)
- Add a User-auth `/api/coupons` endpoint to list coupons by `recipient_id = stay.id` for historical lookup.
- Real image upload via object storage to replace photo URL string (today: any public URL or pravatar suggestion).
- Real Stripe payments for paid coupons (currently mock).

## Feature update — 2026-02-12 — Settings (User + Hotel)

### User Settings (`/app/settings`)
- Install PWA (beforeinstallprompt + iOS fallback message)
- Push notifications toggle (subscribe/unsubscribe + send test)
- Lingua (LanguageSwitcher)
- Profilo (name, photo URL, bio) → PATCH /auth/profile
- Cambio password → POST /auth/change-password
- Elimina account (soft-delete) → POST /auth/delete-account (anonymises email/name/photo/bio, hashes nothing, ends sessions, closes active stays, removes push_subs)
- Reachable via header icon + Profile panel card.

### Admin Settings tab (`/admin/dashboard`)
- Hotel anagrafica (nome, codice di accesso, lingua di default) — PATCH /admin/hotel
- Branding (logo URL, brand color) — PATCH /admin/hotel
- AI Concierge prompt (max 4000 chars) — PATCH /admin/hotel
- Welcome coupon (template scelto + messaggio personalizzato) — PATCH /admin/hotel
- Cambio password admin — POST /admin/change-password
- Inline edit dialog (AdminEditDialog) for events / aree / coupon templates → PATCH /admin/{events,areas,coupon-templates}/{id}

### Verified
- testing_agent_v3 iteration_5 → 13/13 backend tests PASS, complete UI flow validated.

### Known notes (deferred)
- server.py at 1635 lines — refactor into modules after next major feature.
- admin_password still plaintext in Hotel doc (pre-existing). Should bcrypt before any production launch.
- Admin uses `X-Admin-Token` while users use `Authorization: Bearer` — works fine but worth unifying later.

## Feature update — 2026-02-12 — Branding + PWA + Push wiring (iter-6)
- Service worker now registered at app boot inside GuestApp (was only registered on PushPrompt mount).
- /api/auth/me and /api/guest/me return hotel.logo_url / brand_color / default_language.
- Guest header renders the hotel logo when set and tints the hotel name + bottom border with brand_color.
- push_subscribe persists user_id (lets soft-delete clear stale subs).
- meta theme-color resets to ChatHel default when hotel has no brand color.
- testing_agent_v3 iter-6 → 8/8 backend + full UI verification.
