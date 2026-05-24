import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { databases, DATABASE_ID, KEYS_ID } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";
import { ID, Permission, Query, Role } from "appwrite";

type UserKeys = {
  groqKey: string;
  geminiKey: string;
  openaiKey: string;
  mistralKey: string;
  tavilyKey: string;
};

type KeyField = {
  key: keyof UserKeys;
  label: string;
  placeholder: string;
  hint: string;
};

const emptyKeys: UserKeys = {
  groqKey: "",
  geminiKey: "",
  openaiKey: "",
  mistralKey: "",
  tavilyKey: ""
};

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserKeys>(emptyKeys);
  const [docId, setDocId] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fields: KeyField[] = useMemo(() => [
    { key: "groqKey", label: "Groq API Key", placeholder: "gsk_...", hint: "Free tier at console.groq.com" },
    { key: "geminiKey", label: "Gemini API Key", placeholder: "AIzaSy...", hint: "Free tier at aistudio.google.com" },
    { key: "openaiKey", label: "OpenAI API Key", placeholder: "sk-...", hint: "Create one at platform.openai.com" },
    { key: "mistralKey", label: "Mistral API Key", placeholder: "...", hint: "Free tier at console.mistral.ai" },
    { key: "tavilyKey", label: "Tavily Search Key", placeholder: "tvly-...", hint: "Optional web search context at tavily.com" }
  ], []);

  const loadKeys = useCallback(async () => {
    if (!user) return;

    setLoadingKeys(true);
    setMessage("");
    try {
      const res = await databases.listDocuments(DATABASE_ID, KEYS_ID, [
        Query.equal("userId", user.$id),
        Query.limit(1)
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
      } else {
        setDocId(null);
        setKeys(emptyKeys);
      }
    } catch (err: any) {
      setMessage(err?.message || "Unable to load API keys.");
    } finally {
      setLoadingKeys(false);
    }
  }, [user]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  async function saveKeys() {
    if (!user) return;

    const trimmedKeys: UserKeys = {
      groqKey: keys.groqKey.trim(),
      geminiKey: keys.geminiKey.trim(),
      openaiKey: keys.openaiKey.trim(),
      mistralKey: keys.mistralKey.trim(),
      tavilyKey: keys.tavilyKey.trim()
    };

    const hasAiKey = Boolean(
      trimmedKeys.groqKey ||
      trimmedKeys.geminiKey ||
      trimmedKeys.openaiKey ||
      trimmedKeys.mistralKey
    );

    if (!hasAiKey) {
      setMessage("Error: Add at least one AI provider key. Tavily is optional search context.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const data = {
        userId: user.$id,
        ...trimmedKeys
      };

      if (docId) {
        await databases.updateDocument(DATABASE_ID, KEYS_ID, docId, data);
      } else {
        const doc = await databases.createDocument(DATABASE_ID, KEYS_ID, ID.unique(), data, [
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id))
        ]);
        setDocId(doc.$id);
      }
      setKeys(trimmedKeys);
      setMessage("Keys saved successfully!");
    } catch (err: any) {
      setMessage("Error: " + (err?.message || "Unable to save API keys."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">API Keys Settings</h1>
            <p className="text-gray-400">Add at least one AI key. Tavily is optional for web search context.</p>
          </div>
          <Link to="/" className="shrink-0 text-sm text-blue-300 hover:text-blue-200">
            Back to chat
          </Link>
        </div>

        {loadingKeys && <p className="text-gray-400 mb-4">Loading saved keys...</p>}

        <div className="space-y-4">
          {fields.map(field => (
            <div key={field.key} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <label className="text-white font-medium block mb-1">{field.label}</label>
              <p className="text-gray-500 text-sm mb-2">{field.hint}</p>
              <input
                type="password"
                placeholder={field.placeholder}
                value={keys[field.key]}
                onChange={e => setKeys(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
                autoComplete="off"
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
          disabled={saving || loadingKeys}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save API Keys"}
        </button>
      </div>
    </div>
  );
}
