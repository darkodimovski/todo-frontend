import React, { useCallback, useEffect, useState } from "react";
import { api } from "../services/http";
import { getProjects } from "../services/api";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const emptyForm = {
  title: "",
  description: "",
  frequency: "weekly",
  weekday: 1,
  monthDay: 1,
  leadDays: 2,
  active: true,
  assignee: "",
  project: "",
};

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());

// same rule as the server: next due date on or after `from`
function nextDue(rt, from = todayIso()) {
  const d = new Date(`${from}T00:00:00Z`);
  if (rt.frequency === "monthly") {
    for (let i = 0; i < 2; i++) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + i;
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const cand = new Date(Date.UTC(y, m, Math.min(rt.monthDay || 1, last))).toISOString().slice(0, 10);
      if (cand >= from) return cand;
    }
  }
  const cur = ((d.getUTCDay() + 6) % 7) + 1;
  d.setUTCDate(d.getUTCDate() + (((rt.weekday || 1) - cur + 7) % 7));
  return d.toISOString().slice(0, 10);
}

const scheduleText = (rt) =>
  rt.frequency === "monthly"
    ? `Monthly on day ${rt.monthDay}${rt.monthDay > 28 ? " (or last day)" : ""}`
    : `Every ${WEEKDAYS[(rt.weekday || 1) - 1]}`;

const fmt = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : "—");

export default function Recurring() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [rt, us, pr] = await Promise.all([
        api.get("/recurring-todos?populate=*&pagination[pageSize]=200&sort=title"),
        api.get("/users"),
        getProjects(),
      ]);
      setItems(rt.data.data || []);
      setUsers(us.data || []);
      setProjects(pr.data.data || []);
    } catch (err) {
      setError(`Failed to load recurring ToDos${err?.response?.status ? ` (HTTP ${err.response.status})` : ""}.`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (rt) => {
    setForm({
      title: rt.title || "",
      description: rt.description || "",
      frequency: rt.frequency || "weekly",
      weekday: rt.weekday || 1,
      monthDay: rt.monthDay || 1,
      leadDays: rt.leadDays ?? 2,
      active: rt.active !== false,
      assignee: rt.assignee?.documentId || "",
      project: rt.project?.documentId || "",
    });
    setEditingId(rt.documentId);
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      weekday: Number(form.weekday),
      monthDay: Number(form.monthDay),
      leadDays: Number(form.leadDays),
      assignee: form.assignee || null,
      project: form.project || null,
    };
    try {
      if (editingId) await api.put(`/recurring-todos/${editingId}`, { data });
      else await api.post("/recurring-todos", { data });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Failed to save.");
    }
  };

  const toggleActive = async (rt) => {
    await api.put(`/recurring-todos/${rt.documentId}`, { data: { active: !rt.active } });
    load();
  };

  const remove = async (rt) => {
    if (!window.confirm(`Delete recurring ToDo "${rt.title}"? Already created ToDos stay.`)) return;
    await api.delete(`/recurring-todos/${rt.documentId}`);
    load();
  };

  const generateNow = async () => {
    setMessage("");
    try {
      const { data } = await api.post("/recurring-todos/generate");
      setMessage(
        data.created ? `Created ${data.created} ToDo(s): ${data.items.join(", ")}` : "Nothing due yet – no ToDos created."
      );
      load();
    } catch (err) {
      setError(`Failed to generate${err?.response?.status ? ` (HTTP ${err.response.status})` : ""}.`);
    }
  };

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  return (
    <div className="py-2 sm:p-6">
      <div className="mb-2 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold">Recurring ToDos</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={generateNow} className="bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300 text-sm">
            Create due ToDos now
          </button>
          <button onClick={openNew} className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm">
            + Add recurring
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Reports and invoices that come back every week or month. Each one creates a normal ToDo a few days before
        it's due (every morning at 06:00), and the assignee gets an alert.
      </p>

      {error && <div className="mb-4 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}
      {message && <div className="mb-4 p-2 rounded bg-green-100 text-green-800 text-sm">{message}</div>}

      {items.length === 0 && !error && (
        <div className="p-6 text-center text-gray-500 border rounded bg-white">
          No recurring ToDos yet. Add your weekly and monthly reports here.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((rt) => {
          const next = nextDue(rt, rt.lastGeneratedFor && rt.lastGeneratedFor >= todayIso() ? rt.lastGeneratedFor : todayIso());
          return (
            <li
              key={rt.documentId}
              className={`border rounded p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
                rt.active ? "" : "opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold break-words">{rt.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {scheduleText(rt)} · created {rt.leadDays ?? 2} day(s) before
                  {rt.project?.name ? ` · ${rt.project.name}` : ""}
                </div>
              </div>
              <div className="text-sm sm:text-right shrink-0">
                <div>{rt.assignee?.username || <span className="text-gray-500">Unassigned</span>}</div>
                <div className="text-xs text-gray-500">
                  {rt.active ? `Next due ${fmt(next)}` : "Paused"}
                  {rt.lastGeneratedFor ? ` · last ${fmt(rt.lastGeneratedFor)}` : ""}
                </div>
              </div>
              <div className="flex gap-3 text-sm shrink-0">
                <button onClick={() => toggleActive(rt)} className="text-gray-600 underline">
                  {rt.active ? "Pause" : "Resume"}
                </button>
                <button onClick={() => openEdit(rt)} className="text-blue-600 underline">Edit</button>
                <button onClick={() => remove(rt)} className="text-red-600 underline">Delete</button>
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
            <h2 className="text-xl font-semibold mb-4">{editingId ? "Edit recurring ToDo" : "New recurring ToDo"}</h2>

            <form onSubmit={save} className="space-y-3">
              <input
                value={form.title}
                onChange={set("title")}
                required
                placeholder="Title, e.g. Weekly report OTP"
                className="w-full p-2 border rounded"
              />
              <textarea
                value={form.description}
                onChange={set("description")}
                rows={2}
                placeholder="Description (optional)"
                className="w-full p-2 border rounded"
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Repeats</span>
                  <select value={form.frequency} onChange={set("frequency")} className="w-full p-2 border rounded">
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                {form.frequency === "weekly" ? (
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Due on</span>
                    <select value={form.weekday} onChange={set("weekday")} className="w-full p-2 border rounded">
                      {WEEKDAYS.map((d, i) => (
                        <option key={d} value={i + 1}>{d}</option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Day of month</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={form.monthDay}
                      onChange={set("monthDay")}
                      className="w-full p-2 border rounded"
                    />
                  </label>
                )}
              </div>

              <label className="text-sm block">
                <span className="block text-gray-600 mb-1">Create the ToDo this many days before it's due</span>
                <input
                  type="number"
                  min={0}
                  max={form.frequency === "weekly" ? 6 : 30}
                  value={form.leadDays}
                  onChange={set("leadDays")}
                  className="w-full p-2 border rounded"
                />
              </label>

              <select value={form.assignee} onChange={set("assignee")} className="w-full p-2 border rounded">
                <option value="">Assign to…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.documentId}>{u.username}</option>
                ))}
              </select>

              <select value={form.project} onChange={set("project")} className="w-full p-2 border rounded">
                <option value="">Project (optional)</option>
                {projects.map((p) => (
                  <option key={p.documentId} value={p.documentId}>{p.name}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={set("active")} />
                Active
              </label>

              <p className="text-xs text-gray-500">
                Next due: {fmt(nextDue({ ...form, weekday: Number(form.weekday), monthDay: Number(form.monthDay) }))}
              </p>

              <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded w-full">
                {editingId ? "Save" : "Add"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
