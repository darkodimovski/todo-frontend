import React, { useEffect, useState, useContext, useCallback } from "react";
import { getTodos, getProjects } from "../services/api";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function Todos() {
  const { token } = useContext(AuthContext);

  const [todos, setTodos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodoDocId, setEditingTodoDocId] = useState(null);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    position: "All",
    project: "All",
    assignee: "All",
    dateFrom: "",
    dateTo: "",
    searchText: "",
  });

  const [form, setForm] = useState({
    title: "",
    description: "",
    descriptionHistory: "",
    dueDate: "",
    position: "todo",
    project: "",
    assignee: "",
    historyNote: "",
  });

  // Stable, lint-safe data loader
  const fetchData = useCallback(async () => {
    try {
      const [todosRes, projectsRes] = await Promise.all([getTodos(), getProjects()]);
      setTodos(todosRes.data?.data || []);
      setProjects(projectsRes.data?.data || []);
    } catch {
      setError("Failed to load todos/projects");
    }

    try {
      if (!token) {
        setUsers([]);
        return;
      }
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
    } catch (err) {
      setError("Failed to load users");
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedProject = projects.find(
      (proj) => proj.documentId === form.project || proj.id?.toString() === form.project
    );

    const payload = {
      title: form.title,
      description: form.description,
      descriptionHistory: form.descriptionHistory,
      dueDate: form.dueDate,
      position: form.position,
      project: selectedProject ? selectedProject.id : null,
      assignee: form.assignee ? parseInt(form.assignee, 10) : null,
      publishedAt: new Date().toISOString(),
    };

    const isEditing = !!editingTodoDocId;
    const url = isEditing
      ? `${API_URL}/api/todos/${editingTodoDocId}`
      : `${API_URL}/api/todos`;

    try {
      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: payload }),
      });
      await fetchData();
      setForm({
        title: "",
        description: "",
        descriptionHistory: "",
        dueDate: "",
        position: "todo",
        project: "",
        assignee: "",
        historyNote: "",
      });
      setEditingTodoDocId(null);
      setModalOpen(false);
    } catch (err) {
      setError("Failed to save ToDo.");
    }
  };

  const handleEdit = (todo) => {
    setForm({
      title: todo.title,
      description: todo.description,
      descriptionHistory: todo.descriptionHistory || "",
      dueDate: todo.dueDate,
      position: todo.position,
      project: todo.project?.documentId || todo.project?.id?.toString() || "",
      assignee: todo.assignee?.id?.toString() || "",
      historyNote: "",
    });
    setEditingTodoDocId(todo.documentId);
    setModalOpen(true);
  };

  const handleDelete = async (documentId) => {
    if (!window.confirm("Are you sure you want to delete this ToDo?")) return;
    try {
      await fetch(`${API_URL}/api/todos/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchData();
    } catch {
      setError("Failed to delete ToDo.");
    }
  };

  const getStatusBadge = (position) => {
    const base = "inline-block text-xs font-semibold px-2 py-1 rounded-full";
    switch (position) {
      case "done":
        return `${base} bg-green-200 text-green-800`;
      case "in-progress":
        return `${base} bg-blue-200 text-blue-800`;
      default:
        return `${base} bg-red-200 text-red-800`;
    }
  };

  const getTodoColor = (position) => {
    switch (position) {
      case "done":
        return "bg-green-50";
      case "in-progress":
        return "bg-blue-50";
      default:
        return "bg-red-50";
    }
  };

  const filteredTodos = todos
    .filter((todo) => {
      const matchPosition = filters.position === "All" || todo.position === filters.position;
      const matchProject =
        filters.project === "All" ||
        todo.project?.documentId === filters.project ||
        todo.project?.id?.toString() === filters.project;
      const matchAssignee =
        filters.assignee === "All" || todo.assignee?.id?.toString() === filters.assignee;
      const matchDateFrom = !filters.dateFrom || new Date(todo.dueDate) >= new Date(filters.dateFrom);
      const matchDateTo = !filters.dateTo || new Date(todo.dueDate) <= new Date(filters.dateTo);
      const search = filters.searchText.toLowerCase();
      const matchSearch =
        !search ||
        todo.title?.toLowerCase().includes(search) ||
        todo.description?.toLowerCase().includes(search) ||
        todo.descriptionHistory?.toLowerCase().includes(search);

      return matchPosition && matchProject && matchAssignee && matchDateFrom && matchDateTo && matchSearch;
    })
    .sort((a, b) => {
      if (a.position === "done" && b.position !== "done") return 1;
      if (a.position !== "done" && b.position === "done") return -1;
      return 0;
    });

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Todos</h2>
        <button
          onClick={() => {
            setEditingTodoDocId(null);
            setForm({
              title: "",
              description: "",
              descriptionHistory: "",
              dueDate: "",
              position: "todo",
              project: "",
              assignee: "",
              historyNote: "",
            });
            setModalOpen(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Add ToDo
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <select name="position" value={filters.position} onChange={handleFilterChange} className="p-2 border rounded">
          <option value="All">All Statuses</option>
          <option value="todo">Todo</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        <select name="project" value={filters.project} onChange={handleFilterChange} className="p-2 border rounded">
          <option value="All">All Projects</option>
          {projects.map((proj) => (
            <option key={proj.documentId || proj.id} value={proj.documentId || proj.id}>
              {proj.name}
            </option>
          ))}
        </select>

        <select name="assignee" value={filters.assignee} onChange={handleFilterChange} className="p-2 border rounded">
          <option value="All">All Assignees</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>

        <input
          type="text"
          name="searchText"
          value={filters.searchText}
          onChange={handleFilterChange}
          placeholder="Search title/description"
          className="p-2 border rounded"
        />

        <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="p-2 border rounded" />
        <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="p-2 border rounded" />
      </div>

      <ul className="space-y-2">
        {filteredTodos.map((todo) => (
          <li key={todo.id} className={`group border p-3 rounded ${getTodoColor(todo.position)} transition hover:shadow-md`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{todo.title}</div>
                <div className="text-sm text-gray-600 whitespace-pre-line">{todo.description}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Project: {todo.project?.name || "N/A"} | Assignee: {todo.assignee?.username || "N/A"}
                </div>
                <div className="mt-1">
                  <span className={getStatusBadge(todo.position)}>{todo.position}</span>
                  <span className="text-xs text-gray-400 ml-2">Due: {todo.dueDate || "N/A"}</span>
                </div>
                {todo.descriptionHistory && (
                  <div className="mt-2 bg-gray-100 p-2 rounded text-xs whitespace-pre-line">
                    <strong>Description History:</strong>
                    <br />
                    {todo.descriptionHistory}
                  </div>
                )}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => handleEdit(todo)} className="text-blue-600 text-sm">
                  Edit
                </button>
                <button onClick={() => handleDelete(todo.documentId)} className="text-red-600 text-sm">
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6 relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl">
              &times;
            </button>
            <h2 className="text-xl font-semibold mb-4">{editingTodoDocId ? "Edit ToDo" : "Add ToDo"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input name="title" value={form.title} onChange={handleChange} required placeholder="Title" className="w-full p-2 border rounded" />
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} required placeholder="Main description" className="w-full p-2 border rounded" />
              <div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add to description history..."
                    className="w-full p-2 border rounded"
                    value={form.historyNote}
                    onChange={(e) => setForm((prev) => ({ ...prev, historyNote: e.target.value }))}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.historyNote.trim()) return;
                      const timestamp = new Date().toLocaleString();
                      const newEntry = `[${timestamp}] ${form.historyNote.trim()}`;
                      setForm((prev) => ({
                        ...prev,
                        descriptionHistory: prev.descriptionHistory ? `${prev.descriptionHistory}\n${newEntry}` : newEntry,
                        historyNote: "",
                      }));
                    }}
                    className="bg-gray-300 hover:bg-gray-400 px-3 py-1 rounded"
                  >
                    ➕
                  </button>
                </div>
                {form.descriptionHistory && (
                  <div className="bg-gray-50 border p-2 rounded text-sm max-h-40 overflow-y-auto whitespace-pre-line">
                    <strong className="block mb-1">📜 Description History:</strong>
                    {form.descriptionHistory.split("\n").map((entry, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span>{entry}</span>
                        <button
                          type="button"
                          className="text-red-500 text-xs ml-2"
                          onClick={() => {
                            const updated = form.descriptionHistory.split("\n").filter((_, idx) => idx !== i).join("\n");
                            setForm((prev) => ({ ...prev, descriptionHistory: updated }));
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required className="w-full p-2 border rounded" />
              <select name="position" value={form.position} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select name="project" value={form.project} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="">Select Project</option>
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
              <select name="assignee" value={form.assignee} onChange={handleChange} className="w-full p-2 border rounded">
                <option value="">Assign to User</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded w-full">
                {editingTodoDocId ? "Update" : "Add"} ToDo
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
