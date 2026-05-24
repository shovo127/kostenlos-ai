import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ID, Permission, Query, Role } from "appwrite";
import { useAuth } from "../contexts/AuthContext";
import { signOut } from "../lib/auth";
import { databases, DATABASE_ID, CHATS_ID, CONVERSATIONS_ID, KEYS_ID } from "../lib/appwrite";
import { getAIResponse, UserKeys } from "../lib/aiService";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  aiUsed?: string;
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

function hasAiProviderKey(keys: UserKeys | null) {
  return Boolean(keys?.groqKey || keys?.geminiKey || keys?.openaiKey || keys?.mistralKey);
}

function documentPermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId))
  ];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasKeys = useMemo(() => hasAiProviderKey(userKeys), [userKeys]);

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
        loadedMessages.push({ id: `${doc.$id}_u`, text: doc.message || "", isUser: true });
        loadedMessages.push({
          id: `${doc.$id}_a`,
          text: doc.response || "",
          isUser: false,
          aiUsed: doc.aiUsed || "none"
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

  function startNewConversation() {
    setMessages([]);
    setCurrentConvId(null);
    setStatusMessage("");
    setInput("");
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  async function sendMessage() {
    if (!user || !input.trim() || loading) return;

    if (!hasKeys || !userKeys) {
      setStatusMessage("Add at least one AI provider key in Settings before chatting.");
      return;
    }

    const userMessage = input.trim();
    const optimisticUserMessage: Message = {
      id: `local_${Date.now()}`,
      text: userMessage,
      isUser: true
    };

    setInput("");
    setLoading(true);
    setStatusMessage("");
    setMessages(prev => [...prev, optimisticUserMessage]);

    try {
      const aiResponse = await getAIResponse(userMessage, userKeys);
      const aiMessage: Message = {
        id: `local_${Date.now() + 1}`,
        text: aiResponse.text,
        isUser: false,
        aiUsed: aiResponse.aiUsed
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
          aiUsed: "none"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <aside className="hidden md:flex w-72 bg-gray-900 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-white font-bold text-lg">Kostenlos AI</h1>
          <p className="text-gray-500 text-xs">Multi-AI Assistant</p>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={startNewConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition"
          >
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
                "w-full text-left p-2 rounded-lg text-sm mb-1 transition truncate " +
                (currentConvId === conv.id ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800")
              }
              title={conv.title}
            >
              {conv.title}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-gray-800 space-y-2">
          <Link to="/settings" className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition">
            Settings / API Keys
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-center text-gray-400 hover:text-white rounded-lg py-2 text-sm transition"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden border-b border-gray-800 bg-gray-900 p-3 flex items-center justify-between gap-3">
          <button type="button" onClick={startNewConversation} className="text-sm text-blue-300">
            New
          </button>
          <h1 className="text-white font-semibold truncate">Kostenlos AI</h1>
          <Link to="/settings" className="text-sm text-blue-300">
            Keys
          </Link>
        </div>

        {!hasKeys && (
          <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-3 text-center">
            <p className="text-yellow-200 text-sm">
              Add at least one AI key in <Link to="/settings" className="underline font-semibold">Settings</Link> to start chatting.
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
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Kostenlos AI</h2>
                <p className="text-gray-400">Bring your own API keys and chat with automatic provider failover.</p>
              </div>
            </div>
          )}

          {loadingHistory && <p className="text-center text-gray-500 text-sm">Loading conversation...</p>}

          {messages.map(msg => (
            <div key={msg.id} className={"flex " + (msg.isUser ? "justify-end" : "justify-start")}>
              <div className={"max-w-[min(42rem,85vw)] rounded-2xl px-4 py-3 " + (msg.isUser ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-100")}>
                {!msg.isUser && msg.aiUsed && msg.aiUsed !== "none" && (
                  <p className="text-xs text-gray-400 mb-1">via {msg.aiUsed}</p>
                )}
                <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 sm:p-4 border-t border-gray-800 bg-gray-950">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask anything..."
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 sm:px-6 py-3 font-semibold transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
