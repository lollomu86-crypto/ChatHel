import React, { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

/**
 * Generic edit dialog for admin entities (events, areas, coupon templates).
 *
 * Props:
 *   open      – boolean
 *   onClose   – fn()
 *   onSaved   – fn()  (called after successful PATCH)
 *   title     – heading text
 *   endpoint  – PATCH endpoint path (e.g. `/admin/events/<id>`)
 *   initial   – initial values for fields
 *   fields    – [{ name, label, type: 'text'|'textarea'|'select'|'number'|'checkbox', options?, placeholder?, maxLength?, min? }]
 */
export default function AdminEditDialog({ open, onClose, onSaved, title, endpoint, initial, fields }) {
  const [values, setValues] = useState(initial || {});
  const [busy, setBusy] = useState(false);

  useEffect(() => { setValues(initial || {}); }, [initial, open]);

  if (!open) return null;

  const onChange = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const submit = async (e) => {
    e.preventDefault();
    const payload = {};
    fields.forEach((f) => {
      const v = values[f.name];
      if (v !== undefined && v !== null && v !== (initial?.[f.name] ?? "")) {
        payload[f.name] = f.type === "number" ? Number(v) : v;
      }
    });
    if (Object.keys(payload).length === 0) { toast.info("Nessuna modifica"); return; }
    setBusy(true);
    try {
      await api.patch(endpoint, payload);
      toast.success("Aggiornato");
      onSaved && onSaved();
      onClose && onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Errore");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="admin-edit-dialog">
      <div className="brutal-card p-6 w-full max-w-lg bg-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <h3 className="font-display text-2xl font-black tracking-tight">{title}</h3>
          <button data-testid="admin-edit-dialog-close" onClick={onClose} className="text-slate-500 hover:text-brand"><X size={20}/></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 block mb-1">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  data-testid={`edit-field-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => onChange(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  className="input-brutal min-h-[90px]"
                />
              ) : f.type === "select" ? (
                <select
                  data-testid={`edit-field-${f.name}`}
                  value={values[f.name] ?? ""}
                  onChange={(e) => onChange(f.name, e.target.value)}
                  className="input-brutal"
                >
                  {f.options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    data-testid={`edit-field-${f.name}`}
                    type="checkbox"
                    checked={!!values[f.name]}
                    onChange={(e) => onChange(f.name, e.target.checked)}
                  /> {f.placeholder || f.label}
                </label>
              ) : (
                <input
                  data-testid={`edit-field-${f.name}`}
                  type={f.type || "text"}
                  value={values[f.name] ?? ""}
                  onChange={(e) => onChange(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  min={f.min}
                  className="input-brutal"
                />
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1">Annulla</button>
            <button data-testid="admin-edit-dialog-save" type="submit" disabled={busy} className="btn-primary flex-1 inline-flex items-center justify-center gap-2"><Save size={16}/> {busy ? "…" : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
