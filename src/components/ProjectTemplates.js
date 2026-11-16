import React, { useEffect, useState } from "react";
import { api } from "../services/http";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());

/** Save an existing project (and its ToDos with their offsets from the start date) as a template. */
export const saveProjectAsTemplate = (projectDocumentId, name) =>
  api.post(`/project-templates/from-project/${projectDocumentId}`, { data: { name } });

/** Modal: pick a template, set name/start/clients, create the project with all its ToDos. */
export default function TemplatesModal({ open, onClose, clients, onCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [clientIds, setClientIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get("/project-templates?pagination[pageSize]=200&sort=name")
      .then((res) => setTemplates(res.data?.data || []))
      .catch((err) => setError(`Failed to load templates${err?.response?.status ? ` (HTTP ${err.response.status})` : ""}.`));

  useEffect(() => {
    if (!open) return;
    setError("");
    setSelectedId("");
    setName("");
    setStartDate(today());
    setClientIds([]);
    load();
  }, [open]);

  if (!open) return null;
  const selected = templates.find((t) => t.documentId === selectedId);

  const pick = (t) => {
    setSelectedId(t.documentId);
    setName(t.name);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/project-templates/${selected.documentId}/apply`, {
        data: { name, startDate, clients: clientIds },
      });
      onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error?.message || "Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"? Projects created from it stay.`)) return;
    await api.delete(`/project-templates/${t.documentId}`);
    if (selectedId === t.documentId) setSelectedId("");
    load();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-lg p-4 sm:p-6 relative my-4 sm:my-0">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 text-2xl"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold mb-1">New project from template</h2>
        <p className="text-sm text-gray-600 mb-4">
          Save a project as a template with "Save as template" on its card, then reuse it here.
        </p>

        {error && <div className="mb-3 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}

        {templates.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 border rounded">No templates yet.</div>
        ) : (
          <ul className="border rounded divide-y max-h-56 overflow-y-auto mb-4">
            {templates.map((t) => (
              <li
                key={t.documentId}
                className={`p-2 flex items-center gap-2 cursor-pointer ${
                  selectedId === t.documentId ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => pick(t)}
              >
                <input type="radio" readOnly checked={selectedId === t.documentId} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm break-words">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {(t.todos || []).length} ToDos · {t.durationDays} days
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(t);
                  }}
                  className="text-red-600 text-xs underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && (
          <form onSubmit={create} className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Project name"
              className="w-full p-2 border rounded"
            />
            <label className="text-sm block">
              <span className="block text-gray-600 mb-1">Start date (ToDo due dates follow from it)</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full p-2 border rounded"
              />
            </label>

            <div className="border rounded p-3 max-h-40 overflow-y-auto">
              <p className="text-sm font-medium text-gray-700 mb-2">Clients</p>
              {clients.map((c) => (
                <label key={c.documentId} className="flex items-center gap-2 text-sm py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientIds.includes(c.documentId)}
                    onChange={(e) =>
                      setClientIds((ids) =>
                        e.target.checked ? [...ids, c.documentId] : ids.filter((id) => id !== c.documentId)
                      )
                    }
                  />
                  {c.Client}
                </label>
              ))}
            </div>

            {(selected.todos || []).length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600">ToDos that will be created</summary>
                <ul className="mt-2 list-disc list-inside text-gray-700">
                  {selected.todos.map((t, i) => (
                    <li key={i}>
                      {t.title} <span className="text-gray-500">(day {t.offsetDays || 0})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create project"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
