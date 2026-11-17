import React, { useCallback, useContext, useEffect, useState } from "react";
import { api } from "../services/http";
import { AuthContext } from "../context/AuthContext";

const ROLES = [
  { key: "specialist", label: "Backoffice Specialist" },
  { key: "manager", label: "Backoffice Manager" },
];

const errorText = (err, fallback) => err?.response?.data?.error?.message || fallback;

export default function Users() {
  const { user: me } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: "", email: "", role: "specialist" });
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { type: "ok" | "error", text }

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/team");
      setUsers(data || []);
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to load users.") });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const { data } = await api.post("/team/invite", { data: form });
      setModalOpen(false);
      setForm({ username: "", email: "", role: "specialist" });
      setNotice(
        data.emailSent
          ? { type: "ok", text: `Invitation sent to ${data.data.email}. They choose their own password.` }
          : {
              type: "error",
              text: `User created, but the e-mail could not be sent. Check the e-mail settings, then use "Resend invite".`,
            }
      );
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to invite the user.") });
    } finally {
      setBusy(false);
    }
  };

  const update = async (u, data, okText) => {
    setNotice(null);
    try {
      await api.put(`/team/${u.id}`, { data });
      setNotice({ type: "ok", text: okText });
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to update the user.") });
    }
  };

  const approve = async (u, role) => {
    setNotice(null);
    try {
      await api.put(`/team/${u.id}`, { data: { approve: true, role } });
      setNotice({ type: "ok", text: `${u.username} can log in now.` });
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to approve the user.") });
    }
  };

  const reject = async (u) => {
    if (!window.confirm(`Reject and delete the sign-up of ${u.username} (${u.email})?`)) return;
    setNotice(null);
    try {
      await api.delete(`/team/${u.id}`);
      setNotice({ type: "ok", text: `Sign-up of ${u.username} rejected.` });
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to reject the sign-up.") });
    }
  };

  const pending = users.filter((u) => u.pendingApproval);
  const members = users.filter((u) => !u.pendingApproval);

  const resend = async (u) => {
    setNotice(null);
    try {
      await api.post(`/team/${u.id}/resend-invite`);
      setNotice({ type: "ok", text: `New "set your password" link sent to ${u.email}.` });
      load();
    } catch (err) {
      setNotice({ type: "error", text: errorText(err, "Failed to send the e-mail.") });
    }
  };

  return (
    <div className="py-2 sm:p-6">
      <div className="mb-2 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold">Users</h2>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
        >
          + Invite user
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Invited people get an e-mail with a link to choose their own password. You never see or set their passwords.
      </p>

      {notice && (
        <div
          className={`mb-4 p-2 rounded text-sm ${
            notice.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Waiting for approval ({pending.length})</h3>
          <ul className="space-y-2">
            {pending.map((u) => (
              <PendingRow key={u.id} user={u} onApprove={approve} onReject={reject} />
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-2">
        {members.map((u) => {
          const isMe = u.id === me?.id;
          return (
            <li
              key={u.id}
              className={`border rounded p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
                u.blocked ? "opacity-60" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold break-words">
                  {u.username} {isMe && <span className="text-xs text-gray-500">(you)</span>}
                </div>
                <div className="text-xs text-gray-500 break-all">{u.email}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {u.blocked && (
                    <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">Deactivated</span>
                  )}
                  {!u.blocked && u.invitePending && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      Password link sent
                    </span>
                  )}
                  {!u.role && (
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                      {u.roleName || "No role"}
                    </span>
                  )}
                </div>
              </div>

              <select
                value={u.role || ""}
                disabled={isMe}
                onChange={(e) =>
                  update(u, { role: e.target.value }, `${u.username} is now ${ROLES.find((r) => r.key === e.target.value)?.label}.`)
                }
                className="p-2 border rounded text-sm sm:w-56"
              >
                {!u.role && <option value="">{u.roleName || "No role"}</option>}
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-3 text-sm shrink-0">
                {!u.blocked && (
                  <button onClick={() => resend(u)} className="text-blue-600 underline">
                    {u.invitePending ? "Resend invite" : "Send password link"}
                  </button>
                )}
                {!isMe && (
                  <button
                    onClick={() =>
                      update(
                        u,
                        { blocked: !u.blocked },
                        u.blocked ? `${u.username} can log in again.` : `${u.username} can no longer log in.`
                      )
                    }
                    className={u.blocked ? "text-green-700 underline" : "text-red-600 underline"}
                  >
                    {u.blocked ? "Reactivate" : "Deactivate"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-4 sm:p-6 relative my-4 sm:my-0">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-xl font-semibold mb-4">Invite user</h2>
            <form onSubmit={invite} className="space-y-3">
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                minLength={3}
                placeholder="Username (e.g. Ivan Horvat)"
                className="w-full p-2 border rounded"
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                placeholder="E-mail"
                className="w-full p-2 border rounded"
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full p-2 border rounded"
              >
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                They'll get an e-mail with a link to set their password. The link works once.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send invitation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRow({ user, onApprove, onReject }) {
  const [role, setRole] = useState("specialist");
  return (
    <li className="border rounded p-3 bg-yellow-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-semibold break-words">{user.username}</div>
        <div className="text-xs text-gray-600 break-all">
          {user.email} · signed up {new Date(user.createdAt).toLocaleDateString()}
        </div>
      </div>
      <select value={role} onChange={(e) => setRole(e.target.value)} className="p-2 border rounded text-sm sm:w-56">
        {ROLES.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </select>
      <div className="flex gap-3 text-sm shrink-0">
        <button
          onClick={() => onApprove(user, role)}
          className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
        >
          Approve
        </button>
        <button onClick={() => onReject(user)} className="text-red-600 underline">
          Reject
        </button>
      </div>
    </li>
  );
}
