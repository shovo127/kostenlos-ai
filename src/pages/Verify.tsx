import React, { useEffect, useState } from "react";
import Logo from "../components/Logo";
import { account } from "../lib/appwrite";

export default function Verify() {
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");
    const secret = urlParams.get("secret");
    if (userId && secret) {
      account.updateVerification(userId, secret)
        .then(() => setStatus("success"))
        .catch(() => setStatus("error"));
    } else {
      setStatus("error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md border border-gray-800 text-center">
        <div className="w-16 h-16 mx-auto mb-4">
          <Logo size={64} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Kostenlos AI</h1>
        {status === "verifying" && (
          <>
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto my-4"></div>
            <p className="text-gray-400">Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto my-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-green-400 font-semibold text-lg">Email Verified!</p>
            <p className="text-gray-400 mt-2">Your account is now active.</p>
            <a href="/" className="mt-6 block w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition">
              Go to Kostenlos AI
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mx-auto my-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-red-400 font-semibold text-lg">Verification Failed</p>
            <p className="text-gray-400 mt-2">Link may be expired. Please sign up again.</p>
            <a href="/login" className="mt-6 block w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition">
              Back to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
