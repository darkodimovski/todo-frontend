import React, { useContext, useState } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import TodosPage from "./pages/Todos";
import Kanban from "./pages/Kanban";
import Timeline from "./pages/Timeline";
import Login from "./pages/Login";
import PrivateRoute from "./components/PrivateRoute";
import { AuthContext } from "./context/AuthContext";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  const { token, role, user, logout } = useContext(AuthContext);
  const superUser = role?.toLowerCase() === "backoffice manager";
  const backofficeSpecialist = role?.toLowerCase() === "backoffice specialist";
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {token && (
        <nav className="bg-white shadow px-4 py-3 mb-4 sm:mb-6">
          <div className="container mx-auto flex justify-between items-center">
            {/* Mobile menu toggle */}
            <div className="md:hidden flex items-center justify-between w-full">
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
              <ThemeToggle />
            </div>

            {/* Desktop Links */}
            <div className="hidden md:flex gap-4">
              <Link to="/" className="text-blue-600 font-medium hover:underline">Dashboard</Link>

              {(superUser || backofficeSpecialist) && (
                <Link to="/projects" className="text-blue-600 font-medium hover:underline">Projects</Link>
              )}

              <Link to="/todos" className="text-blue-600 font-medium hover:underline">Todo's</Link>

              {(superUser || backofficeSpecialist) && (
                <Link to="/timeline" className="text-blue-600 font-medium hover:underline">Timeline</Link>
              )}

              {superUser && (
                <Link to="/kanban" className="text-blue-600 font-medium hover:underline">Kanban</Link>
              )}
            </div>

            {/* User Info */}
            <div className="hidden md:flex items-center gap-4">
              <ThemeToggle />
              <span className="text-sm text-gray-700">
                👋 {user?.username || user?.email || "User"}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                {role}
              </span>
              <button onClick={handleLogout} className="text-sm text-red-500 underline">
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {menuOpen && (
            <div className="md:hidden mt-3 flex flex-col gap-1 border-t pt-3">
              <Link to="/" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium py-2 px-2 rounded hover:bg-gray-100">Dashboard</Link>
              {(superUser || backofficeSpecialist) && (
                <Link to="/projects" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium py-2 px-2 rounded hover:bg-gray-100">Projects</Link>
              )}
              <Link to="/todos" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium py-2 px-2 rounded hover:bg-gray-100">Todo's</Link>
              {(superUser || backofficeSpecialist) && (
                <Link to="/timeline" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium py-2 px-2 rounded hover:bg-gray-100">Timeline</Link>
              )}
              {superUser && (
                <Link to="/kanban" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium py-2 px-2 rounded hover:bg-gray-100">Kanban</Link>
              )}
              <div className="flex items-center gap-3 mt-2 pt-3 border-t px-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                  {role}
                </span>
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
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

          <Route
            path="/projects"
            element={
              <PrivateRoute>
                {(superUser || backofficeSpecialist) ? <Projects /> : <Dashboard />}
              </PrivateRoute>
            }
          />

          <Route path="/todos" element={<PrivateRoute><TodosPage /></PrivateRoute>} />

          <Route
            path="/timeline"
            element={
              <PrivateRoute>
                {(superUser || backofficeSpecialist) ? <Timeline /> : <Dashboard />}
              </PrivateRoute>
            }
          />

          <Route
            path="/kanban"
            element={
              <PrivateRoute>
                {superUser ? <Kanban /> : <Dashboard />}
              </PrivateRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
