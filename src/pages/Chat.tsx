import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Clipboard, Check, Code2, FileText, Lightbulb, LogOut, Paperclip, Plus, Search, Settings as SettingsIcon } from "lucide-react";
import { ID, Permission, Query, Role } from "appwrite";
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "../lib/auth";
import { databases, DATABASE_ID, CHATS_ID, CONVERSATIONS_ID, KEYS_ID } from "../lib/appwrite";
import { ChatHistoryItem, getAIResponse, UserKeys } from "../lib/aiService";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  aiUsed?: string;
  webSearchUsed?: boolean;
  timestamp?: string;
}

interface Conversation {
  id: string;
  title: string;
  lastUpdated: string;
}

const emptyKeys: UserKeys = {
  groqKey: "",
  geminiKey: "",
  openaiKey: "",
  mistralKey: "",
  tavilyKey: ""
};

const examplePrompts = [
  { icon: Lightbulb, text: "Brainstorm 10 startup ideas using free AI tools." },
  { icon: FileText, text: "Write a polished product launch email for Kostenlos AI." },
  { icon: Code2, text: "Explain this TypeScript error and show the fixed code." },
  { icon: Search, text: "Summarize the latest AI news using web search context." }
];

function hasAiProviderKey(keys: UserKeys | null) {
  return Boolean(keys?.groqKey || keys?.geminiKey || keys?.openaiKey || keys?.mistralKey);
}

function documentPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.write(Role.user(userId))
  ];
}

