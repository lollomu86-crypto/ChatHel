"""Iteration 5: User Settings + Hotel Settings backend coverage.

Covers:
- PATCH /api/auth/profile
- POST /api/auth/change-password (new pwd works, old pwd 401)
- POST /api/auth/delete-account (soft delete, token invalidated, login forbidden)
- PATCH /api/admin/hotel (name + brand_color + default_language + ai_prompt + welcome_coupon)
- POST /api/admin/change-password (round-trip and reset)
- PATCH /api/admin/events/{id}, /api/admin/areas/{id}, /api/admin/coupon-templates/{id}
- Welcome coupon delivered on /api/stays/join
- Legacy /api/sessions/join (regression) — Note: app uses /api/guest/login for legacy
"""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_CODE = "WELCOME2026"
ADMIN_PWD = "admin123"


# ----------------- helpers -----------------

def _ts():
    return int(time.time() * 1000)


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"access_code": ADMIN_CODE, "password": ADMIN_PWD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"X-Admin-Token": admin_token, "Content-Type": "application/json"}


def _register_fresh_user():
    email = f"set_{_ts()}@chathel.test"
    pwd = "test1234"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "Set Tester"}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    return email, pwd, body["token"], body["user"]


def _ah(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ----------------- USER SETTINGS -----------------

class TestUserProfileUpdate:
    def test_patch_profile_persists(self):
        email, pwd, tok, _ = _register_fresh_user()
        r = requests.patch(f"{API}/auth/profile", json={"name": "Nuovo Nome", "bio": "Una bio"}, headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "Nuovo Nome"
        assert data["bio"] == "Una bio"
        # GET /auth/me verifies persistence
        r2 = requests.get(f"{API}/auth/me", headers=_ah(tok), timeout=10)
        assert r2.status_code == 200
        assert r2.json()["user"]["name"] == "Nuovo Nome"
        assert r2.json()["user"]["bio"] == "Una bio"


class TestChangePassword:
    def test_change_pwd_then_login_with_new_and_fail_with_old(self):
        email, old, tok, _ = _register_fresh_user()
        new = "newpass9"
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": old, "new_password": new},
                          headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text
        # old should fail
        r_old = requests.post(f"{API}/auth/login", json={"email": email, "password": old}, timeout=10)
        assert r_old.status_code == 401
        # new should succeed
        r_new = requests.post(f"{API}/auth/login", json={"email": email, "password": new}, timeout=10)
        assert r_new.status_code == 200, r_new.text
        assert "token" in r_new.json()

    def test_change_pwd_with_wrong_current_fails(self):
        email, old, tok, _ = _register_fresh_user()
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "WRONG", "new_password": "abcdef"},
                          headers=_ah(tok), timeout=10)
        assert r.status_code == 400


class TestDeleteAccount:
    def test_soft_delete_invalidates_token_and_blocks_login(self):
        email, pwd, tok, user = _register_fresh_user()
        # Delete
        r = requests.post(f"{API}/auth/delete-account", headers=_ah(tok), timeout=10)
        assert r.status_code == 200, r.text
        # /auth/me with the same token should now be unauthorised (session deleted)
        r_me = requests.get(f"{API}/auth/me", headers=_ah(tok), timeout=10)
        assert r_me.status_code == 401
        # Login with old credentials should also fail (password_hash cleared & email anonymised)
        r_lo = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=10)
        assert r_lo.status_code == 401


# ----------------- ADMIN SETTINGS -----------------

class TestAdminHotelUpdate:
    def test_patch_hotel_name_branding_language_and_reset(self, admin_headers):
        # Capture current
        r0 = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10)
        assert r0.status_code == 200
        original_name = r0.json()["hotel"]["name"]
        # Update
        r = requests.patch(f"{API}/admin/hotel",
                          json={"name": "ChatHel Resort Updated", "brand_color": "#FF5733", "default_language": "en"},
                          headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "ChatHel Resort Updated"
        assert data["brand_color"] == "#FF5733"
        assert data["default_language"] == "en"
        # Verify via admin/me
        rme = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10)
        body = rme.json()["hotel"]
        assert body["name"] == "ChatHel Resort Updated"
        assert body["brand_color"] == "#FF5733"
        assert body["default_language"] == "en"
        # Reset (restore original name and clear brand color & lang)
        r2 = requests.patch(f"{API}/admin/hotel",
                            json={"name": original_name, "brand_color": "", "default_language": "it"},
                            headers=admin_headers, timeout=10)
        assert r2.status_code == 200

    def test_patch_ai_prompt(self, admin_headers):
        r0 = requests.get(f"{API}/admin/me", headers=admin_headers, timeout=10)
        original_prompt = r0.json()["hotel"].get("ai_prompt") or ""
        r = requests.patch(f"{API}/admin/hotel",
                           json={"ai_prompt": "Sei un concierge di prova."},
                           headers=admin_headers, timeout=10)
        assert r.status_code == 200, r.text
        assert "concierge di prova" in r.json()["ai_prompt"]
        # restore
        requests.patch(f"{API}/admin/hotel", json={"ai_prompt": original_prompt}, headers=admin_headers, timeout=10)

    def test_patch_invalid_brand_color(self, admin_headers):
        r = requests.patch(f"{API}/admin/hotel", json={"brand_color": "redx"}, headers=admin_headers, timeout=10)
        assert r.status_code == 400


