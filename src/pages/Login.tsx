import React, { useState } from "react";
import { signIn, signUp } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { setUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSignUp) {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
      const { getCurrentUser } = await import("../lib/auth");
      const user = await getCurrentUser();
      setUser(user);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C16 4 8 8 8 16C8 20 10 23 13 25L16 28L19 25C22 23 24 20 24 16C24 8 16 4 16 4Z" fill="white" opacity="0.9"/>
              <circle cx="16" cy="16" r="3" fill="white"/>
              <path d="M16 4L18 10L16 9L14 10Z" fill="white" opacity="0.6"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Kostenlos AI</h1>
          <p className="text-gray-400 mt-2 text-sm">Your Free Multi-AI Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="name" className="text-gray-400 text-sm block mb-1">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
                required
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-gray-400 text-sm block mb-1">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="text-gray-400 text-sm block mb-1">Password</label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 pr-12 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-400 hover:text-white transition"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-xl px-4 py-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Please wait...
              </>
            ) : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-400 mt-4 text-sm">
          {isSignUp ? "Already have an account?" : "Don t have an account?"}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
            className="text-blue-400 ml-1 hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>

        <div className="mt-6 p-4 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-xs text-center">
            Use your own free API keys from Groq, Gemini, Mistral and more.
            Your keys are private, encrypted and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}