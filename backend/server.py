from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Set
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ===== Models =====
class Hotel(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    access_code: str
    admin_password: str
    ai_prompt: str = "You are a friendly hotel reception assistant. Answer guest questions about the hotel services, hours, amenities, and local recommendations."
    created_at: str = Field(default_factory=now_iso)


class Guest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_id: str
    nickname: str
    session_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status_text: str = ""
    avatar_seed: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    active: bool = True
    checked_in_at: str = Field(default_factory=now_iso)
    last_seen: str = Field(default_factory=now_iso)


class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_id: str
    title: str
    description: str
    image_url: Optional[str] = None
    event_time: str
    location: str = ""
    created_at: str = Field(default_factory=now_iso)


class Area(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_id: str
    name: str
    description: str
    image_url: Optional[str] = None
    hours: str = "08:00 - 22:00"
    bookable: bool = True


class AreaBooking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    area_id: str
    hotel_id: str
    guest_id: str
    guest_nickname: str
    slot: str
    created_at: str = Field(default_factory=now_iso)


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_id: str
    channel: Literal["public", "reception", "private", "ai"]
    sender_id: str
    sender_nickname: str
    sender_role: Literal["guest", "reception", "ai"] = "guest"
    recipient_id: Optional[str] = None
    content: str
    kind: Literal["text", "challenge"] = "text"
    meta: Optional[dict] = None
    created_at: str = Field(default_factory=now_iso)


class CouponTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_id: str
    name: str
    description: str = ""
    emoji: str = "🎁"
    category: Literal["drink", "food", "spa", "activity", "other"] = "drink"
    price_cents: int
    currency: str = "EUR"
    is_seeded: bool = False


class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str = Field(default_factory=lambda: str(uuid.uuid4()).replace("-", "")[:8].upper())
    hotel_id: str
    template_id: Optional[str] = None
    name: str
    description: str = ""
    emoji: str = "🎁"
    category: str = "drink"
    price_cents: int
    currency: str = "EUR"
    sender_id: str
    sender_nickname: str
    sender_type: Literal["guest", "hotel"] = "guest"
    recipient_id: str
    recipient_nickname: str
    message: str = ""
    status: Literal["pending", "redeemed", "expired"] = "pending"
    created_at: str = Field(default_factory=now_iso)
    redeemed_at: Optional[str] = None


# ===== Request models =====
class GuestLoginReq(BaseModel):
    access_code: str
    nickname: str


class AdminLoginReq(BaseModel):
    access_code: str
    password: str


class StatusUpdateReq(BaseModel):
    status_text: str


class MessageCreateReq(BaseModel):
    channel: Literal["public", "reception", "private", "ai"]
    content: str
    recipient_id: Optional[str] = None
    kind: Literal["text", "challenge"] = "text"
    meta: Optional[dict] = None


class EventCreateReq(BaseModel):
    title: str
    description: str
    image_url: Optional[str] = None
    event_time: str
    location: str = ""


class AreaCreateReq(BaseModel):
    name: str
    description: str
    image_url: Optional[str] = None
    hours: str = "08:00 - 22:00"
    bookable: bool = True


class AreaBookingReq(BaseModel):
    slot: str


class CouponTemplateReq(BaseModel):
    name: str
    description: str = ""
    emoji: str = "🎁"
    category: Literal["drink", "food", "spa", "activity", "other"] = "drink"
    price_cents: int
    currency: str = "EUR"


class CouponSendReq(BaseModel):
    template_id: str
    recipient_id: str
    message: str = ""


class AdminCouponSendReq(BaseModel):
    template_id: str
    recipient_id: str
    message: str = ""


# ===== Auth deps =====
async def get_current_guest(x_guest_token: Optional[str] = Header(None)) -> Guest:
    if not x_guest_token:
        raise HTTPException(401, "Missing token")
    doc = await db.guests.find_one({"session_token": x_guest_token, "active": True}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "Invalid session")
    await db.guests.update_one({"id": doc["id"]}, {"$set": {"last_seen": now_iso()}})
    return Guest(**doc)


async def get_current_admin(x_admin_token: Optional[str] = Header(None)) -> Hotel:
    if not x_admin_token:
        raise HTTPException(401, "Missing admin token")
    sess = await db.admin_sessions.find_one({"token": x_admin_token}, {"_id": 0})
    if not sess:
        raise HTTPException(401, "Invalid admin session")
    hotel = await db.hotels.find_one({"id": sess["hotel_id"]}, {"_id": 0})
    if not hotel:
        raise HTTPException(401, "Hotel not found")
    return Hotel(**hotel)


# ===== Connection Manager (WebSocket) =====
class ConnectionManager:
    def __init__(self) -> None:
        self.guest_sockets: Dict[str, List[WebSocket]] = {}
        self.hotel_guests: Dict[str, Set[str]] = {}
        self.admin_sockets: Dict[str, List[WebSocket]] = {}

    async def connect_guest(self, guest_id: str, hotel_id: str, ws: WebSocket):
        self.guest_sockets.setdefault(guest_id, []).append(ws)
        self.hotel_guests.setdefault(hotel_id, set()).add(guest_id)

    def disconnect_guest(self, guest_id: str, hotel_id: str, ws: WebSocket):
        if guest_id in self.guest_sockets:
            try: self.guest_sockets[guest_id].remove(ws)
            except ValueError: pass
            if not self.guest_sockets[guest_id]:
                del self.guest_sockets[guest_id]
                if hotel_id in self.hotel_guests:
                    self.hotel_guests[hotel_id].discard(guest_id)

    async def connect_admin(self, hotel_id: str, ws: WebSocket):
        self.admin_sockets.setdefault(hotel_id, []).append(ws)

    def disconnect_admin(self, hotel_id: str, ws: WebSocket):
        if hotel_id in self.admin_sockets:
            try: self.admin_sockets[hotel_id].remove(ws)
            except ValueError: pass

    async def _safe_send(self, ws: WebSocket, data: dict):
        try: await ws.send_json(data)
        except Exception: pass

    async def send_to_guest(self, guest_id: str, data: dict):
        await asyncio.gather(*[self._safe_send(ws, data) for ws in list(self.guest_sockets.get(guest_id, []))])

    async def send_to_hotel_guests(self, hotel_id: str, data: dict, exclude: Optional[str] = None):
        targets = [gid for gid in list(self.hotel_guests.get(hotel_id, set())) if gid != exclude]
        await asyncio.gather(*[self.send_to_guest(gid, data) for gid in targets])

    async def send_to_admins(self, hotel_id: str, data: dict):
        await asyncio.gather(*[self._safe_send(ws, data) for ws in list(self.admin_sockets.get(hotel_id, []))])

    async def broadcast_message(self, msg: dict):
        hotel_id = msg["hotel_id"]
        channel = msg["channel"]
        payload = {"type": "message", "message": msg}
        if channel == "public":
            await self.send_to_hotel_guests(hotel_id, payload)
            await self.send_to_admins(hotel_id, payload)
        elif channel == "private":
            await self.send_to_guest(msg["sender_id"], payload)
            if msg.get("recipient_id"): await self.send_to_guest(msg["recipient_id"], payload)
        elif channel == "reception":
            if msg.get("sender_role") == "reception" and msg.get("recipient_id"):
                await self.send_to_guest(msg["recipient_id"], payload)
            else:
                await self.send_to_guest(msg["sender_id"], payload)
            await self.send_to_admins(hotel_id, payload)
        elif channel == "ai":
            await self.send_to_guest(msg["sender_id"], payload)
            if msg.get("recipient_id"): await self.send_to_guest(msg["recipient_id"], payload)

    async def broadcast_message_update(self, msg: dict):
        hotel_id = msg["hotel_id"]
        payload = {"type": "message_update", "message": msg}
        await self.send_to_hotel_guests(hotel_id, payload)
        await self.send_to_admins(hotel_id, payload)

    async def broadcast_coupon(self, coupon: dict, event: str = "coupon_received"):
        hotel_id = coupon["hotel_id"]
        payload = {"type": event, "coupon": coupon}
        await self.send_to_guest(coupon["recipient_id"], payload)
        if coupon["sender_type"] == "guest":
            await self.send_to_guest(coupon["sender_id"], payload)
        await self.send_to_admins(hotel_id, payload)

    async def broadcast_event_published(self, hotel_id: str, event: dict):
        payload = {"type": "event_published", "event": event}
        await self.send_to_hotel_guests(hotel_id, payload)


manager = ConnectionManager()


DAILY_QUESTIONS = [
    "Mare o montagna?",
    "Caffè o cappuccino al mattino?",
    "Cena fuori o aperitivo al tramonto?",
    "Spiaggia all'alba o tramonto in barca?",
    "Pizza o pasta?",
    "Spa o palestra?",
    "Libro o film prima di dormire?",
    "Estate o inverno?",
    "Città o campagna?",
    "Avventura o relax?",
    "Tè o tisana?",
    "Concerti o cinema?",
    "Mattiniero o nottambulo?",
    "Cucina italiana o internazionale?",
    "Hotel design o boutique storico?",
    "Mojito o spritz?",
    "Sushi o tapas?",
    "Yoga o running?",
    "Nuoto o trekking?",
    "Bici o moto?",
    "Vinile o playlist?",
    "Roma o Milano?",
    "Napoli o Palermo?",
    "Vino rosso o bianco?",
    "Dolce o salato a colazione?",
    "Maratona di serie TV o un libro?",
    "Viaggio organizzato o avventura libera?",
    "Foto col cellulare o reflex?",
    "Cena romantica o serata con amici?",
    "Brunch o aperitivo?",
]


# ===== Routes =====
@api_router.get("/")
async def root():
    return {"app": "ChatHel API", "status": "ok"}


# --- Guest auth ---
@api_router.post("/guest/login")
async def guest_login(req: GuestLoginReq):
    hotel = await db.hotels.find_one({"access_code": req.access_code.strip().upper()}, {"_id": 0})
    if not hotel:
        raise HTTPException(404, "Codice hotel non valido")
    nick = req.nickname.strip()
    if not nick or len(nick) < 2:
        raise HTTPException(400, "Nickname troppo corto")
    # check unique nickname per hotel among active guests
    existing = await db.guests.find_one({"hotel_id": hotel["id"], "nickname": nick, "active": True}, {"_id": 0})
    if existing:
        raise HTTPException(409, "Nickname già in uso in questo hotel")
    guest = Guest(hotel_id=hotel["id"], nickname=nick)
    await db.guests.insert_one(guest.model_dump())
    return {"guest": guest.model_dump(), "hotel": {"id": hotel["id"], "name": hotel["name"]}}


@api_router.post("/guest/logout")
async def guest_logout(guest: Guest = Depends(get_current_guest)):
    await db.guests.update_one({"id": guest.id}, {"$set": {"active": False, "checked_out_at": now_iso()}})
    return {"ok": True}


@api_router.get("/guest/me")
async def guest_me(guest: Guest = Depends(get_current_guest)):
    hotel = await db.hotels.find_one({"id": guest.hotel_id}, {"_id": 0})
    return {"guest": guest.model_dump(), "hotel": {"id": hotel["id"], "name": hotel["name"]} if hotel else None}


@api_router.post("/guest/status")
async def update_status(req: StatusUpdateReq, guest: Guest = Depends(get_current_guest)):
    await db.guests.update_one({"id": guest.id}, {"$set": {"status_text": req.status_text[:80]}})
    return {"ok": True}


@api_router.get("/guests")
async def list_guests(guest: Guest = Depends(get_current_guest)):
    docs = await db.guests.find({"hotel_id": guest.hotel_id, "active": True}, {"_id": 0, "session_token": 0}).to_list(500)
    return docs


# --- Daily question (rompighiaccio) ---
@api_router.get("/daily-question")
async def daily_question(guest: Guest = Depends(get_current_guest)):
    day = datetime.now(timezone.utc).timetuple().tm_yday
    q = DAILY_QUESTIONS[day % len(DAILY_QUESTIONS)]
    return {"question": q, "day": day}


# --- Events ---
@api_router.get("/events")
async def list_events(guest: Guest = Depends(get_current_guest)):
    docs = await db.events.find({"hotel_id": guest.hotel_id}, {"_id": 0}).sort("event_time", 1).to_list(200)
    return docs


# --- Areas ---
@api_router.get("/areas")
async def list_areas(guest: Guest = Depends(get_current_guest)):
    docs = await db.areas.find({"hotel_id": guest.hotel_id}, {"_id": 0}).to_list(200)
    return docs


@api_router.post("/areas/{area_id}/book")
async def book_area(area_id: str, req: AreaBookingReq, guest: Guest = Depends(get_current_guest)):
    area = await db.areas.find_one({"id": area_id, "hotel_id": guest.hotel_id}, {"_id": 0})
    if not area:
        raise HTTPException(404, "Area non trovata")
    booking = AreaBooking(area_id=area_id, hotel_id=guest.hotel_id, guest_id=guest.id,
                          guest_nickname=guest.nickname, slot=req.slot)
    await db.bookings.insert_one(booking.model_dump())
    return booking.model_dump()


@api_router.get("/areas/{area_id}/bookings")
async def area_bookings(area_id: str, guest: Guest = Depends(get_current_guest)):
    docs = await db.bookings.find({"area_id": area_id, "hotel_id": guest.hotel_id}, {"_id": 0}).to_list(200)
    return docs


# --- Messages ---
@api_router.get("/messages/public")
async def get_public(guest: Guest = Depends(get_current_guest)):
    docs = await db.messages.find({"hotel_id": guest.hotel_id, "channel": "public"}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@api_router.get("/messages/reception")
async def get_reception(guest: Guest = Depends(get_current_guest)):
    docs = await db.messages.find({
        "hotel_id": guest.hotel_id, "channel": "reception",
        "$or": [{"sender_id": guest.id}, {"recipient_id": guest.id}, {"sender_role": "reception"}]
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    # filter: only messages between this guest and reception staff
    filtered = [d for d in docs if d["sender_id"] == guest.id or d.get("recipient_id") == guest.id]
    return filtered


@api_router.get("/messages/ai")
async def get_ai(guest: Guest = Depends(get_current_guest)):
    docs = await db.messages.find({
        "hotel_id": guest.hotel_id, "channel": "ai", "sender_id": {"$in": [guest.id, "ai-bot"]},
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    # only this guest's conversation
    filtered = [d for d in docs if d["sender_id"] == guest.id or d.get("recipient_id") == guest.id]
    return filtered


@api_router.get("/messages/private/{other_id}")
async def get_private(other_id: str, guest: Guest = Depends(get_current_guest)):
    docs = await db.messages.find({
        "hotel_id": guest.hotel_id, "channel": "private",
        "$or": [
            {"sender_id": guest.id, "recipient_id": other_id},
            {"sender_id": other_id, "recipient_id": guest.id},
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@api_router.post("/messages")
async def send_message(req: MessageCreateReq, guest: Guest = Depends(get_current_guest)):
    content = req.content.strip()
    if not content:
        raise HTTPException(400, "Messaggio vuoto")
    msg = Message(
        hotel_id=guest.hotel_id,
        channel=req.channel,
        sender_id=guest.id,
        sender_nickname=guest.nickname,
        sender_role="guest",
        recipient_id=req.recipient_id,
        content=content[:2000],
        kind=req.kind,
        meta=req.meta,
    )
    await db.messages.insert_one(msg.model_dump())
    await manager.broadcast_message(msg.model_dump())

    # If channel is AI, generate response
    if req.channel == "ai":
        hotel = await db.hotels.find_one({"id": guest.hotel_id}, {"_id": 0})
        system_msg = (hotel.get("ai_prompt") if hotel else "") or "You are a helpful hotel concierge."
        try:
            llm = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"ai-{guest.id}",
                system_message=system_msg + " Rispondi nella lingua dell'ospite (di default in italiano). Sii breve e cordiale.",
            ).with_model("openai", "gpt-5.2")
            reply = await llm.send_message(UserMessage(text=content))
            ai_msg = Message(
                hotel_id=guest.hotel_id,
                channel="ai",
                sender_id="ai-bot",
                sender_nickname="Concierge AI",
                sender_role="ai",
                recipient_id=guest.id,
                content=str(reply),
            )
            await db.messages.insert_one(ai_msg.model_dump())
            await manager.broadcast_message(ai_msg.model_dump())
        except Exception as e:
            logger.exception("AI error")
            err_msg = Message(
                hotel_id=guest.hotel_id,
                channel="ai",
                sender_id="ai-bot",
                sender_nickname="Concierge AI",
                sender_role="ai",
                recipient_id=guest.id,
                content=f"Mi dispiace, sono temporaneamente non disponibile. ({type(e).__name__})",
            )
            await db.messages.insert_one(err_msg.model_dump())
            await manager.broadcast_message(err_msg.model_dump())

    return msg.model_dump()


@api_router.post("/messages/{message_id}/accept")
async def accept_challenge(message_id: str, guest: Guest = Depends(get_current_guest)):
    msg = await db.messages.find_one({"id": message_id, "hotel_id": guest.hotel_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Messaggio non trovato")
    if msg.get("kind") != "challenge":
        raise HTTPException(400, "Non è una sfida")
    if msg["sender_id"] == guest.id:
        raise HTTPException(400, "Non puoi accettare la tua sfida")
    meta = msg.get("meta") or {}
    if meta.get("status") == "accepted":
        raise HTTPException(409, "Sfida già accettata")
    meta["status"] = "accepted"
    meta["accepted_by"] = guest.id
    meta["accepted_nickname"] = guest.nickname
    meta["accepted_at"] = now_iso()
    await db.messages.update_one({"id": message_id}, {"$set": {"meta": meta}})
    updated = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if updated:
        await manager.broadcast_message_update(updated)
    return {"ok": True, "meta": meta}


# --- Admin auth ---
@api_router.post("/admin/login")
async def admin_login(req: AdminLoginReq):
    hotel = await db.hotels.find_one({"access_code": req.access_code.strip().upper()}, {"_id": 0})
    if not hotel or hotel["admin_password"] != req.password:
        raise HTTPException(401, "Credenziali non valide")
    token = str(uuid.uuid4())
    await db.admin_sessions.insert_one({"token": token, "hotel_id": hotel["id"], "created_at": now_iso()})
    return {"token": token, "hotel": {"id": hotel["id"], "name": hotel["name"], "access_code": hotel["access_code"]}}


@api_router.get("/admin/me")
async def admin_me(hotel: Hotel = Depends(get_current_admin)):
    return {"hotel": {"id": hotel.id, "name": hotel.name, "access_code": hotel.access_code, "ai_prompt": hotel.ai_prompt}}


@api_router.get("/admin/guests")
async def admin_guests(hotel: Hotel = Depends(get_current_admin)):
    docs = await db.guests.find({"hotel_id": hotel.id}, {"_id": 0, "session_token": 0}).sort("checked_in_at", -1).to_list(500)
    return docs


@api_router.post("/admin/guests/{guest_id}/checkout")
async def admin_checkout_guest(guest_id: str, hotel: Hotel = Depends(get_current_admin)):
    await db.guests.update_one({"id": guest_id, "hotel_id": hotel.id}, {"$set": {"active": False, "checked_out_at": now_iso()}})
    return {"ok": True}


# Admin events CRUD
@api_router.get("/admin/events")
async def admin_list_events(hotel: Hotel = Depends(get_current_admin)):
    docs = await db.events.find({"hotel_id": hotel.id}, {"_id": 0}).sort("event_time", 1).to_list(200)
    return docs


@api_router.post("/admin/events")
async def admin_create_event(req: EventCreateReq, hotel: Hotel = Depends(get_current_admin)):
    ev = Event(hotel_id=hotel.id, **req.model_dump())
    await db.events.insert_one(ev.model_dump())
    await manager.broadcast_event_published(hotel.id, ev.model_dump())
    return ev.model_dump()


@api_router.delete("/admin/events/{event_id}")
async def admin_delete_event(event_id: str, hotel: Hotel = Depends(get_current_admin)):
    await db.events.delete_one({"id": event_id, "hotel_id": hotel.id})
    return {"ok": True}


# Admin areas CRUD
@api_router.get("/admin/areas")
async def admin_list_areas(hotel: Hotel = Depends(get_current_admin)):
    docs = await db.areas.find({"hotel_id": hotel.id}, {"_id": 0}).to_list(200)
    return docs


@api_router.post("/admin/areas")
async def admin_create_area(req: AreaCreateReq, hotel: Hotel = Depends(get_current_admin)):
    a = Area(hotel_id=hotel.id, **req.model_dump())
    await db.areas.insert_one(a.model_dump())
    return a.model_dump()


@api_router.delete("/admin/areas/{area_id}")
async def admin_delete_area(area_id: str, hotel: Hotel = Depends(get_current_admin)):
    await db.areas.delete_one({"id": area_id, "hotel_id": hotel.id})
    return {"ok": True}


# Admin reception chat
@api_router.get("/admin/reception/threads")
async def admin_reception_threads(hotel: Hotel = Depends(get_current_admin)):
    """Return latest reception message per guest."""
    pipeline = [
        {"$match": {"hotel_id": hotel.id, "channel": "reception"}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$cond": [{"$eq": ["$sender_role", "reception"]}, "$recipient_id", "$sender_id"]},
            "last_message": {"$first": "$content"},
            "last_at": {"$first": "$created_at"},
            "last_role": {"$first": "$sender_role"},
        }},
        {"$sort": {"last_at": -1}},
    ]
    threads = []
    async for t in db.messages.aggregate(pipeline):
        guest_doc = await db.guests.find_one({"id": t["_id"]}, {"_id": 0, "session_token": 0})
        threads.append({
            "guest_id": t["_id"],
            "guest_nickname": guest_doc["nickname"] if guest_doc else "Ospite",
            "last_message": t["last_message"],
            "last_at": t["last_at"],
        })
    return threads


@api_router.get("/admin/reception/{guest_id}")
async def admin_reception_messages(guest_id: str, hotel: Hotel = Depends(get_current_admin)):
    docs = await db.messages.find({
        "hotel_id": hotel.id, "channel": "reception",
        "$or": [{"sender_id": guest_id}, {"recipient_id": guest_id}],
    }, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs


@api_router.post("/admin/reception/{guest_id}")
async def admin_reception_send(guest_id: str, req: MessageCreateReq, hotel: Hotel = Depends(get_current_admin)):
    g = await db.guests.find_one({"id": guest_id, "hotel_id": hotel.id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Ospite non trovato")
    msg = Message(
        hotel_id=hotel.id,
        channel="reception",
        sender_id="reception",
        sender_nickname="Reception",
        sender_role="reception",
        recipient_id=guest_id,
        content=req.content[:2000],
    )
    await db.messages.insert_one(msg.model_dump())
    await manager.broadcast_message(msg.model_dump())
    return msg.model_dump()


# --- Coupon templates & coupons (guest-facing) ---
@api_router.get("/coupon-templates")
async def list_coupon_templates(guest: Guest = Depends(get_current_guest)):
    docs = await db.coupon_templates.find({"hotel_id": guest.hotel_id}, {"_id": 0}).sort("price_cents", 1).to_list(200)
    return docs


@api_router.post("/coupons")
async def send_coupon(req: CouponSendReq, guest: Guest = Depends(get_current_guest)):
    tpl = await db.coupon_templates.find_one({"id": req.template_id, "hotel_id": guest.hotel_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Coupon non disponibile")
    rec = await db.guests.find_one({"id": req.recipient_id, "hotel_id": guest.hotel_id, "active": True}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Destinatario non trovato")
    if rec["id"] == guest.id:
        raise HTTPException(400, "Non puoi regalare un coupon a te stesso")
    coupon = Coupon(
        hotel_id=guest.hotel_id, template_id=tpl["id"],
        name=tpl["name"], description=tpl.get("description", ""), emoji=tpl.get("emoji", "🎁"),
        category=tpl.get("category", "drink"), price_cents=tpl["price_cents"], currency=tpl.get("currency", "EUR"),
        sender_id=guest.id, sender_nickname=guest.nickname, sender_type="guest",
        recipient_id=rec["id"], recipient_nickname=rec["nickname"],
        message=req.message[:200],
    )
    await db.coupons.insert_one(coupon.model_dump())
    await manager.broadcast_coupon(coupon.model_dump())
    return coupon.model_dump()


@api_router.get("/coupons/received")
async def coupons_received(guest: Guest = Depends(get_current_guest)):
    docs = await db.coupons.find({"hotel_id": guest.hotel_id, "recipient_id": guest.id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.get("/coupons/sent")
async def coupons_sent(guest: Guest = Depends(get_current_guest)):
    docs = await db.coupons.find({"hotel_id": guest.hotel_id, "sender_id": guest.id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/coupons/{coupon_id}/redeem")
async def redeem_coupon(coupon_id: str, guest: Guest = Depends(get_current_guest)):
    c = await db.coupons.find_one({"id": coupon_id, "hotel_id": guest.hotel_id, "recipient_id": guest.id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Coupon non trovato")
    if c["status"] != "pending":
        raise HTTPException(409, "Coupon già usato")
    await db.coupons.update_one({"id": coupon_id}, {"$set": {"status": "redeemed", "redeemed_at": now_iso()}})
    updated = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    await manager.broadcast_coupon(updated, event="coupon_updated")
    return updated


# --- Admin coupon templates & coupons ---
@api_router.get("/admin/coupon-templates")
async def admin_list_templates(hotel: Hotel = Depends(get_current_admin)):
    docs = await db.coupon_templates.find({"hotel_id": hotel.id}, {"_id": 0}).sort("price_cents", 1).to_list(200)
    return docs


@api_router.post("/admin/coupon-templates")
async def admin_create_template(req: CouponTemplateReq, hotel: Hotel = Depends(get_current_admin)):
    tpl = CouponTemplate(hotel_id=hotel.id, **req.model_dump())
    await db.coupon_templates.insert_one(tpl.model_dump())
    return tpl.model_dump()


@api_router.delete("/admin/coupon-templates/{template_id}")
async def admin_delete_template(template_id: str, hotel: Hotel = Depends(get_current_admin)):
    await db.coupon_templates.delete_one({"id": template_id, "hotel_id": hotel.id})
    return {"ok": True}


@api_router.post("/admin/coupons")
async def admin_send_coupon(req: AdminCouponSendReq, hotel: Hotel = Depends(get_current_admin)):
    tpl = await db.coupon_templates.find_one({"id": req.template_id, "hotel_id": hotel.id}, {"_id": 0})
    if not tpl:
        raise HTTPException(404, "Coupon non disponibile")
    rec = await db.guests.find_one({"id": req.recipient_id, "hotel_id": hotel.id, "active": True}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "Destinatario non trovato")
    coupon = Coupon(
        hotel_id=hotel.id, template_id=tpl["id"],
        name=tpl["name"], description=tpl.get("description", ""), emoji=tpl.get("emoji", "🎁"),
        category=tpl.get("category", "drink"), price_cents=tpl["price_cents"], currency=tpl.get("currency", "EUR"),
        sender_id="hotel", sender_nickname=hotel.name, sender_type="hotel",
        recipient_id=rec["id"], recipient_nickname=rec["nickname"],
        message=req.message[:200],
    )
    await db.coupons.insert_one(coupon.model_dump())
    await manager.broadcast_coupon(coupon.model_dump())
    return coupon.model_dump()


@api_router.get("/admin/coupons")
async def admin_list_coupons(hotel: Hotel = Depends(get_current_admin)):
    docs = await db.coupons.find({"hotel_id": hotel.id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api_router.post("/admin/coupons/{coupon_id}/redeem")
async def admin_redeem_coupon(coupon_id: str, hotel: Hotel = Depends(get_current_admin)):
    c = await db.coupons.find_one({"id": coupon_id, "hotel_id": hotel.id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Coupon non trovato")
    if c["status"] != "pending":
        raise HTTPException(409, "Coupon già usato")
    await db.coupons.update_one({"id": coupon_id}, {"$set": {"status": "redeemed", "redeemed_at": now_iso()}})
    updated = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    await manager.broadcast_coupon(updated, event="coupon_updated")
    return updated


@app.on_event("startup")
async def bootstrap():
    existing = await db.hotels.find_one({"access_code": "WELCOME2026"})
    if not existing:
        hotel = Hotel(
            name="ChatHel Resort & Spa",
            access_code="WELCOME2026",
            admin_password="admin123",
            ai_prompt=("Sei il concierge AI del ChatHel Resort & Spa, un boutique hotel moderno sulla costa italiana. "
                       "Servizi: piscina (8-22), spa (10-21), ristorante (12-15 / 19-23), palestra 24/7, navetta aeroporto. "
                       "Wifi: ChatHelGuest / pw: welcome2026. Check-out: 11:00. Rispondi in modo conciso e amichevole."),
        )
        await db.hotels.insert_one(hotel.model_dump())
        hotel_id = hotel.id
    else:
        hotel_id = existing["id"]

    # Seed areas if none
    if await db.areas.count_documents({"hotel_id": hotel_id}) == 0:
        for a in [
            Area(hotel_id=hotel_id, name="Piscina Sky", description="Piscina panoramica al rooftop con bar.", hours="08:00 - 22:00",
                 image_url="https://images.unsplash.com/photo-1488345979593-09db0f85545f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBsdXh1cnklMjBzcGElMjBob3RlbHxlbnwwfHx8fDE3ODExOTc3NzZ8MA&ixlib=rb-4.1.0&q=85"),
            Area(hotel_id=hotel_id, name="Lounge & Bar", description="Cocktail bar con musica live nel weekend.", hours="17:00 - 02:00",
                 image_url="https://images.unsplash.com/photo-1660557989725-f511e9fa6267?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxib3V0aXF1ZSUyMGhvdGVsJTIwbG91bmdlJTIwdmlicmFudHxlbnwwfHx8fDE3ODExOTc3NzV8MA&ixlib=rb-4.1.0&q=85"),
            Area(hotel_id=hotel_id, name="Spa Zen", description="Sauna, hammam, idromassaggio. Su prenotazione.", hours="10:00 - 21:00",
                 image_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800"),
            Area(hotel_id=hotel_id, name="Sala Giochi", description="Ping pong, biliardo, console. Lancia una sfida!", hours="09:00 - 23:00",
                 image_url="https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800"),
        ]:
            await db.areas.insert_one(a.model_dump())

    # Seed events if none
    if await db.events.count_documents({"hotel_id": hotel_id}) == 0:
        for e in [
            Event(hotel_id=hotel_id, title="Aperitivo in piscina", description="DJ set e drink al tramonto al rooftop.",
                  event_time="Oggi 19:00", location="Piscina Sky",
                  image_url="https://images.unsplash.com/photo-1718096551429-8cafaba752db?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxwb29sJTIwcGFydHklMjBldmVudHxlbnwwfHx8fDE3ODExOTc3NzZ8MA&ixlib=rb-4.1.0&q=85"),
            Event(hotel_id=hotel_id, title="Escursione in barca", description="Mezza giornata, tour delle calette. Sconto gruppi 6+.",
                  event_time="Domani 09:30", location="Reception",
                  image_url="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800"),
            Event(hotel_id=hotel_id, title="Cena degustazione", description="5 portate, chef ospite. Prenotazione obbligatoria.",
                  event_time="Sab 20:30", location="Ristorante",
                  image_url="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800"),
        ]:
            await db.events.insert_one(e.model_dump())

    # Seed coupon templates if none
    if await db.coupon_templates.count_documents({"hotel_id": hotel_id}) == 0:
        for t in [
            CouponTemplate(hotel_id=hotel_id, name="Caffè espresso", description="Un caffè al bar dell'hotel.", emoji="☕", category="drink", price_cents=300, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Spritz", description="Spritz Aperol al lounge.", emoji="🍹", category="drink", price_cents=800, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Calice di vino", description="Vino della casa, bianco o rosso.", emoji="🍷", category="drink", price_cents=700, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Cocktail signature", description="Cocktail della casa.", emoji="🍸", category="drink", price_cents=1200, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Aperitivo per 2", description="Tagliere + 2 cocktail al tramonto.", emoji="🥂", category="food", price_cents=2500, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Cena 3 portate", description="Antipasto, primo e dolce al ristorante.", emoji="🍽️", category="food", price_cents=4500, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Massaggio relax 30'", description="Spa Zen — trattamento rilassante.", emoji="💆", category="spa", price_cents=4000, is_seeded=True),
            CouponTemplate(hotel_id=hotel_id, name="Day spa completa", description="Sauna + hammam + massaggio 50'.", emoji="🧖", category="spa", price_cents=9000, is_seeded=True),
        ]:
            await db.coupon_templates.insert_one(t.model_dump())
    logger.info("Bootstrap complete: hotel %s", hotel_id)


app.include_router(api_router)


@app.websocket("/api/ws")
async def ws_endpoint(ws: WebSocket, token: Optional[str] = None, role: str = "guest"):
    await ws.accept()
    if not token:
        await ws.send_json({"type": "error", "detail": "Missing token"})
        await ws.close(code=1008); return

    guest_id = None; hotel_id = None; admin = False
    if role == "admin":
        sess = await db.admin_sessions.find_one({"token": token}, {"_id": 0})
        if not sess:
            await ws.send_json({"type": "error", "detail": "Invalid admin token"})
            await ws.close(code=1008); return
        hotel_id = sess["hotel_id"]
        admin = True
        await manager.connect_admin(hotel_id, ws)
    else:
        g = await db.guests.find_one({"session_token": token, "active": True}, {"_id": 0})
        if not g:
            await ws.send_json({"type": "error", "detail": "Invalid guest token"})
            await ws.close(code=1008); return
        guest_id = g["id"]; hotel_id = g["hotel_id"]
        await manager.connect_guest(guest_id, hotel_id, ws)

    await ws.send_json({"type": "ready", "role": "admin" if admin else "guest"})
    try:
        while True:
            # We only use the channel for server→client push. Ignore client messages
            # but keep the connection alive by reading.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if admin:
            manager.disconnect_admin(hotel_id, ws)
        else:
            manager.disconnect_guest(guest_id, hotel_id, ws)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
