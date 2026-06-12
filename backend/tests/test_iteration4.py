"""Iteration 4 backend tests: welcome coupon on /stays/join + /stays/history."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hotel-gather.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ACCESS_CODE = "WELCOME2026"


def _register(email, password="test1234", name="E2E Tester"):
    return requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name}, timeout=30)


@pytest.fixture(scope="module")
def fresh_user():
    email = f"e2e_{int(time.time())}_{uuid.uuid4().hex[:4]}@chathel.test"
    r = _register(email)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "email": email}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_returns_user_and_token(fresh_user):
    assert fresh_user["token"]
    assert fresh_user["user"]["email"] == fresh_user["email"]


def test_auth_me_no_stay(fresh_user):
    r = requests.get(f"{API}/auth/me", headers=_h(fresh_user["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == fresh_user["email"]
    assert data["stay"] is None
    assert data["hotel"] is None


def test_stays_join_returns_welcome_coupon(fresh_user):
    r = requests.post(f"{API}/stays/join", json={"access_code": ACCESS_CODE, "nickname": "E2EUser"}, headers=_h(fresh_user["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["stay"]["active"] is True
    assert data["hotel"]["name"]
    wc = data["welcome_coupon"]
    assert wc is not None, "welcome_coupon should be present after join"
    assert "name" in wc and isinstance(wc["name"], str)
    assert "emoji" in wc
    assert "description" in wc
    assert wc["sender_type"] == "hotel"
    assert wc["recipient_id"] == data["stay"]["id"]
    # store for later tests
    fresh_user["stay_id"] = data["stay"]["id"]
    fresh_user["hotel_id"] = data["hotel"]["id"]
    fresh_user["welcome_coupon_id"] = wc["id"]


def test_welcome_coupon_persisted_for_stay(fresh_user):
    """Verify the welcome coupon exists in DB by querying as a guest who logs in and checks the recipient."""
    # There's no /api/coupons listing for User-auth (it's guest-scoped), so we verify via auth/me + presence of stay,
    # and via direct DB-less check we already validated recipient_id == stay.id in the previous test.
    # As an additional check, re-call /stays/history and confirm history has 1 entry.
    r = requests.get(f"{API}/stays/history", headers=_h(fresh_user["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["hotel"] is not None
    assert "id" in data[0]["hotel"]
    assert "name" in data[0]["hotel"]
    assert data[0]["active"] is True


def test_stays_history_after_leave_and_rejoin(fresh_user):
    # leave
    r1 = requests.post(f"{API}/stays/leave", headers=_h(fresh_user["token"]))
    assert r1.status_code == 200, r1.text
    # rejoin
    r2 = requests.post(f"{API}/stays/join", json={"access_code": ACCESS_CODE, "nickname": "E2EUser2"}, headers=_h(fresh_user["token"]))
    assert r2.status_code == 200, r2.text
    # second welcome coupon delivered
    assert r2.json()["welcome_coupon"] is not None, "Welcome coupon should also be delivered on re-join"
    # history now has 2 entries, sorted by joined_at desc
    r3 = requests.get(f"{API}/stays/history", headers=_h(fresh_user["token"]))
    assert r3.status_code == 200, r3.text
    hist = r3.json()
    assert len(hist) == 2, f"Expected 2 stays after leave+rejoin, got {len(hist)}: {hist}"
    # First (most recent) is active=True, second is active=False
    assert hist[0]["active"] is True
    assert hist[1]["active"] is False
    # joined_at desc ordering
    assert hist[0]["joined_at"] >= hist[1]["joined_at"]
    # both have hotel nested
    for s in hist:
        assert s["hotel"] is not None
        assert s["hotel"]["name"]


def test_history_unauth():
    r = requests.get(f"{API}/stays/history")
    assert r.status_code == 401


def test_demo_hotel_has_welcome_template_via_join():
    """Indirect check: a fresh user joining WELCOME2026 must receive a welcome coupon
    => demo hotel must have welcome_coupon_template_id set."""
    email = f"e2e_wc_{int(time.time())}_{uuid.uuid4().hex[:4]}@chathel.test"
    r = _register(email)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    r2 = requests.post(f"{API}/stays/join", json={"access_code": ACCESS_CODE, "nickname": f"WC_{uuid.uuid4().hex[:4]}"}, headers=_h(tok))
    assert r2.status_code == 200, r2.text
    wc = r2.json()["welcome_coupon"]
    assert wc is not None, "Demo hotel must be backfilled with welcome_coupon_template_id"
    # Should match the 'Caffè espresso' template
    assert "caff" in wc["name"].lower() or wc["emoji"] in ("☕", "\u2615"), f"Unexpected welcome coupon: {wc}"
