import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hotel-gather.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ACCESS_CODE = "WELCOME2026"
ADMIN_PWD = "admin123"


def _login_guest(nick):
    r = requests.post(f"{API}/guest/login", json={"access_code": ACCESS_CODE, "nickname": nick}, timeout=30)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"access_code": ACCESS_CODE, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def guest_a():
    nick = f"TEST_A_{int(time.time())}"
    r = _login_guest(nick)
    assert r.status_code == 200, r.text
    return r.json()["guest"]


@pytest.fixture(scope="module")
def guest_b():
    nick = f"TEST_B_{int(time.time())}"
    r = _login_guest(nick)
    assert r.status_code == 200, r.text
    return r.json()["guest"]


# ===== Health =====
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ===== Guest Auth =====
def test_guest_login_invalid_code():
    r = requests.post(f"{API}/guest/login", json={"access_code": "WRONG", "nickname": "Mario"})
    assert r.status_code == 404


def test_guest_login_short_nick():
    r = requests.post(f"{API}/guest/login", json={"access_code": ACCESS_CODE, "nickname": "M"})
    assert r.status_code == 400


def test_guest_login_duplicate(guest_a):
    r = _login_guest(guest_a["nickname"])
    assert r.status_code == 409


def test_guest_me(guest_a):
    r = requests.get(f"{API}/guest/me", headers={"X-Guest-Token": guest_a["session_token"]})
    assert r.status_code == 200
    assert r.json()["guest"]["nickname"] == guest_a["nickname"]
    assert r.json()["hotel"]["name"]


def test_guest_status_update(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.post(f"{API}/guest/status", json={"status_text": "In piscina"}, headers=h)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/guest/me", headers=h)
    assert r2.json()["guest"]["status_text"] == "In piscina"


# ===== Events / Areas =====
def test_events_seeded(guest_a):
    r = requests.get(f"{API}/events", headers={"X-Guest-Token": guest_a["session_token"]})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 3


def test_areas_seeded(guest_a):
    r = requests.get(f"{API}/areas", headers={"X-Guest-Token": guest_a["session_token"]})
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 4
    assert all("image_url" in a for a in data)


def test_book_area(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    areas = requests.get(f"{API}/areas", headers=h).json()
    area_id = areas[0]["id"]
    r = requests.post(f"{API}/areas/{area_id}/book", json={"slot": "Oggi 18:00"}, headers=h)
    assert r.status_code == 200
    assert r.json()["slot"] == "Oggi 18:00"


# ===== Messages =====
def test_public_message(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    txt = f"Ciao TEST_{int(time.time())}"
    r = requests.post(f"{API}/messages", json={"channel": "public", "content": txt}, headers=h)
    assert r.status_code == 200
    msgs = requests.get(f"{API}/messages/public", headers=h).json()
    assert any(m["content"] == txt for m in msgs)


def test_private_isolation(guest_a, guest_b):
    ha = {"X-Guest-Token": guest_a["session_token"]}
    hb = {"X-Guest-Token": guest_b["session_token"]}
    # A -> B
    requests.post(f"{API}/messages", json={"channel": "private", "content": "hi B", "recipient_id": guest_b["id"]}, headers=ha)
    # third guest should not see this
    nick_c = f"TEST_C_{int(time.time())}"
    gc = _login_guest(nick_c).json()["guest"]
    hc = {"X-Guest-Token": gc["session_token"]}
    msgs_c = requests.get(f"{API}/messages/private/{guest_a['id']}", headers=hc).json()
    assert all(m["content"] != "hi B" for m in msgs_c)
    # B sees the message
    msgs_b = requests.get(f"{API}/messages/private/{guest_a['id']}", headers=hb).json()
    assert any(m["content"] == "hi B" for m in msgs_b)


def test_reception_flow(guest_a, admin_token):
    h = {"X-Guest-Token": guest_a["session_token"]}
    ha = {"X-Admin-Token": admin_token}
    requests.post(f"{API}/messages", json={"channel": "reception", "content": "Serve aiuto TEST"}, headers=h)
    threads = requests.get(f"{API}/admin/reception/threads", headers=ha).json()
    assert any(t["guest_id"] == guest_a["id"] for t in threads)
    # admin reply
    requests.post(f"{API}/admin/reception/{guest_a['id']}", json={"channel": "reception", "content": "Arrivo subito"}, headers=ha)
    msgs = requests.get(f"{API}/messages/reception", headers=h).json()
    assert any(m["content"] == "Arrivo subito" and m["sender_role"] == "reception" for m in msgs)


def test_ai_message(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.post(f"{API}/messages", json={"channel": "ai", "content": "A che ora apre la piscina?"}, headers=h, timeout=60)
    assert r.status_code == 200
    time.sleep(2)
    msgs = requests.get(f"{API}/messages/ai", headers=h).json()
    ai_replies = [m for m in msgs if m["sender_role"] == "ai"]
    assert len(ai_replies) >= 1, f"No AI reply. Messages: {msgs}"


# ===== Admin =====
def test_admin_login_wrong():
    r = requests.post(f"{API}/admin/login", json={"access_code": ACCESS_CODE, "password": "wrong"})
    assert r.status_code == 401


def test_admin_create_event(admin_token):
    ha = {"X-Admin-Token": admin_token}
    r = requests.post(f"{API}/admin/events", json={"title": "TEST_Event", "description": "d", "event_time": "Oggi 22:00"}, headers=ha)
    assert r.status_code == 200
    eid = r.json()["id"]
    events = requests.get(f"{API}/admin/events", headers=ha).json()
    assert any(e["id"] == eid for e in events)
    # cleanup
    requests.delete(f"{API}/admin/events/{eid}", headers=ha)


def test_admin_create_area(admin_token):
    ha = {"X-Admin-Token": admin_token}
    r = requests.post(f"{API}/admin/areas", json={"name": "TEST_Area", "description": "d"}, headers=ha)
    assert r.status_code == 200
    aid = r.json()["id"]
    requests.delete(f"{API}/admin/areas/{aid}", headers=ha)


def test_admin_checkout_invalidates_session(admin_token):
    # create a fresh guest, then admin checkout, verify session invalid
    nick = f"TEST_CO_{int(time.time())}"
    g = _login_guest(nick).json()["guest"]
    h = {"X-Guest-Token": g["session_token"]}
    assert requests.get(f"{API}/guest/me", headers=h).status_code == 200
    ha = {"X-Admin-Token": admin_token}
    r = requests.post(f"{API}/admin/guests/{g['id']}/checkout", headers=ha)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/guest/me", headers=h)
    assert r2.status_code == 401
