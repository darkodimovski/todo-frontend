import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.warn("Service worker registration failed", err);
    });
  });
};

const urlBase64ToUint8Array = (base64) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getCurrentSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
};

export const enablePush = async (token) => {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission-denied");

  const { data } = await axios.get(`${API_URL}/api/push/public-key`);
  const reg = await navigator.serviceWorker.ready;

  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    }));

  await axios.post(
    `${API_URL}/api/push/subscribe`,
    { subscription: subscription.toJSON() },
    authHeaders(token)
  );
  return subscription;
};

export const disablePush = async (token) => {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  try {
    await axios.post(
      `${API_URL}/api/push/unsubscribe`,
      { endpoint: subscription.endpoint },
      authHeaders(token)
    );
  } finally {
    await subscription.unsubscribe();
  }
};

export const sendTestPush = (token) =>
  axios.post(`${API_URL}/api/push/test`, {}, authHeaders(token));

export const sendDueSummary = (token) =>
  axios.post(`${API_URL}/api/push/due-summary`, {}, authHeaders(token));
