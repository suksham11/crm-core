import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { extractError } from "../utils/error";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.14),_transparent_34%),linear-gradient(180deg,_#f9fafb,_#eef2ff_45%,_#f9fafb)] px-4 py-8 sm:px-6 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-3xl border border-white/70 bg-white/95 p-6 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8"
      >
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-indigo-600 sm:text-4xl">
            CRM Core
          </h1>
          <p className="text-sm text-gray-500 sm:text-base">
            Sign in to your account
          </p>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
