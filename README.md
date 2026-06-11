# ChatHel 🏨

> The closed messaging network for hotel guests — chat, events, common-area bookings, AI concierge, gift coupons, and real-time multilingual support.

![Status](https://img.shields.io/badge/status-MVP-blue) ![React](https://img.shields.io/badge/React-19-61DAFB) ![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688) ![MongoDB](https://img.shields.io/badge/MongoDB-Motor-47A248)

ChatHel is a closed, temporary social network accessible only with a hotel access code. It connects guests with each other, with hotel staff (reception + AI concierge), and turns common areas into bookable, lively spaces.

## ✨ Features

- 🔑 **QR / code access** — guests join with a short code + nickname. No permanent account.
- 💬 **Multi-channel chat** — public guest chat, 1-to-1 private chat, reception desk, AI concierge (GPT-5.2).
- 🌍 **10 languages** with auto-detect + on-demand AI translation of any message.
- 📅 **Events board** & **bookable common areas** (pool, spa, lounge, games room).
- 🎁 **Gift coupons** — guests gift each other drinks/dinners; hotel can also send complimentary perks. Mock payment for demo.
- 🏆 **Icebreakers** — daily question + public-chat challenges (ping pong, pool, cards…) with accept flow.
- 📲 **Realtime via WebSocket** — message latency ~130 ms; polling fallback.
- 🛠 **Hotel admin dashboard** — manage events, areas, guests (check-out), coupon catalog, reception threads. Includes printable QR code for the lobby.

## 🧱 Stack

| Layer       | Tech                                                      |
|-------------|-----------------------------------------------------------|
| Backend     | FastAPI · Motor (async MongoDB) · WebSocket · emergentintegrations (GPT-5.2) |
| Frontend    | React · React Router · Tailwind · shadcn/ui · sonner · react-i18next · html5-qrcode · qrcode.react |
| Database    | MongoDB                                                   |
| AI          | OpenAI GPT-5.2 via Emergent Universal LLM Key             |

## 🚀 Local setup

### Prerequisites
- Node.js 20+, Yarn
- Python 3.11+, pip
- MongoDB running locally (`mongodb://localhost:27017`)

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/chathel.git
cd chathel
# Backend
cd backend
pip install -r requirements.txt
# Frontend
cd ../frontend
yarn install
```

### 2. Environment variables

**`backend/.env`** (NOT committed)
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="chathel"
CORS_ORIGINS="*"
EMERGENT_LLM_KEY=<your-emergent-llm-key>
```

**`frontend/.env`** (NOT committed)
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 3. Run

```bash
# terminal 1 - backend
cd backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# terminal 2 - frontend
cd frontend && yarn start
```

Open http://localhost:3000

### 4. Demo credentials (auto-seeded on first run)

- **Guest login**: hotel code `WELCOME2026` + any nickname
- **Admin login**: code `WELCOME2026` / password `admin123`

The seed creates a demo hotel "ChatHel Resort & Spa" with 4 areas, 3 events, 8 coupon templates.

## 📁 Project layout

```
.
├── backend/
│   ├── server.py            # FastAPI app (REST + WebSocket)
│   ├── requirements.txt
│   └── .env                 # local secrets (gitignored)
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/           # Landing, GuestLogin, GuestApp, AdminLogin, AdminDashboard
│   │   │   └── guest/       # HomeFeed, PublicChat, PrivateChat, ReceptionChat, AiChat, Coupons…
│   │   ├── components/      # Logo, QRScanner, LanguageSwitcher, ui/ (shadcn)
│   │   ├── i18n/            # 10 languages: it,en,es,fr,de,pt,nl,ru,zh,ja
│   │   └── lib/             # api.js, useChatSocket.js
│   └── package.json
└── memory/
    └── PRD.md               # product requirements & roadmap
```

## 🔌 Main API endpoints

| Method | Path                              | Notes                                      |
|--------|-----------------------------------|--------------------------------------------|
| POST   | `/api/guest/login`                | Code + nickname → session token            |
| POST   | `/api/admin/login`                | Code + password → admin token              |
| GET    | `/api/events` · `/api/areas`      | Hotel content                              |
| GET    | `/api/guests`                     | Active guests (excluding self)             |
| POST   | `/api/messages`                   | Send message (public / private / reception / ai / challenge) |
| POST   | `/api/messages/{id}/accept`       | Accept a challenge                         |
| POST   | `/api/translate`                  | On-demand AI translation                   |
| GET    | `/api/daily-question`             | Today's icebreaker                         |
| POST   | `/api/coupons`                    | Send a coupon (mock payment)               |
| POST   | `/api/coupons/{id}/redeem`        | Mark coupon as used                        |
| WS     | `/api/ws?token=…&role=guest`      | Realtime events                            |

## 🗺 Roadmap

- [x] Core MVP (guest auth, chat, events, areas, AI concierge, admin)
- [x] Logo rebrand + colour palette
- [x] Daily question icebreaker
- [x] Public-chat challenges (ping pong, pool, cards…)
- [x] QR scanner login (mobile camera)
- [x] WebSocket realtime + polling fallback
- [x] Gift coupons (guest & hotel) with mock payment
- [x] 10-language i18n + auto-translation
- [ ] Web Push notifications (PWA)
- [ ] Group chats ("pool group", "boat tour")
- [ ] Stripe real payment for coupons
- [ ] Local-partner activity bundles (boat tours, restaurants)

## 📄 License

MIT — see [LICENSE](LICENSE).

---

Built with ❤️ for modern hotels.
