import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API_URL}/api/auth/forgot-password`, { email: email.trim() });
      setSent(true);
    } catch {
      setError("Could not send the e-mail right now. Try again later or ask your manager.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2 text-center">Forgot password</h2>

        {sent ? (
          <p className="text-sm text-gray-700 text-center">
            If <b>{email}</b> belongs to an account, we've sent a link to choose a new password. Check your inbox
            (and spam).
          </p>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Enter your e-mail and we'll send you a link to set a new password.
            </p>
            {error && <div className="mb-3 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}
            <input
              type="email"
              autoComplete="email"
              placeholder="E-mail"
              className="w-full mb-4 p-2 border rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send link"}
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
