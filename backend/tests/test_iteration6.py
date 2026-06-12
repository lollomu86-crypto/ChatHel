"""Iteration 6 — Hotel branding plumbed end-to-end + push subscription user_id.

Covers:
- PATCH /api/admin/hotel branding (logo_url + brand_color, '#'-prefix validation)
- GET /api/auth/me returns hotel.logo_url / brand_color / default_language
- GET /api/guest/me returns same fields (via Bearer user token)
- GET /api/push/vapid-public-key returns non-empty key
- POST /api/push/subscribe with Bearer persists user_id, and /auth/delete-account clears push_subs
- Regression: /api/stays/join still delivers welcome coupon; legacy /guest/login push
  subscribe / push test still respond 200 with X-Guest-Token.
- Teardown: restores brand_color + logo_url to empty (None) for next iteration.
"""
import os
import time
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN_CODE = "WELCOME2026"
ADMIN_PWD = "admin123"

BRAND_COLOR = "#0EA5E9"
LOGO_URL = "https://placehold.co/200x200/0EA5E9/white?text=H"


def _ts():
    return int(time.time() * 1000)


def _ah(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ----------------- shared fixtures -----------------

@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login",
                      json={"access_code": ADMIN_CODE, "password": ADMIN_PWD},
                      timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token, "Content-Type": "application/json"}


