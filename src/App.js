import React, { useContext, useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import TodosPage from "./pages/Todos";
import Kanban from "./pages/Kanban";
import Timeline from "./pages/Timeline";
import Calendar from "./pages/Calendar";
import Recurring from "./pages/Recurring";
import Report from "./pages/Report";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";
import { AuthContext } from "./context/AuthContext";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";
import NotificationToggle from "./components/NotificationToggle";
import { disablePush } from "./services/push";

// who may open what: "all", "bo" (manager + specialist) or "manager"
const PAGES = [
  { path: "/", label: "Dashboard", access: "all", element: <Dashboard /> },
  { path: "/todos", label: "Todo's", access: "all", element: <TodosPage /> },
  { path: "/calendar", label: "Calendar", access: "all", element: <Calendar /> },
  { path: "/projects", label: "Projects", access: "bo", element: <Projects /> },
  { path: "/timeline", label: "Timeline", access: "bo", element: <Timeline /> },
  { path: "/kanban", label: "Kanban", access: "manager", element: <Kanban /> },
  { path: "/recurring", label: "Recurring", access: "manager", element: <Recurring /> },
  { path: "/report", label: "Report", access: "manager", element: <Report /> },
];

export default function App() {
  const { token, role, user, logout } = useContext(AuthContext);
  const superUser = role?.toLowerCase() === "backoffice manager";
  const backofficeSpecialist = role?.toLowerCase() === "backoffice specialist";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const canSee = (access) =>
    access === "all" || (access === "bo" && (superUser || backofficeSpecialist)) || (access === "manager" && superUser);
  const visible = PAGES.filter((p) => canSee(p.access));

  const handleLogout = async () => {
    // stop alerts for this user on this device
    try {
      await disablePush(token);
    } catch {
      // ignore – logout must always work
    }
    logout();
    navigate("/login");
  };

  const linkClass = (mobile) => ({ isActive }) =>
    mobile
      ? `font-medium py-2 px-2 rounded hover:bg-gray-100 ${isActive ? "text-blue-600 bg-gray-100" : "text-gray-700"}`
      : `font-medium pb-0.5 border-b-2 transition ${
          isActive ? "text-blue-600 border-blue-500" : "text-gray-600 border-transparent hover:text-blue-600"
        }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {token && (
        <nav className="bg-white shadow px-4 py-3 mb-4 sm:mb-6">
          <div className="container mx-auto flex justify-between items-center gap-4">
            {/* Mobile / tablet bar */}
            <div className="lg:hidden flex items-center justify-between w-full">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="text-gray-700 focus:outline-none p-1 -ml-1"
              >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <span className="text-sm font-semibold text-gray-800 truncate px-2">
                {user?.username || user?.email || "User"}
              </span>
              <div className="flex items-center">
                <NotificationToggle />
                <ThemeToggle />
              </div>
            </div>

            {/* Desktop links */}
            <div className="hidden lg:flex gap-5">
              {visible.map((p) => (
                <NavLink key={p.path} to={p.path} end={p.path === "/"} className={linkClass(false)}>
                  {p.label}
                </NavLink>
              ))}
            </div>

            {/* User info */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center">
                <NotificationToggle />
                <ThemeToggle />
              </div>
              <span className="text-sm text-gray-700">👋 {user?.username || user?.email || "User"}</span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">{role}</span>
              <button onClick={handleLogout} className="text-sm text-red-500 underline">
                Logout
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div className="lg:hidden mt-3 flex flex-col gap-1 border-t pt-3">
              {visible.map((p) => (
                <NavLink
                  key={p.path}
                  to={p.path}
                  end={p.path === "/"}
                  onClick={() => setMenuOpen(false)}
                  className={linkClass(true)}
                >
                  {p.label}
                </NavLink>
              ))}
              <div className="flex items-center gap-3 mt-2 pt-3 border-t px-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">{role}</span>
                <button onClick={handleLogout} className="text-sm text-red-500 underline ml-auto">
                  Logout
                </button>
              </div>
            </div>
          )}
        </nav>
      )}

      <main className="container mx-auto px-3 sm:px-4 pb-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          {PAGES.map((p) => (
            <Route
              key={p.path}
              path={p.path}
              element={<PrivateRoute>{canSee(p.access) ? p.element : <Dashboard />}</PrivateRoute>}
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}
