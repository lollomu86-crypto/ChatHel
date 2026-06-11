import { api } from "./api";

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
};

export const isPushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const getPushPermission = () => (isPushSupported() ? Notification.permission : "denied");

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (e) {
    return null;
  }
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Push not supported");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission denied");

  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) throw new Error("No service worker");

  // Re-use existing subscription if present
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await api.get("/push/vapid-public-key");
    if (!data.public_key) throw new Error("Missing VAPID key");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.public_key),
    });
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() });
  return sub;
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  if (sub) {
    try { await api.post("/push/unsubscribe", { subscription: sub.toJSON() }); } catch (e) { console.debug("[chathel] ignored", e); }
    await sub.unsubscribe();
  }
}
