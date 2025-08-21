import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { CSVLink } from "react-csv";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";


export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [todos, setTodos] = useState([]);
  const [users, setUsers] = useState([]);
  const [overdue, setOverdue] = useState([]);

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/api/projects`),
      axios.get(`${API_URL}/api/todos?populate=*`),
      axios.get(`${API_URL}/api/users`),
    ]).then(([projectRes, todoRes, userRes]) => {
      const fetchedProjects = projectRes.data.data || [];
      const fetchedTodos = todoRes.data.data || [];

      const enhancedProjects = fetchedProjects.map((project) => {
        const relatedTodos = fetchedTodos.filter(
          (todo) => todo.project?.id === project.id
        );
        const allDone = relatedTodos.length > 0 && relatedTodos.every((todo) => todo.position === "done");
        const anyInProgress = relatedTodos.some((todo) => todo.position === "in-progress");
        const anyTodo = relatedTodos.some((todo) => todo.position === "todo");

        let position = "Todo";
        if (allDone) position = "Done";
        else if (anyInProgress) position = "In-Progress";
        else if (anyTodo) position = "Todo";

        return { ...project, position };
      });

      const overdueTodos = fetchedTodos.filter((todo) => {
        return todo.dueDate && new Date(todo.dueDate) < new Date() && todo.position !== "done";
      });

      setProjects(enhancedProjects);
      setTodos(fetchedTodos);
      setUsers(userRes.data || []);
      setOverdue(overdueTodos);
    });
  }, []);

  const projectStats = {
    todo: projects.filter((p) => p.position === "Todo").length,
    inProgress: projects.filter((p) => p.position === "In-Progress").length,
    done: projects.filter((p) => p.position === "Done").length,
  };

  const todoStats = {
    todo: todos.filter((t) => t.position === "todo").length,
    inProgress: todos.filter((t) => t.position === "in-progress").length,
    done: todos.filter((t) => t.position === "done").length,
  };

  const contributorStats = users.map((user) => {
    const assigned = todos.filter((t) => t.assignee?.id === user.id);
    const done = assigned.filter((t) => t.position === "done");
    return {
      name: user.username,
      total: assigned.length,
      done: done.length,
    };
  }).sort((a, b) => b.done - a.done);

  const COLORS = ["#f87171", "#60a5fa", "#4ade80"];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">🚀 Welcome, Darko</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard label="📁 Projects - Todo" value={projectStats.todo} color="bg-red-100 text-red-800" />
        <StatCard label="📈 Projects - In Progress" value={projectStats.inProgress} color="bg-blue-100 text-blue-800" />
        <StatCard label="✅ Projects - Done" value={projectStats.done} color="bg-green-100 text-green-800" />
        <StatCard label="📝 Todos - Todo" value={todoStats.todo} color="bg-red-100 text-red-800" />
        <StatCard label="🔄 Todos - In Progress" value={todoStats.inProgress} color="bg-blue-100 text-blue-800" />
        <StatCard label="✔️ Todos - Done" value={todoStats.done} color="bg-green-100 text-green-800" />
        <StatCard label="👥 Users" value={users.length} color="bg-gray-100 text-gray-800" />
        <StatCard label="⏰ Overdue Tasks" value={overdue.length} color="bg-yellow-100 text-yellow-800" />
      </div>

      {/* Charts & Exports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold text-lg mb-2">ToDos Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                dataKey="value"
                data={[
                  { name: "Todo", value: todoStats.todo },
                  { name: "In Progress", value: todoStats.inProgress },
                  { name: "Done", value: todoStats.done },
                ]}
                cx="50%"
                cy="50%"
                outerRadius={60}
                label
              >
                {COLORS.map((color, index) => (
                  <Cell key={index} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded shadow col-span-2">
          <h3 className="font-semibold text-lg mb-2">Top Contributors</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contributorStats}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="done" fill="#4ade80" name="Done Tasks" />
              <Bar dataKey="total" fill="#60a5fa" name="Total Tasks" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Export */}
      <div className="mb-8">
        <CSVLink
          data={todos.map((t) => ({
            title: t.title,
            position: t.position,
            dueDate: t.dueDate,
            project: t.project?.name || "",
            assignee: t.assignee?.username || "",
          }))}
          filename="todos_export.csv"
          className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900"
        >
          ⬇️ Export Todos as CSV
        </CSVLink>
      </div>

      {/* Overdue List */}
      <div>
        <h2 className="text-xl font-semibold mb-3">⚠️ Overdue ToDos</h2>
        <ul className="space-y-2 text-sm">
          {overdue.map((todo) => (
            <li key={todo.id} className="bg-white border p-3 rounded shadow-sm">
              <strong>{todo.title}</strong> – {todo.position}
              <div className="text-xs text-red-600">Due: {todo.dueDate}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const frameRate = 20;
    const steps = duration / frameRate;
    const increment = value / steps;

    const interval = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(interval);
      } else {
        setCount(Math.ceil(start));
      }
    }, frameRate);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <div className={`p-5 rounded-lg shadow-md ${color} text-center`}>
      <div className="text-3xl font-bold">{count}</div>
      <div className="text-sm mt-1 font-medium">{label}</div>
    </div>
  );
}
