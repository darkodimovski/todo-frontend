import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setToken, setUser, setRole } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Step 1: Authenticate
      const res = await axios.post("http://localhost:1337/api/auth/local", {
        identifier: email,
        password,
      });

      const { jwt, user } = res.data;
      setToken(jwt);

      // Step 2: Fetch full user details (with role)
      const fullUserRes = await axios.get(
        `http://localhost:1337/api/users/${user.id}?populate=role`,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        }
      );

      const fullUser = fullUserRes.data;
      const roleName = fullUser.role?.name?.toLowerCase() || "authenticated";

      setUser(fullUser);
      setRole(roleName);

      console.log("Logged in as:", fullUser.username, "| Role:", roleName);

      navigate("/");
    } catch (err) {
      alert("Login failed! Check your credentials.");
      console.error("Login error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded shadow w-full max-w-sm"
      >
        <h2 className="text-xl font-bold mb-4 text-center">🔐 Login</h2>
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-600 text-white py-2 rounded ${
            loading ? "opacity-50" : "hover:bg-blue-700"
          } transition`}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>
    </div>
  );
}