@pytest.fixture(scope="session", autouse=True)
def apply_branding_and_restore(admin_headers):
    """Set branding before tests, then restore at end of session."""
    # Capture original
    r = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10)
    assert r.status_code == 200
    original = r.json().get("hotel", {})

    # Set branding
    r = requests.patch(f"{API}/admin/hotel",
                       json={"brand_color": BRAND_COLOR, "logo_url": LOGO_URL},
                       headers=admin_headers, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["brand_color"] == BRAND_COLOR
    assert body["logo_url"] == LOGO_URL

    yield

    # Restore — clear by sending empty string (server converts to None)
    requests.patch(f"{API}/admin/hotel",
                   json={"brand_color": "", "logo_url": ""},
                   headers=admin_headers, timeout=10)


def _register_and_join():
    """Register a fresh user, join the demo hotel; return (email, pwd, token, user, join_body)."""
    email = f"vis_{_ts()}_{uuid.uuid4().hex[:6]}@chathel.test"
    pwd = "abc12345"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": pwd, "name": "Visitor"},
                      timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    tok = body["token"]
    r2 = requests.post(f"{API}/stays/join",
                       json={"access_code": ADMIN_CODE, "nickname": f"Vis{_ts()%10000}"},
                       headers=_ah(tok), timeout=15)
    assert r2.status_code == 200, r2.text
    return email, pwd, tok, body["user"], r2.json()


# ----------------- Branding on /auth/me + /guest/me -----------------

class TestBrandingExposure:
    def test_auth_me_returns_branding(self):
        _, _, tok, _, _ = _register_and_join()
        r = requests.get(f"{API}/auth/me", headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["hotel"] is not None, "hotel object should be present after join"
        h = data["hotel"]
        assert h.get("brand_color") == BRAND_COLOR, f"brand_color mismatch: {h}"
        assert h.get("logo_url") == LOGO_URL, f"logo_url mismatch: {h}"
        assert h.get("default_language") in ("it", None) or isinstance(h.get("default_language"), str)
        # Sanity
        assert h.get("name")
        assert h.get("id")

    def test_guest_me_returns_branding_via_bearer(self):
        _, _, tok, _, _ = _register_and_join()
        r = requests.get(f"{API}/guest/me", headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["hotel"] is not None
        h = data["hotel"]
        assert h["brand_color"] == BRAND_COLOR
        assert h["logo_url"] == LOGO_URL
        assert "default_language" in h
        assert "welcome_coupon_template_id" in h  # may be None


# ----------------- VAPID + Push subscribe + soft-delete cleanup -----------------

class TestPushAndSoftDelete:
    def test_vapid_public_key_returned(self):
        r = requests.get(f"{API}/push/vapid-public-key", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "public_key" in body
        assert isinstance(body["public_key"], str)
        assert len(body["public_key"]) > 0, "VAPID public_key is empty"

    def test_push_subscribe_stores_user_id_and_soft_delete_clears(self, mongo_db):
        _, _, tok, user, _ = _register_and_join()
        endpoint = f"https://example.com/push/{uuid.uuid4().hex}"
        sub = {
            "endpoint": endpoint,
            "keys": {"p256dh": "BFAKEpubkey", "auth": "FAKEauth"},
        }
        r = requests.post(f"{API}/push/subscribe",
                          json={"subscription": sub},
                          headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text

        # Verify user_id persisted (direct mongo read)
        doc = mongo_db.push_subs.find_one({"endpoint": endpoint})
        assert doc is not None, "push_subs doc missing"
        assert doc.get("user_id") == user["user_id"], f"user_id not persisted: {doc}"
        assert doc.get("guest_id"), "guest_id should also be present"

        # Soft-delete account -> push_subs for user_id should be wiped
        rd = requests.post(f"{API}/auth/delete-account", headers=_ah(tok), timeout=10)
        assert rd.status_code == 200, rd.text
        remaining = mongo_db.push_subs.find_one({"user_id": user["user_id"]})
        assert remaining is None, f"push_subs should be cleared after soft-delete, got: {remaining}"

        # Token now invalid
        r2 = requests.get(f"{API}/auth/me", headers=_ah(tok), timeout=10)
        assert r2.status_code in (401, 403)


# ----------------- Admin branding validation + roundtrip -----------------

class TestAdminBrandingPatch:
    def test_brand_color_must_start_with_hash(self, admin_headers):
        r = requests.patch(f"{API}/admin/hotel",
                           json={"brand_color": "blue"},
                           headers=admin_headers, timeout=10)
        assert r.status_code == 400, r.text

    def test_admin_me_reflects_updated_branding(self, admin_headers):
        # fixture has already PATCHed the branding to BRAND_COLOR / LOGO_URL
        r = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        h = r.json()["hotel"]
        assert h["brand_color"] == BRAND_COLOR
        assert h["logo_url"] == LOGO_URL


# ----------------- Regression: legacy guest join + welcome coupon -----------------

class TestRegressionWelcomeCoupon:
    def test_stays_join_delivers_welcome_coupon_when_template_set(self, admin_headers):
        # Create a coupon template
        tpl_payload = {
            "name": "TEST_WC_iter6",
            "description": "iter6 wc",
            "emoji": "🥂",
            "category": "drink",
            "price_cents": 500,
            "currency": "EUR",
        }
        rt = requests.post(f"{API}/admin/coupon-templates",
                           json=tpl_payload, headers=admin_headers, timeout=10)
        if rt.status_code != 200:
            pytest.skip(f"Cannot create coupon template: {rt.status_code} {rt.text}")
        tpl_id = rt.json()["id"]

        # Save previous welcome template id to restore later
        prev = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10).json()["hotel"]
        prev_wid = prev.get("welcome_coupon_template_id") or ""
        try:
            # Set welcome template
            rs = requests.patch(f"{API}/admin/hotel",
                                json={"welcome_coupon_template_id": tpl_id},
                                headers=admin_headers, timeout=10)
            assert rs.status_code == 200, rs.text

            # Register + join — expect welcome_coupon != None
            _, _, tok, _, join_body = _register_and_join()
            assert join_body.get("welcome_coupon"), f"welcome_coupon missing on /stays/join: {join_body}"
            assert join_body["welcome_coupon"]["template_id"] == tpl_id
        finally:
            # Restore prev welcome template + delete template
            requests.patch(f"{API}/admin/hotel",
                           json={"welcome_coupon_template_id": prev_wid},
                           headers=admin_headers, timeout=10)
            requests.delete(f"{API}/admin/coupon-templates/{tpl_id}",
                            headers=admin_headers, timeout=10)


# ----------------- Regression: legacy /guest/login + push -----------------

class TestRegressionLegacyGuestPush:
    def test_legacy_guest_can_subscribe_and_test_push(self):
        nick = f"GTest{_ts()%10000}"
        r = requests.post(f"{API}/guest/login",
                          json={"access_code": ADMIN_CODE, "nickname": nick},
                          timeout=10)
        assert r.status_code == 200, r.text
        guest = r.json()["guest"]
        gtok = guest["session_token"]
        headers = {"X-Guest-Token": gtok, "Content-Type": "application/json"}

        # subscribe
        endpoint = f"https://example.com/legacy/{uuid.uuid4().hex}"
        rs = requests.post(f"{API}/push/subscribe",
                           json={"subscription": {"endpoint": endpoint, "keys": {"p256dh": "x", "auth": "y"}}},
                           headers=headers, timeout=10)
        assert rs.status_code == 200, rs.text

        # push test (no actual delivery — backend should respond 200 regardless of VAPID config)
        rt = requests.post(f"{API}/push/test", headers=headers, timeout=15)
        assert rt.status_code == 200, rt.text

        # cleanup: logout
        requests.post(f"{API}/guest/logout", headers=headers, timeout=10)
