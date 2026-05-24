import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import BrandLogo from "../components/BrandLogo";
import { signIn, signUp } from "../lib/auth";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { refreshUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 text-gray-100">
      <div className="w-full max-w-md animate-[fadeIn_420ms_ease-out]">
        <div className="bg-gray-900/95 rounded-2xl p-6 sm:p-8 border border-gray-800 shadow-2xl shadow-black/40">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="text-3xl font-bold text-white">Kostenlos AI</h1>
            <p className="text-gray-400 mt-2">Your Free Multi-AI Assistant</p>
          </div>

          <div className="grid grid-cols-2 rounded-xl bg-gray-950 p-1 mb-6 border border-gray-800">
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsSignUp(false);
              }}
              className={`rounded-lg py-2 text-sm font-medium transition ${!isSignUp ? "bg-gray-800 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsSignUp(true);
              }}
              className={`rounded-lg py-2 text-sm font-medium transition ${isSignUp ? "bg-gray-800 text-white shadow" : "text-gray-400 hover:text-white"}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <input
                type="text"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
                required
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 pr-12 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-red-300 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3 font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-5 text-sm">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                setError("");
                setIsSignUp(!isSignUp);
              }}
              className="text-blue-300 ml-1 hover:text-blue-200 hover:underline"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-gray-500">
          Use your own free API keys from Groq, Gemini, Mistral and more. Your keys stay private and encrypted.
        </p>
      </div>
    </div>
  );
}