class TestAdminChangePassword:
    def test_change_admin_pwd_round_trip(self):
        # login fresh to get token
        r0 = requests.post(f"{API}/admin/login", json={"access_code": ADMIN_CODE, "password": ADMIN_PWD}, timeout=10)
        assert r0.status_code == 200, r0.text
        tok = r0.json()["token"]
        new_pwd = "tempPass!23"
        r = requests.post(f"{API}/admin/change-password",
                          json={"current_password": ADMIN_PWD, "new_password": new_pwd},
                          headers={"X-Admin-Token": tok, "Content-Type": "application/json"}, timeout=10)
        assert r.status_code == 200, r.text
        # Login with new
        rn = requests.post(f"{API}/admin/login", json={"access_code": ADMIN_CODE, "password": new_pwd}, timeout=10)
        assert rn.status_code == 200
        tok2 = rn.json()["token"]
        # Login with old fails
        ro = requests.post(f"{API}/admin/login", json={"access_code": ADMIN_CODE, "password": ADMIN_PWD}, timeout=10)
        assert ro.status_code == 401
        # Restore
        rr = requests.post(f"{API}/admin/change-password",
                           json={"current_password": new_pwd, "new_password": ADMIN_PWD},
                           headers={"X-Admin-Token": tok2, "Content-Type": "application/json"}, timeout=10)
        assert rr.status_code == 200
        # Final sanity
        rf = requests.post(f"{API}/admin/login", json={"access_code": ADMIN_CODE, "password": ADMIN_PWD}, timeout=10)
        assert rf.status_code == 200


# ----------------- ADMIN EDIT EVENTS / AREAS / COUPON TEMPLATES -----------------

class TestAdminEditEntities:
    def test_patch_event(self, admin_headers):
        # Create then edit then delete
        c = requests.post(f"{API}/admin/events",
                          json={"title": "Test Evento", "description": "d", "event_time": "2099-01-01T10:00:00Z", "location": "Lobby"},
                          headers=admin_headers, timeout=10)
        assert c.status_code == 200, c.text
        eid = c.json()["id"]
        try:
            r = requests.patch(f"{API}/admin/events/{eid}", json={"title": "Test Evento Updated"},
                               headers=admin_headers, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["title"] == "Test Evento Updated"
        finally:
            requests.delete(f"{API}/admin/events/{eid}", headers=admin_headers, timeout=10)

    def test_patch_area(self, admin_headers):
        c = requests.post(f"{API}/admin/areas",
                          json={"name": "Test Area", "description": "d", "capacity": 5},
                          headers=admin_headers, timeout=10)
        assert c.status_code == 200, c.text
        aid = c.json()["id"]
        try:
            r = requests.patch(f"{API}/admin/areas/{aid}", json={"name": "Test Area Updated"},
                               headers=admin_headers, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["name"] == "Test Area Updated"
        finally:
            requests.delete(f"{API}/admin/areas/{aid}", headers=admin_headers, timeout=10)

    def test_patch_coupon_template(self, admin_headers):
        c = requests.post(f"{API}/admin/coupon-templates",
                          json={"name": "Test Tpl", "description": "old desc", "emoji": "🎁",
                                "category": "drink", "price_cents": 100},
                          headers=admin_headers, timeout=10)
        assert c.status_code == 200, c.text
        tid = c.json()["id"]
        try:
            r = requests.patch(f"{API}/admin/coupon-templates/{tid}",
                               json={"description": "new desc updated"},
                               headers=admin_headers, timeout=10)
            assert r.status_code == 200, r.text
            assert r.json()["description"] == "new desc updated"
        finally:
            requests.delete(f"{API}/admin/coupon-templates/{tid}", headers=admin_headers, timeout=10)


# ----------------- WELCOME COUPON REGRESSION -----------------

class TestWelcomeCouponOnJoin:
    def test_join_returns_welcome_coupon(self):
        # New user joins demo hotel — welcome coupon expected
        _, _, tok, _ = _register_fresh_user()
        r = requests.post(f"{API}/stays/join",
                          json={"access_code": ADMIN_CODE, "nickname": "WCTest"},
                          headers=_ah(tok), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("welcome_coupon") is not None, "welcome_coupon missing on join"
        assert "name" in body["welcome_coupon"]


# ----------------- LEGACY GUEST JOIN REGRESSION -----------------

class TestLegacyGuestJoin:
    def test_guest_login_legacy_still_works(self):
        nick = f"legacy_{_ts()}"
        r = requests.post(f"{API}/guest/login",
                          json={"access_code": ADMIN_CODE, "nickname": nick}, timeout=10)
        assert r.status_code == 200, r.text
        assert "session_token" in r.json() or "guest" in r.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
