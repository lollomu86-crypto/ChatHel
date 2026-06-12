# Auth Testing Playbook (ChatHel)

## Endpoints
- POST /api/auth/register {email, password, name}
- POST /api/auth/login {email, password}
- GET  /api/auth/me (Bearer)
- POST /api/auth/google/session {session_id} — Emergent Google OAuth callback
- POST /api/auth/logout
- PATCH /api/auth/profile {name?, photo_url?, bio?}
- POST /api/stays/join {access_code}
- POST /api/stays/leave
- GET  /api/stays/current

## Demo
Email/password user: created via UI register. Google auth: redirect via auth.emergentagent.com.
Hotel demo code: WELCOME2026 (admin: admin123 — set via DEMO_ADMIN_PASSWORD env).

## MongoDB collections
- users { user_id, email, password_hash?, name, photo_url, bio, google_picture?, created_at }
- user_sessions { session_token, user_id, expires_at, created_at }
- stays { id, user_id, hotel_id, joined_at, left_at, active }

## Auth dep
get_current_guest now resolves user → active stay → hotel_id and synthesises a Guest-equivalent.
