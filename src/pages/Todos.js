import React, { useEffect, useState, useContext, useCallback } from "react";
import { getTodos, getProjects } from "../services/api";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

const SCOPES = [
  { key: "mine", label: "Mine" },
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "overdue", label: "Overdue" },
];

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());

const readScope = () => {
  try {
    return localStorage.getItem("todoScope") || "mine";
  } catch {
    return "mine";
  }
};

export default function Todos() {
  const { token, logout, user: currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [todos, setTodos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTodoDocId, setEditingTodoDocId] = useState(null);
  const [error, setError] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [showDone, setShowDone] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scope, setScope] = useState(readScope);

  const changeScope = (key) => {
    setScope(key);
    try {
      localStorage.setItem("todoScope", key);
    } catch {
      // ignore
    }
  };

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

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

  const fetchData = useCallback(async () => {
    try {
      const [todosRes, projectsRes] = await Promise.all([getTodos(), getProjects()]);
      console.log("todos from API:", todosRes.data?.data?.length, todosRes.data?.data?.map(t => ({ id: t.id, title: t.title, position: t.position })));
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
      const status = err?.response?.status;
      if (status === 401) {
        // stored token is expired or no longer valid for this backend: log in again
        logout();
        navigate("/login", { replace: true });
        return;
      }
      console.error("Failed to load users", err?.response?.data || err);
      setError(`Failed to load users${status ? ` (HTTP ${status})` : ""}`);
    }
  }, [token, logout, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, showDone, scope]);

  const closePhotoViewer = useCallback(() => {
    setPhotoViewerOpen(false);
    setViewerPhotos([]);
    setViewerIndex(0);
  }, []);

  const showPrevPhoto = useCallback(() => {
    setViewerIndex((prev) => (prev === 0 ? viewerPhotos.length - 1 : prev - 1));
  }, [viewerPhotos.length]);

  const showNextPhoto = useCallback(() => {
    setViewerIndex((prev) => (prev === viewerPhotos.length - 1 ? 0 : prev + 1));
  }, [viewerPhotos.length]);

  useEffect(() => {
    if (!photoViewerOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePhotoViewer();
      if (e.key === "ArrowLeft") showPrevPhoto();
      if (e.key === "ArrowRight") showNextPhoto();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photoViewerOpen, closePhotoViewer, showPrevPhoto, showNextPhoto]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const normalizePhotoUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_URL}${url}`;
  };

  const resetFormAndOpenModal = () => {
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
    setSelectedPhotos([]);
    setExistingPhotos([]);
    setIsDragging(false);
    setModalOpen(true);
  };

  const handlePhotoSelect = (files) => {
    const fileArray = Array.from(files || []);
    if (!fileArray.length) return;

    const onlyImages = fileArray.filter((file) => file.type.startsWith("image/"));
    setSelectedPhotos((prev) => [...prev, ...onlyImages]);
  };

  const removeSelectedPhoto = (indexToRemove) => {
    setSelectedPhotos((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handlePhotoSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const openPhotoViewer = (photos, index = 0) => {
    if (!photos?.length) return;
    setViewerPhotos(photos);
    setViewerIndex(index);
    setPhotoViewerOpen(true);
  };


  const uploadPhotos = async () => {
    if (!selectedPhotos.length) return [];

    const formData = new FormData();
    selectedPhotos.forEach((file) => {
      formData.append("files", file);
    });

    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Photo upload failed");
    }

    const uploadedFiles = await res.json();
    return uploadedFiles.map((file) => file.id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const selectedProject = projects.find(
      (proj) => proj.documentId === form.project || proj.id?.toString() === form.project
    );

    try {
      const uploadedPhotoIds = await uploadPhotos();

      const payload = {
        title: form.title,
        description: form.description,
        descriptionHistory: form.descriptionHistory,
        dueDate: form.dueDate,
        position: form.position,
        project: selectedProject ? selectedProject.documentId : null,
        assignee: form.assignee ? parseInt(form.assignee, 10) : null,
        photos: [...existingPhotos.map((photo) => photo.id), ...uploadedPhotoIds],
      };

      const isEditing = !!editingTodoDocId;
      const url = isEditing
        ? `${API_URL}/api/todos/${editingTodoDocId}`
        : `${API_URL}/api/todos`;

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data: payload }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error("Todo save failed:", res.status, responseText);
        throw new Error(`Failed to save ToDo: ${res.status} ${responseText}`);
      }

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
      setSelectedPhotos([]);
      setExistingPhotos([]);
      setEditingTodoDocId(null);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save ToDo.");
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

    setExistingPhotos(todo.photos || []);
    setSelectedPhotos([]);
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

  const loadImageAsDataUrl = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = reject;
      img.src = src;
    });

  const exportSingleTodoToPdf = async (todo) => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageHeight = doc.internal.pageSize.getHeight();

      let y = 15;

      doc.setFontSize(18);
      doc.text("ToDo Report", 14, y);
      y += 10;

      doc.setFontSize(14);
      doc.text(todo.title || "Untitled", 14, y);
      y += 8;

      doc.setFontSize(10);

      const content = [
        `Description: ${todo.description || "N/A"}`,
        `Description History: ${todo.descriptionHistory || "N/A"}`,
        `Status: ${todo.position || "N/A"}`,
        `Project: ${todo.project?.name || "N/A"}`,
        `Assignee: ${todo.assignee?.username || "N/A"}`,
        `Due Date: ${todo.dueDate || "N/A"}`,
      ].join("\n\n");

      const textLines = doc.splitTextToSize(content, 180);
      doc.text(textLines, 14, y);
      y += textLines.length * 5 + 8;

      if (todo.photos?.length) {
        doc.setFontSize(12);
        doc.text("Photos", 14, y);
        y += 6;

        for (const photo of todo.photos) {
          try {
            const dataUrl = await loadImageAsDataUrl(normalizePhotoUrl(photo.url));

            if (y > pageHeight - 60) {
              doc.addPage();
              y = 15;
            }

            doc.addImage(dataUrl, "JPEG", 14, y, 60, 45);
            y += 52;
          } catch {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = 15;
            }

            doc.text(`Could not load image: ${photo.name || "photo"}`, 14, y);
            y += 6;
          }
        }
      }

      const safeTitle = (todo.title || "todo")
        .replace(/[^a-z0-9]/gi, "-")
        .replace(/-+/g, "-")
        .toLowerCase();

      doc.save(`${safeTitle}.pdf`);
    } catch {
      setError("Failed to export ToDo PDF.");
    }
  };

  const today = isoToday();
  const weekEnd = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + (7 - (((d.getUTCDay() + 6) % 7) + 1)));
    return d.toISOString().slice(0, 10);
  })();

  const matchScope = (todo, key) => {
    const open = todo.position !== "done";
    switch (key) {
      case "mine":
        return todo.assignee?.id === currentUser?.id;
      case "today":
        return open && todo.dueDate === today;
      case "week":
        return open && !!todo.dueDate && todo.dueDate >= today && todo.dueDate <= weekEnd;
      case "overdue":
        return open && !!todo.dueDate && todo.dueDate < today;
      default:
        return true;
    }
  };
  const inScope = (todo) => matchScope(todo, scope);

  // badge counts: open ToDos only
  const scopeCounts = Object.fromEntries(
    SCOPES.map(({ key }) => [key, todos.filter((t) => t.position !== "done" && matchScope(t, key)).length])
  );

  const filteredTodos = todos
    .filter(inScope)
    .filter((todo) => {
      const matchDone = showDone || todo.position !== "done";
      const matchPosition = filters.position === "All" || todo.position === filters.position;
      const matchProject =
        filters.project === "All" ||
        todo.project?.documentId === filters.project ||
        todo.project?.id?.toString() === filters.project;
      const matchAssignee =
        filters.assignee === "All" || todo.assignee?.id?.toString() === filters.assignee;
      const matchDateFrom =
        !filters.dateFrom || new Date(todo.dueDate) >= new Date(filters.dateFrom);
      const matchDateTo =
        !filters.dateTo || new Date(todo.dueDate) <= new Date(filters.dateTo);
      const search = filters.searchText.toLowerCase();
      const matchSearch =
        !search ||
        todo.title?.toLowerCase().includes(search) ||
        todo.description?.toLowerCase().includes(search) ||
        todo.descriptionHistory?.toLowerCase().includes(search);

      return (
        matchDone &&
        matchPosition &&
        matchProject &&
        matchAssignee &&
        matchDateFrom &&
        matchDateTo &&
        matchSearch
      );
    })
    .sort((a, b) => {
      if (a.position === "done" && b.position !== "done") return 1;
      if (a.position !== "done" && b.position === "done") return -1;
      return 0;
    });

  const activeFilterCount = [
    filters.position !== "All",
    filters.project !== "All",
    filters.assignee !== "All",
    !!filters.searchText,
    !!filters.dateFrom,
    !!filters.dateTo,
  ].filter(Boolean).length;

  const totalPages = Math.max(1, Math.ceil(filteredTodos.length / ITEMS_PER_PAGE));

  const paginatedTodos = filteredTodos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="py-2 sm:p-6">
      {error && (
        <div className="mb-4 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>
      )}

      <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold">Todos</h2>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="sm:hidden bg-gray-200 text-gray-800 px-3 py-2 rounded hover:bg-gray-300 text-sm"
          >
            {filtersOpen ? "Hide Filters" : "Filters"}
            {activeFilterCount > 0 && ` (${activeFilterCount})`}
          </button>

          <button
            onClick={() => setShowDone((prev) => !prev)}
            className="bg-gray-200 text-gray-800 px-3 sm:px-4 py-2 rounded hover:bg-gray-300 text-sm sm:text-base"
          >
            {showDone ? "Hide Done" : "Show Done"}
          </button>

          <button
            onClick={resetFormAndOpenModal}
            className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-blue-700 text-sm sm:text-base"
          >
            + Add ToDo
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 mb-2 -mx-1 px-1">
        {SCOPES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => changeScope(key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm border transition ${
              scope === key ? "bg-blue-600 text-white border-transparent" : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            {label}
            <span className={`ml-1.5 text-xs ${scope === key ? "opacity-80" : "text-gray-500"}`}>
              {scopeCounts[key]}
            </span>
          </button>
        ))}
      </div>

      <div className="sm:sticky top-0 bg-gray-50 z-10 sm:pt-2 pb-2 sm:pb-4">
        <div
          className={`${
            filtersOpen ? "grid" : "hidden"
          } sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6`}
        >
          <select
            name="position"
            value={filters.position}
            onChange={handleFilterChange}
            className="p-2 border rounded"
          >
            <option value="All">All Statuses</option>
            <option value="todo">Todo</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          <select
            name="project"
            value={filters.project}
            onChange={handleFilterChange}
            className="p-2 border rounded"
          >
            <option value="All">All Projects</option>
            {projects.map((proj) => (
              <option key={proj.documentId || proj.id} value={proj.documentId || proj.id}>
                {proj.name}
              </option>
            ))}
          </select>

          <select
            name="assignee"
            value={filters.assignee}
            onChange={handleFilterChange}
            className="p-2 border rounded"
          >
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

          <input
            type="date"
            name="dateFrom"
            value={filters.dateFrom}
            onChange={handleFilterChange}
            className="p-2 border rounded"
          />
          <input
            type="date"
            name="dateTo"
            value={filters.dateTo}
            onChange={handleFilterChange}
            className="p-2 border rounded"
          />
        </div>
      </div>

      {["todo", "in-progress", "done"].map((status) => {
        const sectionTodos = paginatedTodos.filter((t) => t.position === status);

        if (!sectionTodos.length) return null;

        return (
          <div key={status} className="mb-6">
            <h3 className="text-lg font-bold capitalize mb-2">{status}</h3>

            <ul className="space-y-2">
              {sectionTodos.map((todo) => (
                <li
                  key={todo.id}
                  className={`group border p-3 rounded ${getTodoColor(
                    todo.position
                  )} transition hover:shadow-md`}
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold break-words">{todo.title}</div>

                      <div className="text-sm text-gray-600 whitespace-pre-line break-words">
                        {todo.description}
                      </div>

                      <div className="font-bold text-xs text-gray-500 mt-1">
                        Project: {todo.project?.name || "N/A"} | Assignee:{" "}
                        {todo.assignee?.username || "N/A"}
                      </div>

                      <div className="mt-1">
                        <span className={getStatusBadge(todo.position)}>{todo.position}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          Due: {todo.dueDate || "N/A"}
                        </span>
                      </div>

                      {todo.descriptionHistory && (
                        <div className="mt-2 bg-gray-100 p-2 rounded text-xs whitespace-pre-line">
                          <strong>Description History:</strong>
                          <br />
                          {todo.descriptionHistory}
                        </div>
                      )}

                      {todo.photos?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {todo.photos.map((photo, index) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => openPhotoViewer(todo.photos, index)}
                              className="focus:outline-none"
                            >
                              <img
                                src={normalizePhotoUrl(photo.url)}
                                alt={photo.name || "todo"}
                                className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded border hover:opacity-90 cursor-pointer"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 sm:gap-2 border-t pt-2 sm:border-0 sm:pt-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition shrink-0">
                      <button
                        onClick={() => exportSingleTodoToPdf(todo)}
                        className="text-purple-600 text-sm"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={() => handleEdit(todo)}
                        className="text-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(todo.documentId)}
                        className="text-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {filteredTodos.length > 0 && (
        <div className="flex justify-center mt-6 gap-2 items-center text-sm sm:text-base">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Prev
          </button>

          <span className="px-3 py-1">
            Page {currentPage} / {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-4 sm:p-6 relative my-4 sm:my-0">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>

            <h2 className="text-xl font-semibold mb-4">
              {editingTodoDocId ? "Edit ToDo" : "Add ToDo"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                placeholder="Title"
                className="w-full p-2 border rounded"
              />

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                required
                placeholder="Main description"
                className="w-full p-2 border rounded"
              />

              <div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add to description history..."
                    className="w-full p-2 border rounded"
                    value={form.historyNote}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, historyNote: e.target.value }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!form.historyNote.trim()) return;
                      const timestamp = new Date().toLocaleString();
                      const newEntry = `[${timestamp}] ${form.historyNote.trim()}`;
                      setForm((prev) => ({
                        ...prev,
                        descriptionHistory: prev.descriptionHistory
                          ? `${prev.descriptionHistory}\n${newEntry}`
                          : newEntry,
                        historyNote: "",
                      }));
                    }}
                    title={form.historyNote.trim() ? "Add this note to the history" : "Type a note first"}
                    className={`px-3 py-1 rounded transition ${
                      form.historyNote.trim()
                        ? "bg-red-500 hover:bg-red-600 text-white ring-2 ring-red-300"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`}
                  >
                    ➕
                  </button>
                </div>

                {form.descriptionHistory && (
                  <div className="bg-gray-50 border p-2 rounded text-sm max-h-40 overflow-y-auto whitespace-pre-line">
                    <strong className="block mb-1">📜 Description History:</strong>
                    {form.descriptionHistory.split("\n").map((entry, i) => (
                      <div key={i} className="flex justify-between items-center gap-2">
                        <span>{entry}</span>
                        <button
                          type="button"
                          className="text-red-500 text-xs ml-2"
                          onClick={() => {
                            const updated = form.descriptionHistory
                              .split("\n")
                              .filter((_, idx) => idx !== i)
                              .join("\n");
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

              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              />

              <select
                name="position"
                value={form.position}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="todo">Todo</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>

              <select
                name="project"
                value={form.project}
                onChange={handleChange}
                className="w-full p-2 border rounded"
              >
                <option value="">Select Project</option>
                {projects.map((proj) => (
                  <option key={proj.documentId || proj.id} value={proj.documentId || proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>

              <select
                name="assignee"
                value={form.assignee}
                onChange={handleChange}
                required
                className="w-full p-2 border rounded"
              >
                <option value="">Assign to User *</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-sm font-medium mb-2">Photos</label>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
                    isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"
                  }`}
                >
                  <p className="text-sm text-gray-600 mb-2">
                    Drag photos here or click below to select
                  </p>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handlePhotoSelect(e.target.files)}
                    className="block w-full text-sm"
                  />
                </div>

                {selectedPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-2">New Photos</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedPhotos.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="relative">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-16 h-16 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() => removeSelectedPhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {existingPhotos.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-2">Existing Photos</div>
                    <div className="flex flex-wrap gap-2">
                      {existingPhotos.map((photo) => (
                        <div key={photo.id} className="relative">
                          <img
                            src={normalizePhotoUrl(photo.url)}
                            alt={photo.name || "todo"}
                            className="w-16 h-16 object-cover rounded border"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setExistingPhotos((prev) =>
                                prev.filter((item) => item.id !== photo.id)
                              )
                            }
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="bg-green-500 text-white px-4 py-2 rounded w-full"
              >
                {editingTodoDocId ? "Update" : "Add"} ToDo
              </button>
            </form>
          </div>
        </div>
      )}

      {photoViewerOpen && viewerPhotos.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-90 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={closePhotoViewer}
            className="absolute top-4 right-4 text-white text-3xl hover:text-gray-300"
          >
            &times;
          </button>

          {viewerPhotos.length > 1 && (
            <button
              type="button"
              onClick={showPrevPhoto}
              className="absolute left-4 md:left-8 text-white text-4xl px-3 py-2 hover:text-gray-300"
            >
              ‹
            </button>
          )}

          <div className="max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={normalizePhotoUrl(viewerPhotos[viewerIndex]?.url)}
              alt={viewerPhotos[viewerIndex]?.name || "preview"}
              className="max-w-full max-h-[75vh] object-contain rounded shadow-lg"
            />

            <div className="text-white text-sm mt-4 text-center">
              <div>{viewerPhotos[viewerIndex]?.name || `Photo ${viewerIndex + 1}`}</div>
              <div className="text-gray-300 mt-1">
                {viewerIndex + 1} / {viewerPhotos.length}
              </div>
            </div>

            {viewerPhotos.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-2">
                {viewerPhotos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setViewerIndex(index)}
                    className={`border-2 rounded ${
                      index === viewerIndex ? "border-white" : "border-transparent"
                    }`}
                  >
                    <img
                      src={normalizePhotoUrl(photo.url)}
                      alt={photo.name || `thumb-${index}`}
                      className="w-16 h-16 object-cover rounded"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {viewerPhotos.length > 1 && (
            <button
              type="button"
              onClick={showNextPhoto}
              className="absolute right-4 md:right-8 text-white text-4xl px-3 py-2 hover:text-gray-300"
            >
              ›
            </button>
          )}
        </div>
      )}
    </div>
  );
}