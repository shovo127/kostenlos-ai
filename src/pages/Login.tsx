import React, { useState } from "react";
import { signIn, signUp } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { refreshUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const trimmedEmail = email.trim();
      const trimmedName = name.trim();

      if (isSignUp) {
        await signUp(trimmedEmail, password, trimmedName);
      } else {
        await signIn(trimmedEmail, password);
      }
      await refreshUser();
    } catch (err: any) {
      setError(err?.message || "Unable to authenticate. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 w-full max-w-md border border-gray-800 shadow-2xl shadow-black/30">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Kostenlos AI</h1>
          <p className="text-gray-400 mt-2">Your free multi-AI assistant</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
            minLength={8}
            required
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>
        <p className="text-center text-gray-400 mt-4">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsSignUp(!isSignUp);
            }}
            className="text-blue-400 ml-1 hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
