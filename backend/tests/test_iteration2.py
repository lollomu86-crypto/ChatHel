"""Iteration 2 backend tests: daily question, challenges, translate, coupons,
admin coupons, push (VAPID/subscribe), websocket realtime, AI lang override."""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

ACCESS_CODE = "WELCOME2026"
ADMIN_PWD = "admin123"


def _login(nick):
    return requests.post(f"{API}/guest/login", json={"access_code": ACCESS_CODE, "nickname": nick}, timeout=30)


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/admin/login", json={"access_code": ACCESS_CODE, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def guest_a():
    r = _login(f"TEST_IT2A_{uuid.uuid4().hex[:6]}")
    assert r.status_code == 200, r.text
    return r.json()["guest"]


@pytest.fixture(scope="module")
def guest_b():
    r = _login(f"TEST_IT2B_{uuid.uuid4().hex[:6]}")
    assert r.status_code == 200, r.text
    return r.json()["guest"]


# ---------------- Daily question ----------------
def test_daily_question(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.get(f"{API}/daily-question", headers=h)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "question" in d and isinstance(d["question"], str) and len(d["question"]) > 3
    assert "day" in d


# ---------------- Challenges ----------------
def test_challenge_flow(guest_a, guest_b):
    ha = {"X-Guest-Token": guest_a["session_token"]}
    hb = {"X-Guest-Token": guest_b["session_token"]}
    payload = {
        "channel": "public",
        "content": "Sfida a biliardo!",
        "kind": "challenge",
        "meta": {"type": "biliardo", "when": "tra 10 min", "status": "open"},
    }
    r = requests.post(f"{API}/messages", json=payload, headers=ha)
    assert r.status_code == 200, r.text
    msg = r.json()
    assert msg["kind"] == "challenge"
    assert msg["meta"]["status"] == "open"
    mid = msg["id"]

    # Self-accept -> 400
    r_self = requests.post(f"{API}/messages/{mid}/accept", headers=ha)
    assert r_self.status_code == 400, r_self.text

    # Other guest accepts -> 200
    r_acc = requests.post(f"{API}/messages/{mid}/accept", headers=hb)
    assert r_acc.status_code == 200, r_acc.text
    assert r_acc.json()["meta"]["status"] == "accepted"

    # Double-accept -> 409
    r2 = requests.post(f"{API}/messages/{mid}/accept", headers=hb)
    assert r2.status_code == 409


# ---------------- Translate ----------------
def test_translate(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.post(f"{API}/translate", json={"text": "Ciao, come stai?", "target_lang": "en"}, headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "text" in data or "translated" in data or "result" in data
    # Find translated text under any common key
    out = data.get("text") or data.get("translated") or data.get("result") or ""
    assert isinstance(out, str) and len(out) > 0


# ---------------- AI multilingual ----------------
def test_ai_french_reply(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"], "X-User-Lang": "fr"}
    r = requests.post(f"{API}/messages", json={"channel": "ai", "content": "A quelle heure ouvre la piscine ?"}, headers=h, timeout=60)
    assert r.status_code == 200, r.text
    # wait for AI reply to be stored
    time.sleep(6)
    msgs = requests.get(f"{API}/messages/ai", headers={"X-Guest-Token": guest_a["session_token"]}).json()
    ai_replies = [m for m in msgs if m.get("sender_role") == "ai"]
    assert len(ai_replies) >= 1
    last = ai_replies[-1]["content"].lower()
    # French heuristic
    french_markers = [" la ", " le ", " est", " des ", " du ", " pour ", " heure", " ouvre", "piscine", " à "]
    assert any(tok in f" {last} " for tok in french_markers), f"AI reply not French: {last}"


# ---------------- Coupon templates ----------------
def test_coupon_templates_seeded(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.get(f"{API}/coupon-templates", headers=h)
    assert r.status_code == 200
    tpls = r.json()
    assert len(tpls) >= 8, f"Expected >=8 templates, got {len(tpls)}"
    for t in tpls:
        assert "id" in t and "name" in t and "price_cents" in t


# ---------------- Coupon send / receive / redeem ----------------
def test_coupon_send_receive_redeem(guest_a, guest_b):
    ha = {"X-Guest-Token": guest_a["session_token"]}
    hb = {"X-Guest-Token": guest_b["session_token"]}
    tpls = requests.get(f"{API}/coupon-templates", headers=ha).json()
    tid = tpls[0]["id"]

    # Self-send -> 400
    r_self = requests.post(f"{API}/coupons", json={"template_id": tid, "recipient_id": guest_a["id"], "message": "self"}, headers=ha)
    assert r_self.status_code == 400, r_self.text

    # Nonexistent recipient -> 404
    r_nf = requests.post(f"{API}/coupons", json={"template_id": tid, "recipient_id": "nonexistent-id-xxx", "message": "x"}, headers=ha)
    assert r_nf.status_code == 404

    # A -> B
    r = requests.post(f"{API}/coupons", json={"template_id": tid, "recipient_id": guest_b["id"], "message": "TEST_GIFT"}, headers=ha)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["sender_type"] == "guest"
    assert c["status"] == "pending"
    assert c["recipient_id"] == guest_b["id"]
    cid = c["id"]

    # B sees in received
    received = requests.get(f"{API}/coupons/received", headers=hb).json()
    assert any(x["id"] == cid for x in received)
    # A sees in sent
    sent = requests.get(f"{API}/coupons/sent", headers=ha).json()
    assert any(x["id"] == cid for x in sent)

    # Sender cannot redeem
    r_sender_redeem = requests.post(f"{API}/coupons/{cid}/redeem", headers=ha)
    assert r_sender_redeem.status_code == 404  # because filter recipient_id != sender

    # Recipient redeems
    r_red = requests.post(f"{API}/coupons/{cid}/redeem", headers=hb)
    assert r_red.status_code == 200, r_red.text
    assert r_red.json()["status"] == "redeemed"
    # Double redeem
    r_red2 = requests.post(f"{API}/coupons/{cid}/redeem", headers=hb)
    assert r_red2.status_code == 409


# ---------------- Admin coupon templates / gift / redeem ----------------
def test_admin_coupon_template_and_gift(admin_token, guest_a):
    ha = {"X-Admin-Token": admin_token}
    # Create custom template
    body = {"name": "TEST_Custom", "description": "d", "emoji": "🍹", "category": "drink", "price_cents": 555, "currency": "EUR"}
    r = requests.post(f"{API}/admin/coupon-templates", json=body, headers=ha)
    assert r.status_code == 200, r.text
    tpl_id = r.json()["id"]
    # Appears in admin list
    tpls = requests.get(f"{API}/admin/coupon-templates", headers=ha).json()
    assert any(t["id"] == tpl_id for t in tpls)

    # Admin gifts to guest_a
    r2 = requests.post(f"{API}/admin/coupons", json={"template_id": tpl_id, "recipient_id": guest_a["id"], "message": "TEST_HOTEL_GIFT"}, headers=ha)
    assert r2.status_code == 200, r2.text
    c = r2.json()
    assert c["sender_type"] == "hotel"
    cid = c["id"]
    # admin redeem
    r3 = requests.post(f"{API}/admin/coupons/{cid}/redeem", headers=ha)
    assert r3.status_code == 200
    assert r3.json()["status"] == "redeemed"
    # cleanup template
    requests.delete(f"{API}/admin/coupon-templates/{tpl_id}", headers=ha)


# ---------------- Push (VAPID / subscribe) ----------------
def test_push_vapid_and_subscribe(guest_a):
    h = {"X-Guest-Token": guest_a["session_token"]}
    r = requests.get(f"{API}/push/vapid-public-key", headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    key = data.get("public_key") or data.get("key") or data.get("vapid_public_key") or ""
    assert isinstance(key, str) and len(key) > 20

    sub = {
        "endpoint": f"https://example.com/push/{uuid.uuid4().hex}",
        "keys": {"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
                  "auth": "tBHItJI5svbpez7KI4CCXg=="}
    }
    r2 = requests.post(f"{API}/push/subscribe", json={"subscription": sub}, headers=h)
    # Endpoint may accept either {subscription:{...}} or flat — try both shapes
    if r2.status_code >= 400:
        r2 = requests.post(f"{API}/push/subscribe", json=sub, headers=h)
    assert r2.status_code == 200, f"push subscribe failed: {r2.status_code} {r2.text}"


# ---------------- WebSocket realtime ----------------
@pytest.mark.asyncio
async def test_websocket_public_and_private(guest_a, guest_b):
    ws_a_url = f"{WS_URL}?token={guest_a['session_token']}&role=guest"
    ws_b_url = f"{WS_URL}?token={guest_b['session_token']}&role=guest"

    async with websockets.connect(ws_a_url) as ws_a, websockets.connect(ws_b_url) as ws_b:
        # Receive ready frames
        ready_a = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=5))
        ready_b = json.loads(await asyncio.wait_for(ws_b.recv(), timeout=5))
        assert ready_a.get("type") == "ready"
        assert ready_b.get("type") == "ready"

        # B sends a public message via HTTP
        marker = f"WS_PUBLIC_{uuid.uuid4().hex[:8]}"
        hb = {"X-Guest-Token": guest_b["session_token"]}
        requests.post(f"{API}/messages", json={"channel": "public", "content": marker}, headers=hb)

        # A should receive a push within 3s
        got = None
        deadline = time.time() + 4
        while time.time() < deadline:
            try:
                frame = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=deadline - time.time()))
            except asyncio.TimeoutError:
                break
            if frame.get("type") == "message" and (frame.get("message") or frame.get("data") or {}).get("content") == marker:
                got = frame
                break
        assert got is not None, "Public WS push not received by A"
        body = got.get("message") or got.get("data")
        assert body["channel"] == "public"

        # Private routing: B sends private msg to A, only A should receive
        marker2 = f"WS_PRIV_{uuid.uuid4().hex[:8]}"
        requests.post(f"{API}/messages", json={"channel": "private", "content": marker2, "recipient_id": guest_a["id"]}, headers=hb)
        got_priv = None
        deadline2 = time.time() + 4
        while time.time() < deadline2:
            try:
                frame = json.loads(await asyncio.wait_for(ws_a.recv(), timeout=deadline2 - time.time()))
            except asyncio.TimeoutError:
                break
            if frame.get("type") == "message" and (frame.get("message") or frame.get("data") or {}).get("content") == marker2:
                got_priv = frame
                break
        assert got_priv is not None, "Private WS push not received by recipient A"
        body_p = got_priv.get("message") or got_priv.get("data")
        assert body_p["channel"] == "private"
