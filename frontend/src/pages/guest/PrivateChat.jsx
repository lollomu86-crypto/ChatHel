import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { ChatView, ChatComposer } from "./PublicChat";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function PrivateChat({ me }) {
  const { id } = useParams();
  const [other, setOther] = useState(null);
  const [msgs, setMsgs] = useState([]);

  const load = async () => {
    try {
      const [g, m] = await Promise.all([api.get("/guests"), api.get(`/messages/private/${id}`)]);
      setOther(g.data.find((x) => x.id === id) || { nickname: "Ospite" });
      setMsgs(m.data);
    } catch {}
  };
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, [id]);

  const send = async (content) => {
    try { await api.post("/messages", { channel: "private", content, recipient_id: id }); load(); }
    catch { toast.error("Errore invio"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      <div className="flex items-center gap-3 mb-3">
        <Link to="/app/guests" data-testid="back-guests-link" className="w-10 h-10 rounded-full bg-white border-2 border-ink shadow-brutal-sm flex items-center justify-center">
          <ArrowLeft size={16}/>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full border-2 border-ink bg-sun flex items-center justify-center font-display font-black shadow-brutal-sm">
            {(other?.nickname || "?").slice(0,2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold leading-tight">{other?.nickname}</p>
            <p className="text-xs text-slate-600">{other?.status_text || "Chat privata"}</p>
          </div>
        </div>
      </div>
      <ChatView messages={msgs} me={me} variant="private" emptyText="Inizia la conversazione. È visibile solo a voi due."/>
      <ChatComposer onSend={send} placeholder={`Scrivi a ${other?.nickname || ''}…`} />
    </div>
  );
}
