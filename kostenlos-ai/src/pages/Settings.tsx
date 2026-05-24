import React, { useState, useEffect } from "react";
import { databases, DATABASE_ID, KEYS_ID } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";
import { ID, Query } from "appwrite";

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState({
    groqKey: "",
    geminiKey: "",
    openaiKey: "",
    mistralKey: "",
    tavilyKey: ""
  });
  const [docId, setDocId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadKeys() {
      try {
        const res = await databases.listDocuments(DATABASE_ID, KEYS_ID, [
          Query.equal("userId", user.$id)
        ]);
        if (res.documents.length > 0) {
          const doc = res.documents[0];
          setDocId(doc.$id);
          setKeys({
            groqKey: doc.groqKey || "",
            geminiKey: doc.geminiKey || "",
            openaiKey: doc.openaiKey || "",
            mistralKey: doc.mistralKey || "",
            tavilyKey: doc.tavilyKey || ""
          });
        }
      } catch {}
    }
    if (user) loadKeys();
  }, [user]);

  async function saveKeys() {
    setSaving(true);
    setMessage("");
    try {
      const data = {
        userId: user.$id,
        groqKey: keys.groqKey,
        geminiKey: keys.geminiKey,
        openaiKey: keys.openaiKey,
        mistralKey: keys.mistralKey,
        tavilyKey: keys.tavilyKey
      };
      if (docId) {
        await databases.updateDocument(DATABASE_ID, KEYS_ID, docId, data);
      } else {
        const doc = await databases.createDocument(DATABASE_ID, KEYS_ID, ID.unique(), data);
        setDocId(doc.$id);
      }
      setMessage("Keys saved successfully!");
    } catch (err: any) {
      setMessage("Error: " + err.message);
    }
    setSaving(false);
  }

  const fields = [
    { key: "groqKey", label: "Groq API Key", placeholder: "gsk_...", hint: "Free at console.groq.com" },
    { key: "geminiKey", label: "Gemini API Key", placeholder: "AIzaSy...", hint: "Free at aistudio.google.com" },
    { key: "openaiKey", label: "OpenAI API Key", placeholder: "sk-...", hint: "platform.openai.com" },
    { key: "mistralKey", label: "Mistral API Key", placeholder: "...", hint: "Free at console.mistral.ai" },
    { key: "tavilyKey", label: "Tavily Search Key", placeholder: "tvly-...", hint: "Free at tavily.com" }
  ];

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">API Keys Settings</h1>
        <p className="text-gray-400 mb-6">Add at least one AI key to start using Kostenlos AI. Your keys are encrypted and private.</p>
        <div className="space-y-4">
          {fields.map(field => (
            <div key={field.key} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <label className="text-white font-medium block mb-1">{field.label}</label>
              <p className="text-gray-500 text-sm mb-2">{field.hint}</p>
              <input
                type="password"
                placeholder={field.placeholder}
                value={keys[field.key as keyof typeof keys]}
                onChange={e => setKeys(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
              />
            </div>
          ))}
        </div>
        {message && (
          <p className={"mt-4 text-sm " + (message.includes("Error") ? "text-red-400" : "text-green-400")}>
            {message}
          </p>
        )}
        <button
          onClick={saveKeys}
          disabled={saving}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save API Keys"}
        </button>
      </div>
    </div>
  );
}