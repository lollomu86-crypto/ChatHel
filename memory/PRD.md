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
