import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import Logo from "../components/Logo";
import { databases, DATABASE_ID, KEYS_ID } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";

type UserKeys = {
  groqKey: string;
  geminiKey: string;
  openaiKey: string;
  mistralKey: string;
  tavilyKey: string;
  perplexityKey: string;
  togetherKey: string;
  cohereKey: string;
};

type KeyField = {
  key: keyof UserKeys;
  label: string;
  placeholder: string;
  url: string;
  linkText: string;
  freeTier: string;
  color: string;
  section: "AI Providers" | "Web Search";
};

const emptyKeys: UserKeys = {
  groqKey: "",
  geminiKey: "",
  openaiKey: "",
  mistralKey: "",
  tavilyKey: "",
  perplexityKey: "",
  togetherKey: "",
  cohereKey: ""
};

function documentPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.write(Role.user(userId))
  ];
}

export default function Settings() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<UserKeys>(emptyKeys);
  const [docId, setDocId] = useState<string | null>(null);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [visibleFields, setVisibleFields] = useState<Partial<Record<keyof UserKeys, boolean>>>({});

  const fields: KeyField[] = useMemo(() => [
    {
      key: "groqKey",
      label: "Groq API Key",
      placeholder: "gsk_...",
      url: "https://console.groq.com",
      linkText: "Get free at console.groq.com",
      freeTier: "Free: 14,400 requests/day",
      color: "bg-emerald-400",
      section: "AI Providers"
    },
    {
      key: "geminiKey",
      label: "Gemini API Key",
      placeholder: "AIzaSy...",
      url: "https://aistudio.google.com",
      linkText: "Get free at aistudio.google.com",
      freeTier: "Free: 1,500 requests/day",
      color: "bg-blue-400",
      section: "AI Providers"
    },
    {
      key: "perplexityKey",
      label: "Perplexity API Key",
      placeholder: "pplx-...",
      url: "https://www.perplexity.ai/settings/api",
      linkText: "Get free key at perplexity.ai",
      freeTier: "Free tier available",
      color: "bg-indigo-400",
      section: "AI Providers"
    },
    {
      key: "togetherKey",
      label: "Together AI Key",
      placeholder: "...",
      url: "https://api.together.xyz",
      linkText: "Get key at api.together.xyz",
      freeTier: "$1 free credit",
      color: "bg-purple-400",
      section: "AI Providers"
    },
    {
      key: "cohereKey",
      label: "Cohere API Key",
      placeholder: "...",
      url: "https://dashboard.cohere.com",
      linkText: "Get free key at dashboard.cohere.ai",
      freeTier: "Free tier: 1000 calls/month",
      color: "bg-pink-400",
      section: "AI Providers"
    },
    {
      key: "openaiKey",
      label: "OpenAI API Key",
      placeholder: "sk-...",
      url: "https://platform.openai.com",
      linkText: "Get at platform.openai.com",
      freeTier: "Pay per use",
      color: "bg-slate-300",
      section: "AI Providers"
    },
    {
      key: "mistralKey",
      label: "Mistral API Key",
      placeholder: "...",
      url: "https://console.mistral.ai",
      linkText: "Get free at console.mistral.ai",
      freeTier: "Free tier available",
      color: "bg-orange-300",
      section: "AI Providers"
    },
    {
      key: "tavilyKey",
      label: "Tavily Search Key",
      placeholder: "tvly-...",
      url: "https://tavily.com",
      linkText: "Get free at tavily.com",
      freeTier: "Free: 1,000 searches/month",
      color: "bg-cyan-300",
      section: "Web Search"
    }
  ], []);

  const aiFields = fields.filter(field => field.section === "AI Providers");
  const searchFields = fields.filter(field => field.section === "Web Search");

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
          tavilyKey: doc.tavilyKey || "",
          perplexityKey: doc.perplexityKey || "",
          togetherKey: doc.togetherKey || "",
          cohereKey: doc.cohereKey || ""
        });
      } else {
        setDocId(null);
        setKeys(emptyKeys);
      }
    } catch (err: any) {
      setMessage("Error: " + (err?.message || "Unable to load API keys."));
    } finally {
      setLoadingKeys(false);
    }
  }, [user]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    if (!message) return;

    const timeout = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveKeys() {
    if (!user) return;

    const trimmedKeys: UserKeys = {
      groqKey: keys.groqKey.trim(),
      geminiKey: keys.geminiKey.trim(),
      openaiKey: keys.openaiKey.trim(),
      mistralKey: keys.mistralKey.trim(),
      tavilyKey: keys.tavilyKey.trim(),
      perplexityKey: keys.perplexityKey.trim(),
      togetherKey: keys.togetherKey.trim(),
      cohereKey: keys.cohereKey.trim()
    };

    const hasAiKey = Boolean(
      trimmedKeys.groqKey ||
      trimmedKeys.geminiKey ||
      trimmedKeys.perplexityKey ||
      trimmedKeys.togetherKey ||
      trimmedKeys.cohereKey ||
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
        const doc = await databases.createDocument(DATABASE_ID, KEYS_ID, ID.unique(), data, documentPermissions(user.$id));
        setDocId(doc.$id);
      }

      setKeys(trimmedKeys);
      setMessage("Keys saved successfully.");
    } catch (err: any) {
      setMessage("Error: " + (err?.message || "Unable to save API keys."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 sm:p-6 text-gray-100">
      {message && (
        <div className={"fixed right-4 top-4 z-20 rounded-xl border px-4 py-3 text-sm shadow-2xl shadow-black/30 " + (message.startsWith("Error") ? "border-red-800 bg-red-950 text-red-200" : "border-emerald-800 bg-emerald-950 text-emerald-200")}>
          {message}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 mb-6">
          <ArrowLeft size={16} />
          Back to chat
        </Link>

        <div className="flex items-start gap-4 mb-8">
          <Logo size={48} />
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">API Keys & Settings</h1>
            <p className="text-gray-400 max-w-2xl leading-6">
              Kostenlos AI uses YOUR API keys directly. We never see your keys - they are encrypted and stored securely.
              Add at least one AI key to start chatting for free.
            </p>
          </div>
        </div>

        {loadingKeys && <p className="text-gray-400 mb-4">Loading saved keys...</p>}

        {[
          { title: "AI Providers", items: aiFields },
          { title: "Web Search", items: searchFields }
        ].map(section => (
          <div key={section.title} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{section.title}</h2>
            <div className="grid gap-4">
              {section.items.map(field => {
                const saved = Boolean(keys[field.key]);
                const visible = Boolean(visibleFields[field.key]);

                return (
                  <section key={field.key} className="rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-xl shadow-black/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 h-3 w-3 rounded-full ${field.color}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{field.label}</h3>
                            {saved && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/60 bg-emerald-950/60 px-2 py-0.5 text-xs text-emerald-300">
                                <Check size={12} />
                                Saved
                              </span>
                            )}
                          </div>
                          <a href={field.url} target="_blank" rel="noreferrer" className="text-sm text-blue-300 hover:text-blue-200 hover:underline">
                            {field.linkText}
                          </a>
                          <p className="mt-1 text-sm text-gray-500">{field.freeTier}</p>
                        </div>
                      </div>
                    </div>

                    <div className="relative mt-4">
                      <input
                        type={visible ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={keys[field.key]}
                        onChange={e => setKeys(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 pr-12 border border-gray-700 focus:outline-none focus:border-blue-500 transition"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setVisibleFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                        aria-label={visible ? `Hide ${field.label}` : `Show ${field.label}`}
                      >
                        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={saveKeys}
          disabled={saving || loadingKeys}
          className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? "Saving..." : "Save API Keys"}
        </button>

        <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="text-lg font-semibold text-white mb-2">How auto-failover works</h2>
          <p className="text-gray-400 leading-6">
            When your Groq limit runs out, we automatically switch to Gemini, then OpenAI, then Mistral - all in the same chat without interruption.
            You always get an answer, and the last 10 messages are sent to each provider so context stays intact.
          </p>
        </section>
      </div>
    </div>
  );
}
