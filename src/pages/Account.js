import { useContext, useState } from "react";
import { api } from "../services/http";
import { AuthContext } from "../context/AuthContext";

export default function Account() {
  const { user, role, signIn } = useContext(AuthContext);
  const [form, setForm] = useState({ currentPassword: "", password: "", passwordConfirmation: "" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    if (form.password.length < 8) return setNotice({ type: "error", text: "Use at least 8 characters." });
    if (form.password !== form.passwordConfirmation)
      return setNotice({ type: "error", text: "The new passwords don't match." });

    setLoading(true);
    try {
      const { data } = await api.post("/auth/change-password", form);
      // the response contains a fresh token
      if (data?.jwt) await signIn(data.jwt, data.user || user);
      setForm({ currentPassword: "", password: "", passwordConfirmation: "" });
      setNotice({ type: "ok", text: "Password changed." });
    } catch (err) {
      const msg = err?.response?.data?.error?.message || "";
      setNotice({
        type: "error",
        text: /current password/i.test(msg) ? "The current password is wrong." : "Could not change the password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-2 sm:p-6 max-w-md">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4">My account</h2>

      <div className="bg-white border rounded p-4 mb-6 text-sm space-y-1">
        <div>
          <span className="text-gray-500">Username:</span> {user?.username}
        </div>
        <div>
          <span className="text-gray-500">E-mail:</span> {user?.email}
        </div>
        <div>
          <span className="text-gray-500">Role:</span> {role}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2">Change password</h3>
      {notice && (
        <div
          className={`mb-3 p-2 rounded text-sm ${
            notice.type === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
          }`}
        >
          {notice.text}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={form.currentPassword}
          onChange={set("currentPassword")}
          required
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password (min. 8 characters)"
          value={form.password}
          onChange={set("password")}
          required
          className="w-full p-2 border rounded"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Repeat new password"
          value={form.passwordConfirmation}
          onChange={set("passwordConfirmation")}
          required
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