function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";

  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "now";
  if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  if (diff < 7 * day) {
    const days = Math.floor(diff / day);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function messageTime(value?: string) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function truncateTitle(title: string) {
  return title.length > 30 ? `${title.slice(0, 30)}...` : title;
}

function toHistory(messages: Message[]): ChatHistoryItem[] {
  return messages.slice(-10).map(message => ({
    text: message.text,
    isUser: message.isUser
  }));
}

export default function Chat() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<UserKeys | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasKeys = useMemo(() => hasAiProviderKey(userKeys), [userKeys]);
  const remainingCharacters = 8000 - input.length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadUserKeys = useCallback(async () => {
    if (!user) return;

    try {
      const res = await databases.listDocuments(DATABASE_ID, KEYS_ID, [
        Query.equal("userId", user.$id),
        Query.limit(1)
      ]);

      if (res.documents.length === 0) {
        setUserKeys(emptyKeys);
        return;
      }

      const doc = res.documents[0];
      setUserKeys({
        groqKey: doc.groqKey || "",
        geminiKey: doc.geminiKey || "",
        openaiKey: doc.openaiKey || "",
        mistralKey: doc.mistralKey || "",
        tavilyKey: doc.tavilyKey || ""
      });
    } catch {
      setUserKeys(emptyKeys);
      setStatusMessage("Unable to load API keys. Check your Appwrite permissions.");
    }
  }, [user]);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      const res = await databases.listDocuments(DATABASE_ID, CONVERSATIONS_ID, [
        Query.equal("userId", user.$id),
        Query.orderDesc("lastUpdated"),
        Query.limit(50)
      ]);

      setConversations(
        res.documents.map(doc => ({
          id: doc.$id,
          title: doc.title || "Untitled chat",
          lastUpdated: doc.lastUpdated || doc.$updatedAt
        }))
      );
    } catch {
      setStatusMessage("Unable to load conversation history.");
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadUserKeys();
    }
  }, [loadConversations, loadUserKeys, user]);

  const loadConversationMessages = useCallback(async (convId: string) => {
    if (!user) return;

    setLoadingHistory(true);
    setStatusMessage("");
    try {
      const res = await databases.listDocuments(DATABASE_ID, CHATS_ID, [
        Query.equal("userId", user.$id),
        Query.equal("conversationId", convId),
        Query.orderAsc("$createdAt"),
        Query.limit(100)
      ]);

      const loadedMessages: Message[] = [];
      res.documents.forEach(doc => {
        loadedMessages.push({ id: `${doc.$id}_u`, text: doc.message || "", isUser: true, timestamp: doc.timestamp || doc.$createdAt });
        loadedMessages.push({
          id: `${doc.$id}_a`,
          text: doc.response || "",
          isUser: false,
          aiUsed: doc.aiUsed || "none",
          timestamp: doc.timestamp || doc.$createdAt
        });
      });

      setMessages(loadedMessages);
      setCurrentConvId(convId);
    } catch {
      setStatusMessage("Unable to load that conversation.");
    } finally {
      setLoadingHistory(false);
    }
  }, [user]);

  function startNewConversation(prompt = "") {
    setMessages([]);
    setCurrentConvId(null);
    setStatusMessage("");
    setInput(prompt);
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  async function copyMessage(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setStatusMessage("Unable to copy that message.");
    }
  }

  async function sendMessage() {
    if (!user || !input.trim() || loading || remainingCharacters < 0) return;

    if (!hasKeys || !userKeys) {
      setStatusMessage("Add your API keys in Settings to start chatting. It's free!");
      return;
    }

    const userMessage = input.trim();
    const history = toHistory(messages);
    const sentAt = new Date().toISOString();
    const optimisticUserMessage: Message = {
      id: `local_${Date.now()}`,
      text: userMessage,
      isUser: true,
      timestamp: sentAt
    };

    setInput("");
    setLoading(true);
    setStatusMessage("");
    setMessages(prev => [...prev, optimisticUserMessage]);

    try {
      const aiResponse = await getAIResponse(userMessage, userKeys, history);
      const aiMessage: Message = {
        id: `local_${Date.now() + 1}`,
        text: aiResponse.text,
        isUser: false,
        aiUsed: aiResponse.aiUsed,
        webSearchUsed: aiResponse.webSearchUsed,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

      let convId = currentConvId;
      const now = new Date().toISOString();

      if (!convId) {
        const conv = await databases.createDocument(
          DATABASE_ID,
          CONVERSATIONS_ID,
          ID.unique(),
          {
            userId: user.$id,
            title: userMessage.slice(0, 60),
            lastUpdated: now
          },
          documentPermissions(user.$id)
        );
        convId = conv.$id;
        setCurrentConvId(convId);
      } else {
        await databases.updateDocument(DATABASE_ID, CONVERSATIONS_ID, convId, {
          lastUpdated: now
        });
      }

      await databases.createDocument(
        DATABASE_ID,
        CHATS_ID,
        ID.unique(),
        {
          userId: user.$id,
          conversationId: convId,
          message: userMessage,
          response: aiResponse.text,
          aiUsed: aiResponse.aiUsed,
          timestamp: now
        },
        documentPermissions(user.$id)
      );

      await loadConversations();
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          text: "I could answer, but saving the chat failed. Please check your connection and Appwrite permissions.",
          isUser: false,
          aiUsed: "none",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-gray-950 text-gray-100">
      <aside className="hidden md:flex w-80 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <BrandLogo size="sm" />
          <div>
            <h1 className="text-white font-bold text-lg">Kostenlos AI</h1>
            <p className="text-gray-500 text-xs">Your Free Multi-AI Assistant</p>
          </div>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => startNewConversation()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            <Plus size={17} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              type="button"
              onClick={() => loadConversationMessages(conv.id)}
              className={
                "w-full text-left p-3 rounded-xl text-sm mb-1 transition " +
                (currentConvId === conv.id ? "bg-blue-950/70 text-white border border-blue-700/70 shadow-sm shadow-blue-950/30" : "text-gray-400 hover:bg-gray-800/80 hover:text-gray-200")
              }
              title={conv.title}
            >
              <span className="block truncate font-medium">{truncateTitle(conv.title)}</span>
              <span className="text-xs text-gray-500">{relativeTime(conv.lastUpdated)}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-gray-800 p-3 space-y-3">
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/settings" className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition">
              <SettingsIcon size={15} />
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-white bg-gray-950 hover:bg-gray-800 rounded-lg py-2 text-sm transition"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden border-b border-gray-800 bg-gray-900 p-3 flex items-center justify-between gap-3">
          <button type="button" onClick={() => startNewConversation()} className="text-sm text-blue-300">
            New
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <BrandLogo size="sm" />
            <h1 className="text-white font-semibold truncate">Kostenlos AI</h1>
          </div>
          <Link to="/settings" className="text-sm text-blue-300">
            Keys
          </Link>
        </div>

        {!hasKeys && (
          <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-3 text-center">
            <p className="text-yellow-100 text-sm">
              ⚠️ Add your API keys in <Link to="/settings" className="underline font-semibold">Settings</Link> to start chatting. It's free!
            </p>
          </div>
        )}

        {statusMessage && (
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 text-center">
            <p className="text-gray-300 text-sm">{statusMessage}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 && !loadingHistory && (
            <div className="flex items-center justify-center min-h-full">
              <div className="text-center max-w-2xl animate-[fadeIn_420ms_ease-out]">
                <div className="flex justify-center mb-5">
                  <BrandLogo size="lg" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-3">Welcome to Kostenlos AI</h2>
                <p className="text-gray-400 mb-6">Bring your own free API keys. Kostenlos AI keeps the same conversation alive even when it switches providers.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {examplePrompts.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => setInput(text)}
                      className="rounded-xl border border-gray-800 bg-gray-900 p-4 text-left text-sm text-gray-300 hover:border-blue-700 hover:bg-gray-800 transition"
                    >
                      <Icon size={18} className="mb-3 text-blue-300" />
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loadingHistory && <p className="text-center text-gray-500 text-sm">Loading conversation...</p>}

          {messages.map(msg => (
            <div key={msg.id} className={"flex gap-3 animate-[fadeIn_260ms_ease-out] " + (msg.isUser ? "justify-end" : "justify-start")}>
              {!msg.isUser && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                  K
                </div>
              )}
              <div className={"max-w-[min(44rem,86vw)] " + (msg.isUser ? "items-end" : "items-start")}>
                <div className={"rounded-2xl px-4 py-3 shadow-lg shadow-black/10 " + (msg.isUser ? "bg-blue-600 text-white rounded-br-md" : "bg-gray-800 text-gray-100 border border-gray-700/70 rounded-bl-md")}>
                  {!msg.isUser && (
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {msg.aiUsed && msg.aiUsed !== "none" && (
                        <span className="rounded-full border border-emerald-700/60 bg-emerald-950/70 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          via {msg.aiUsed}
                        </span>
                      )}
                      {msg.webSearchUsed && (
                        <span className="rounded-full border border-blue-700/60 bg-blue-950/60 px-2 py-0.5 text-xs text-blue-200">
                          Web search used
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => copyMessage(msg)}
                        className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition"
                        aria-label="Copy AI response"
                      >
                        {copiedMessageId === msg.id ? <Check size={13} /> : <Clipboard size={13} />}
                        {copiedMessageId === msg.id ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                  {msg.isUser ? (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown
                        components={{
                          code({ className, children, ...props }) {
                            const inline = !className;
                            return inline ? (
                              <code className="rounded bg-gray-950 px-1 py-0.5 font-mono text-blue-200" {...props}>
                                {children}
                              </code>
                            ) : (
                              <code className={`${className || ""} font-mono text-sm text-gray-100`} {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                <div className={"mt-1 text-xs text-gray-500 " + (msg.isUser ? "text-right" : "text-left")}>{messageTime(msg.timestamp)}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-center animate-[fadeIn_260ms_ease-out]">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 sm:p-4 border-t border-gray-800 bg-gray-950">
          <div className="rounded-full border border-gray-800 bg-gray-900 p-2 shadow-2xl shadow-black/20">
            <div className="flex gap-2">
              <button
                type="button"
                className="h-11 w-11 shrink-0 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition"
                aria-label="Attach file"
                title="File upload coming soon"
              >
                <Paperclip size={19} className="mx-auto" />
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 8000))}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask Kostenlos AI anything..."
                rows={1}
                disabled={loading}
                className="min-h-11 max-h-36 flex-1 resize-none bg-transparent text-white px-2 py-2.5 focus:outline-none disabled:opacity-50 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !input.trim() || remainingCharacters < 0}
                className="h-11 w-11 shrink-0 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
                aria-label="Send message"
              >
                <ArrowUp size={20} className="mx-auto" />
              </button>
            </div>
            <div className="flex justify-end px-2 pb-1">
              <span className={`text-xs ${remainingCharacters < 0 ? "text-red-300" : "text-gray-500"}`}>
                {input.length}/8000
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
