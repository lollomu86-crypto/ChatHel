# ChatHel — PRD & Status

## Problem Statement (originale)
ChatHel: piattaforma chiusa per ospiti di hotel. Accesso tramite codice/QR + nickname. Rete temporanea, sicura, riservata. Funzioni: chat reception, chat pubblica, chat privata, bacheca eventi, aree comuni con prenotazione, concierge AI, status temporanei. Dashboard hotel per gestione eventi/aree/ospiti. Linguaggio: italiano. Stile: moderno/giovane.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Auth a session token (X-Guest-Token, X-Admin-Token). LLM via emergentintegrations (OpenAI GPT-5.2) usando EMERGENT_LLM_KEY.
- **Frontend**: React + React Router + Tailwind + Shadcn + Sonner toasts. Polling 3s per chat. Stile neo-brutalist.
- **Demo hotel** auto-seeded: code `WELCOME2026`, admin pw `admin123`. 4 aree + 3 eventi.

## User Personas
1. **Ospite**: vuole conoscere altri ospiti, chiedere info veloci, prenotare aree, partecipare a eventi.
2. **Hotel staff (admin)**: pubblica eventi, gestisce aree, risponde alla reception, fa check-out.

## Core Requirements (statici)
- Accesso QR/codice + nickname (no registrazione permanente).
- Chat reception (umana), chat pubblica, chat privata 1-to-1, chat AI concierge.
- Bacheca eventi, lista aree con prenotazione.
- Dashboard hotel: CRUD eventi/aree, lista ospiti con check-out, thread reception.
- Logout automatico (manuale) al check-out.

## Implementato (2026-02 → 2026-06)
- [v1.0 - 2026-06-11] MVP completo con tutte le funzioni core + AI concierge + admin dashboard. Testing: 100% pass su backend e frontend.
- [v1.1 - 2026-06-11] Rebrand visivo: logo brand integrato in tutte le pagine, palette aggiornata da rosso a blu royal (#1E40E0) + navy (#0B2978), favicon e titolo browser. Padding bottom-nav fix.

## P0/P1 Backlog (deferred)
- **P1**: Stato temporaneo richiamabile da Public chat (badge accanto al nickname).
- **P1**: WebSocket real-time invece di polling 3s.
- **P1**: Notifiche push (PWA) per messaggi reception/eventi.
- **P2**: Coupon regalo acquistabili.
- **P2**: Domanda del giorno (rompighiaccio automatico).
- **P2**: Chat di gruppo (es. "gruppo piscina").
- **P2**: Sfide nella chat pubblica (ping pong, biliardo).
- **P2**: Bundle promozionali attività locali.
- **P2**: QR scan vero (camera) per onboarding più rapido.
- **P2**: Multi-hotel admin (gestire più strutture da un account).

## Next Tasks
1. Real-time via WebSocket
2. Auth Emergent Google opzionale per admin
3. Notifiche push
