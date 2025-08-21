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

      return { ...project, position: newPosition };
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


  const handleClone = (proj) => {
    setForm({
      name: `${proj.name} (Copy)` || "",
      description: proj.description || "",
      clients: proj.clients?.map((c) => c.documentId) || [],
      startDate: proj.startDate || "",
      endDate: proj.endDate || "",
    });
    setEditingProjectId(null);
    setModalOpen(true);
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
              <li key={proj.documentId} className={`border p-4 rounded shadow cursor-pointer transition ${getStatusColor(proj.position)}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg">{proj.name}</h3>
                    <p className="text-sm text-gray-600">{proj.description}</p>
                    <p className="text-sm text-gray-800 mt-1">
                      Clients: {proj.clients?.map((c) => c.Client).join(", ") || "N/A"}
                    </p>
                    <p className="text-sm text-gray-800">Start: {proj.startDate} - End: {proj.endDate}</p>
                    <p className="text-sm mt-1">
                      📝 Todos: {projectTodos.length} | ✅ Done: {statusCount["done"] || 0} | 🔄 In Progress: {statusCount["in-progress"] || 0} | 📌 Todo: {statusCount["todo"] || 0}
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
                        <button onClick={() => handleEdit(proj)} className="text-blue-600 text-sm underline">Edit</button>
                        <button onClick={() => handleClone(proj)} className="text-yellow-600 text-sm underline">Clone</button>
                        <button onClick={() => handleDelete(proj.documentId)} className="text-red-600 text-sm underline">Delete</button>
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
              onSubmit={(e) => {
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

                fetch(url, {
                  method: editingProjectId ? "PUT" : "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ data: payload }),
                })
                  .then(() => fetchAllData())
                  .then(() => {
                    setModalOpen(false);
                    setForm({ name: "", description: "", clients: [], startDate: "", endDate: "" });
                    setEditingProjectId(null);
                  })
                  .catch(console.error);
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
