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
import { Menu, X } from "lucide-react"; // You can use any icon library or SVGs

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
        <nav className="bg-white shadow p-4 mb-6">
          <div className="container mx-auto flex justify-between items-center">
            {/* Mobile menu toggle */}
            <div className="md:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="text-gray-700 focus:outline-none"
              >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
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
            <div className="md:hidden mt-4 flex flex-col gap-2 px-2">
              <Link to="/" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium hover:underline">Dashboard</Link>
              {(superUser || backofficeSpecialist) && (
                <Link to="/projects" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium hover:underline">Projects</Link>
              )}
              <Link to="/todos" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium hover:underline">Todo's</Link>
              {(superUser || backofficeSpecialist) && (
                <Link to="/timeline" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium hover:underline">Timeline</Link>
              )}
              {superUser && (
                <Link to="/kanban" onClick={() => setMenuOpen(false)} className="text-blue-600 font-medium hover:underline">Kanban</Link>
              )}
              <div className="flex items-center justify-between mt-4 px-1">
                <span className="text-sm text-gray-700">
                  👋 {user?.username || user?.email || "User"}
                </span>
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

      <main className="container mx-auto px-4">
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
