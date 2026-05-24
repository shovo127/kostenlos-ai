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
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      if (isSignUp) {
        await signUp(email, password, name);
      } else {
        await signIn(email, password);
      }
      const { getCurrentUser } = await import("../lib/auth");
      const user = await getCurrentUser();
      if (isSignUp) {
        setError("");
        setLoading(false);
        setSuccessMessage("Check your email to verify your account");
        setIsSignUp(false);
        return;
      }
      setUser(user);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800 shadow-2xl animate-[fadeIn_420ms_ease-out]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4">
            <svg width="64" height="64" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#3B82F6"/>
                  <stop offset="100%" stopColor="#8B5CF6"/>
                </linearGradient>
              </defs>
              <rect width="40" height="40" rx="12" fill="url(#grad)"/>
              <circle cx="20" cy="15" r="5" fill="white"/>
              <circle cx="11" cy="26" r="3.5" fill="white" opacity="0.9"/>
              <circle cx="20" cy="29" r="3.5" fill="white" opacity="0.9"/>
              <circle cx="29" cy="26" r="3.5" fill="white" opacity="0.9"/>
              <line x1="20" y1="20" x2="11" y2="26" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="20" y1="20" x2="20" y2="29" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              <line x1="20" y1="20" x2="29" y2="26" stroke="white" strokeWidth="1.5" opacity="0.6"/>
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

          {successMessage && (
            <div className="bg-emerald-950 border border-emerald-800 rounded-xl px-4 py-3">
              <p className="text-emerald-300 text-sm">{successMessage}</p>
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
            onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccessMessage(""); }}
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
