import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Use at least 8 characters for the password.");
    if (form.password !== form.confirm) return setError("The passwords don't match.");

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/team/register`, {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setDone(true);
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 429
          ? "Too many attempts. Try again in a few minutes."
          : err?.response?.data?.error?.message || "Could not create the account."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2 text-center">Create account</h2>

        {done ? (
          <div className="text-sm text-gray-700 text-center space-y-3">
            <p>✅ Your account has been created.</p>
            <p>A manager needs to approve it before you can log in. You'll be able to log in with your e-mail or username as soon as that's done.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm text-gray-600 mb-4 text-center">
              After you sign up, a manager approves your account.
            </p>
            {error && <div className="mb-3 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}
            <input
              value={form.username}
              onChange={set("username")}
              autoComplete="username"
              placeholder="Name (e.g. Ivan Horvat)"
              minLength={3}
              required
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              placeholder="Work e-mail"
              required
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              placeholder="Password (min. 8 characters)"
              required
              className="w-full mb-3 p-2 border rounded"
            />
            <input
              type="password"
              value={form.confirm}
              onChange={set("confirm")}
              autoComplete="new-password"
              placeholder="Repeat password"
              required
              className="w-full mb-4 p-2 border rounded"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create account"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-blue-600 hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
