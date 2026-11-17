import { useContext, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../context/AuthContext";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

/** Used both for invitations ("set your password") and "forgot password" links. */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const code = params.get("code");
  const isInvite = params.get("invite") === "1";
  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/api/auth/reset-password`, {
        code,
        password,
        passwordConfirmation: confirm,
      });
      try {
        await signIn(data.jwt, data.user);
        navigate("/");
      } catch {
        navigate("/login?reset=1");
      }
    } catch (err) {
      const msg = err?.response?.data?.error?.message || "";
      setError(
        /code/i.test(msg)
          ? "This link has already been used or is no longer valid. Ask for a new one."
          : "Could not save the password. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h2 className="text-xl font-bold mb-2 text-center">{isInvite ? "Welcome! 👋" : "Choose a new password"}</h2>

        {!code ? (
          <p className="text-sm text-gray-700 text-center">
            This link is incomplete. Open the link from the e-mail again, or{" "}
            <Link to="/forgot-password" className="text-blue-600 underline">
              request a new one
            </Link>
            .
          </p>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm text-gray-600 mb-4 text-center">
              {isInvite ? "Set your password to start using the app." : "Enter your new password twice."}
            </p>
            {error && <div className="mb-3 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password (min. 8 characters)"
              className="w-full mb-3 p-2 border rounded"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              className="w-full mb-4 p-2 border rounded"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : isInvite ? "Set password & log in" : "Save password"}
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
