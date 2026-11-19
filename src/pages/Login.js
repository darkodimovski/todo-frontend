import { useState, useContext } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API_URL}/api/auth/local`, { identifier: identifier.trim(), password });
      await signIn(res.data.jwt, res.data.user);
      navigate("/");
    } catch (err) {
      const msg = err?.response?.data?.error?.message || "";
      if (!err?.response) {
        // no answer at all: offline, or the network/firewall blocks the API address
        setError("Can't reach the server. Check your internet connection – some company networks block the app.");
      } else if (/blocked/i.test(msg)) {
        setError("Your account isn't active – it's waiting for a manager's approval or has been deactivated.");
      } else if (err.response.status === 429) {
        setError("Too many attempts. Wait a few minutes and try again.");
      } else {
        setError("Wrong e-mail/username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-center">🔐 Login</h2>

        {params.get("reset") && (
          <div className="mb-3 p-2 rounded bg-green-100 text-green-800 text-sm">
            Password saved. You can log in now.
          </div>
        )}
        {error && <div className="mb-3 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}

        <input
          type="text"
          autoComplete="username"
          placeholder="E-mail or username"
          className="w-full mb-3 p-2 border rounded"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          className="w-full mb-4 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-2 rounded ${loading ? "opacity-50" : "hover:bg-blue-700"} transition`}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/forgot-password" className="text-blue-600 hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-blue-600 hover:underline">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
