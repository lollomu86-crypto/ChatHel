from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
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
    return msg.model_dump()


# --- Bootstrap demo hotel on startup ---
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
        # Seed areas
        areas = [
            Area(hotel_id=hotel.id, name="Piscina Sky", description="Piscina panoramica al rooftop con bar.",
                 hours="08:00 - 22:00",
                 image_url="https://images.unsplash.com/photo-1488345979593-09db0f85545f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njl8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBsdXh1cnklMjBzcGElMjBob3RlbHxlbnwwfHx8fDE3ODExOTc3NzZ8MA&ixlib=rb-4.1.0&q=85"),
            Area(hotel_id=hotel.id, name="Lounge & Bar", description="Cocktail bar con musica live nel weekend.",
                 hours="17:00 - 02:00",
                 image_url="https://images.unsplash.com/photo-1660557989725-f511e9fa6267?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzF8MHwxfHNlYXJjaHwxfHxib3V0aXF1ZSUyMGhvdGVsJTIwbG91bmdlJTIwdmlicmFudHxlbnwwfHx8fDE3ODExOTc3NzV8MA&ixlib=rb-4.1.0&q=85"),
            Area(hotel_id=hotel.id, name="Spa Zen", description="Sauna, hammam, idromassaggio. Su prenotazione.",
                 hours="10:00 - 21:00",
                 image_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800"),
            Area(hotel_id=hotel.id, name="Sala Giochi", description="Ping pong, biliardo, console. Lancia una sfida!",
                 hours="09:00 - 23:00",
                 image_url="https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=800"),
        ]
        for a in areas:
            await db.areas.insert_one(a.model_dump())
        # Seed events
        events = [
            Event(hotel_id=hotel.id, title="Aperitivo in piscina", description="DJ set e drink al tramonto al rooftop.",
                  event_time="Oggi 19:00", location="Piscina Sky",
                  image_url="https://images.unsplash.com/photo-1718096551429-8cafaba752db?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxwb29sJTIwcGFydHklMjBldmVudHxlbnwwfHx8fDE3ODExOTc3NzZ8MA&ixlib=rb-4.1.0&q=85"),
            Event(hotel_id=hotel.id, title="Escursione in barca", description="Mezza giornata, tour delle calette. Sconto gruppi 6+.",
                  event_time="Domani 09:30", location="Reception",
                  image_url="https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800"),
            Event(hotel_id=hotel.id, title="Cena degustazione", description="5 portate, chef ospite. Prenotazione obbligatoria.",
                  event_time="Sab 20:30", location="Ristorante",
                  image_url="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800"),
        ]
        for e in events:
            await db.events.insert_one(e.model_dump())
        logger.info("Seeded demo hotel: WELCOME2026 / admin123")


app.include_router(api_router)

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
