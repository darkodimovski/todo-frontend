import { useEffect, useState, useContext } from "react";
import * as XLSX from "xlsx";
import { getProjects, getClients, getTodos } from "../services/api";
import { AuthContext } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function Projects() {
  const { role, token } = useContext(AuthContext);
  const isSuperAdmin = role?.toLowerCase() === "backoffice manager";
  const [statusFilter, setStatusFilter] = useState("All");
  const [clientFilter, setClientFilter] = useState("All");
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [todos, setTodos] = useState([]);
  const [expandedProject, setExpandedProject] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    clients: [],
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleChange = (e) => {
    const { name, value, multiple, options } = e.target;
    if (multiple) {
      const values = Array.from(options).filter((o) => o.selected).map((o) => o.value);
      setForm({ ...form, [name]: values });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const fetchAllData = async () => {
    const [projectRes, clientRes, todoRes] = await Promise.all([
      getProjects(),
      getClients(),
      getTodos(),
    ]);

    const fetchedTodos = todoRes.data.data;
    const fetchedProjects = projectRes.data.data.map((project) => {
      const relatedTodos = fetchedTodos.filter((todo) => todo.project?.id === project.id);
      const allDone = relatedTodos.length > 0 && relatedTodos.every((todo) => todo.position === "done");
      const anyInProgress = relatedTodos.some((todo) => todo.position === "in-progress");
      const anyTodo = relatedTodos.some((todo) => todo.position === "todo");

      let newPosition = "Todo";
      if (allDone) newPosition = "Done";
      else if (anyInProgress) newPosition = "In-Progress";
      else if (anyTodo) newPosition = "Todo";

      return { ...project, position: newPosition, todos: relatedTodos };
    });

    setTodos(fetchedTodos);
    setProjects(fetchedProjects);
    setClients(clientRes.data.data);
  };

  const handleExportToExcel = () => {
    const exportData = [];

    projects.forEach((project) => {
      const relatedTodos = todos.filter((todo) => todo.project?.id === project.id);
      if (relatedTodos.length === 0) {
        exportData.push({
          Project: project.name,
          Description: project.description,
          Clients: project.clients?.map((c) => c.Client).join(", ") || "N/A",
          StartDate: project.startDate,
          EndDate: project.endDate,
          Position: project.position,
          TodoTitle: "",
          TodoStatus: "",
          TodoDueDate: "",
          TodoAssignee: "",
        });
      } else {
        relatedTodos.forEach((todo) => {
          exportData.push({
            Project: project.name,
            Description: project.description,
            Clients: project.clients?.map((c) => c.Client).join(", ") || "N/A",
            StartDate: project.startDate,
            EndDate: project.endDate,
            Position: project.position,
            TodoTitle: todo.title,
            TodoStatus: todo.position,
            TodoDueDate: todo.dueDate,
            TodoAssignee: todo.assignee?.username || "Unassigned",
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Projects & Todos");
    XLSX.writeFile(workbook, "projects_and_todos.xlsx");
  };

  const handleEdit = (proj) => {
    setForm({
      name: proj.name || "",
      description: proj.description || "",
      clients: proj.clients?.map((c) => c.documentId) || [],
      startDate: proj.startDate || "",
      endDate: proj.endDate || "",
    });
    setEditingProjectId(proj.documentId);
    setModalOpen(true);
  };

  const handleClone = async (proj) => {
    try {
      // Create new project first
      const newProjectRes = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            name: `${proj.name} (Copy)`,
            description: proj.description,
            clients: proj.clients.map((c) => c.documentId),
            startDate: proj.startDate,
            endDate: proj.endDate,
          },
        }),
      });
      const newProject = await newProjectRes.json();

      // Duplicate todos into new project
      const relatedTodos = todos.filter((t) => t.project?.id === proj.id);
      for (let todo of relatedTodos) {
        await fetch(`${API_URL}/api/todos`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              title: todo.title,
              description: todo.description,
              dueDate: todo.dueDate,
              position: todo.position,
              assignee: todo.assignee?.id,
              project: newProject.data.id, // link to new project
            },
          }),
        });
      }

      fetchAllData();
    } catch (err) {
      console.error("Failed to clone project:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await fetch(`${API_URL}/api/projects/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await fetchAllData();
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  const getStatusColor = (position) => {
    switch (position) {
      case "Done":
        return "bg-green-100 hover:bg-green-200";
      case "In-Progress":
        return "bg-blue-100 hover:bg-blue-200";
      case "Todo":
        return "bg-red-100 hover:bg-red-200";
      default:
        return "bg-gray-100 hover:bg-gray-200";
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="All">Status</option>
          <option value="Todo">Todo</option>
          <option value="In-Progress">In-Progress</option>
          <option value="Done">Done</option>
        </select>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="All">Clients</option>
          {clients.map((client) => (
            <option key={client.documentId} value={client.documentId}>
              {client.Client}
            </option>
          ))}
        </select>

        {isSuperAdmin && (
          <>
            <button
              onClick={handleExportToExcel}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              ⬇️ Export to Excel
            </button>
            <button
              onClick={() => {
                setForm({ name: "", description: "", clients: [], startDate: "", endDate: "" });
                setEditingProjectId(null);
                setModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              + Add Project
            </button>
          </>
        )}
      </div>

      <ul className="space-y-2">
        {projects
          .filter((proj) => {
            const matchesStatus = statusFilter === "All" || proj.position === statusFilter;
            const clientIds = proj.clients?.map((c) => c.documentId) || [];
            const matchesClient = clientFilter === "All" || clientIds.includes(clientFilter);
            return matchesStatus && matchesClient;
          })
          .map((proj) => {
            const projectTodos = todos.filter((todo) => todo.project?.id === proj.id);
            const statusCount = projectTodos.reduce((acc, todo) => {
              acc[todo.position] = (acc[todo.position] || 0) + 1;
              return acc;
            }, {});

            return (
              <li
                key={proj.documentId}
                className={`border p-4 rounded shadow cursor-pointer transition ${getStatusColor(
                  proj.position
                )}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{proj.name}</h3>
                    <p className="text-sm text-gray-600">{proj.description}</p>
                    <p className="text-sm text-gray-800 mt-1">
                      Clients: {proj.clients?.map((c) => c.Client).join(", ") || "N/A"}
                    </p>
                    <p className="text-sm text-gray-800">
                      Start: {proj.startDate} - End: {proj.endDate}
                    </p>
                    <p className="text-sm mt-1">
                      📝 Todos: {projectTodos.length} | ✅ Done: {statusCount["done"] || 0} | 🔄 In
                      Progress: {statusCount["in-progress"] || 0} | 📌 Todo: {statusCount["todo"] || 0}
                    </p>
                    <button
                      className="text-sm text-blue-600 underline mt-2"
                      onClick={() => setExpandedProject(expandedProject === proj.id ? null : proj.id)}
                    >
                      {expandedProject === proj.id ? "Hide Todos" : "Show Todos"}
                    </button>

                    {expandedProject === proj.id && (
                      <ul className="mt-2 text-sm text-gray-700 list-disc list-inside">
                        {projectTodos.map((todo) => (
                          <li key={todo.id}>
                            <strong>{todo.title}</strong> - {todo.position} (Due: {todo.dueDate})
                          </li>
                        ))}
                      </ul>
                    )}

                    {isSuperAdmin && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleEdit(proj)} className="text-blue-600 text-sm underline">
                          Edit
                        </button>
                        <button onClick={() => handleClone(proj)} className="text-yellow-600 text-sm underline">
                          Clone
                        </button>
                        <button
                          onClick={() => handleDelete(proj.documentId)}
                          className="text-red-600 text-sm underline"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
      </ul>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl"
            >
              &times;
            </button>
            <h2 className="text-xl font-semibold mb-4">
              {editingProjectId ? "Edit Project" : "Add Project"}
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();

                const url = editingProjectId
                  ? `${API_URL}/api/projects/${editingProjectId}`
                  : `${API_URL}/api/projects`;

                const payload = {
                  name: form.name,
                  description: form.description,
                  clients: form.clients,
                  startDate: form.startDate,
                  endDate: form.endDate,
                };

                // preserve todos on edit
                if (editingProjectId) {
                  const projectToEdit = projects.find((p) => p.documentId === editingProjectId);
                  if (projectToEdit?.todos) {
                    payload.todos = projectToEdit.todos.map((t) => t.documentId);
                  }
                }

                try {
                  await fetch(url, {
                    method: editingProjectId ? "PUT" : "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ data: payload }),
                  });

                  await fetchAllData();
                  setModalOpen(false);
                  setForm({ name: "", description: "", clients: [], startDate: "", endDate: "" });
                  setEditingProjectId(null);
                } catch (err) {
                  console.error("Failed to save project:", err);
                }
              }}
              className="space-y-4"
            >
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Project Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <textarea
                className="w-full border p-2 rounded"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                required
              />
                <div className="border rounded p-3 max-h-40 overflow-y-auto space-y-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Select Clients</p>
                {clients.map((client) => (
                  <label
                    key={client.documentId || client.id}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      value={client.documentId || client.id}
                      checked={form.clients.includes(client.documentId || client.id)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (form.clients.includes(value)) {
                          setForm({
                            ...form,
                            clients: form.clients.filter((c) => c !== value),
                          });
                        } else {
                          setForm({ ...form, clients: [...form.clients, value] });
                        }
                      }}
                      className="rounded text-blue-600"
                    />
                    <span className="text-gray-800">{client.Client}</span>
                  </label>
                ))}
              </div>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
              <button type="submit" className="bg-blue-600 text-white w-full py-2 rounded">
                {editingProjectId ? "Update Project" : "Create Project"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
