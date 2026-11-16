import React, { useContext, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import {
  pushSupported,
  getCurrentSubscription,
  enablePush,
  disablePush,
  sendTestPush,
  sendDueSummary,
} from "../services/push";

// status: unsupported | denied | off | on | busy
export default function NotificationToggle() {
  const { token } = useContext(AuthContext);
  const [status, setStatus] = useState("off");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (!pushSupported()) return setStatus("unsupported");
    if (Notification.permission === "denied") return setStatus("denied");

    getCurrentSubscription().then((sub) => {
      setStatus(sub ? "on" : "off");
      // keep the server in sync (e.g. another user logged in on this device)
      if (sub && token && Notification.permission === "granted") enablePush(token).catch(() => {});
    });
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const run = async (fn, okMessage) => {
    setMessage("");
    try {
      await fn();
      if (okMessage) setMessage(okMessage);
    } catch (err) {
      if (err?.message === "permission-denied") {
        setStatus(Notification.permission === "denied" ? "denied" : "off");
        setMessage("Notifications were not allowed.");
      } else {
        setMessage(
          `Failed: ${err?.response?.status ? `HTTP ${err.response.status}` : err?.message || "error"}`
        );
      }
    }
  };

  const turnOn = () =>
    run(async () => {
      setStatus("busy");
      try {
        await enablePush(token);
        setStatus("on");
        await sendTestPush(token);
      } catch (err) {
        setStatus((s) => (s === "busy" ? "off" : s));
        throw err;
      }
    }, "Notifications enabled on this device.");

  const turnOff = () =>
    run(async () => {
      setStatus("busy");
      await disablePush(token);
      setStatus("off");
    }, "Notifications disabled on this device.");

  const Icon = status === "on" ? BellRing : status === "denied" || status === "unsupported" ? BellOff : Bell;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        title="Notifications"
        className={`theme-toggle inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition ${
          status === "on" ? "text-blue-600" : "text-gray-700"
        }`}
      >
        <Icon size={18} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white border rounded-lg shadow-lg p-4 z-50 text-sm">
          <div className="font-semibold mb-1">Alerts</div>
          <p className="text-gray-600 mb-3">
            Assigned ToDos and a daily 08:00 summary of overdue and due ToDos.
          </p>

          {status === "unsupported" && (
            <p className="text-gray-600">
              This browser doesn't support push. On iPhone, add the app to the Home Screen first.
            </p>
          )}

          {status === "denied" && (
            <p className="text-gray-600">
              Notifications are blocked. Allow them in the browser's site settings, then reload.
            </p>
          )}

          {(status === "off" || status === "busy") && (
            <button
              type="button"
              disabled={status === "busy"}
              onClick={turnOn}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {status === "busy" ? "Enabling…" : "Enable notifications"}
            </button>
          )}

          {status === "on" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => run(() => sendTestPush(token), "Test notification sent.")}
                className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Send test notification
              </button>
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    const { data } = await sendDueSummary(token);
                    if (!data?.users) throw new Error("No overdue or upcoming ToDos assigned to you");
                  }, "Due summary sent.")
                }
                className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300"
              >
                Send my due summary now
              </button>
              <button type="button" onClick={turnOff} className="text-red-600 text-xs mt-1 self-start">
                Turn off on this device
              </button>
            </div>
          )}

          {message && <p className="mt-3 text-xs text-gray-600">{message}</p>}
        </div>
      )}
    </div>
  );
}
