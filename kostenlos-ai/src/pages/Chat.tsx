import React, { useState, useEffect, useRef } from "react";
import { databases, DATABASE_ID, CHATS_ID, CONVERSATIONS_ID, KEYS_ID } from "../lib/appwrite";
import { useAuth } from "../contexts/AuthContext";
import { getAIResponse } from "../lib/aiService";
import { ID, Query } from "appwrite";

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

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<any>(null);
  const [hasKeys, setHasKeys] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadUserKeys();
    }
  }, [user]);

  async function loadUserKeys() {
    try {
      const res = await databases.listDocuments(DATABASE_ID, KEYS_ID, [
        Query.equal("userId", user.$id)
      ]);
      if (res.documents.length > 0) {
        const doc = res.documents[0];
        const keys = {
          groqKey: doc.groqKey || "",
          geminiKey: doc.geminiKey || "",
          openaiKey: doc.openaiKey || "",
          mistralKey: doc.mistralKey || "",
          tavilyKey: doc.tavilyKey || ""
        };
        setUserKeys(keys);
        const hasAnyKey = Object.values(keys).some(k => k !== "");
        setHasKeys(hasAnyKey);
      }
    } catch {}
  }

  async function loadConversations() {
    try {
      const res = await databases.listDocuments(DATABASE_ID, CONVERSATIONS_ID, [
        Query.equal("userId", user.$id),
        Query.orderDesc("lastUpdated")
      ]);
      setConversations(res.documents.map(d => ({
        id: d.$id,
        title: d.title,
        lastUpdated: d.lastUpdated
      })));
    } catch {}
  }

  async function loadConversationMessages(convId: string) {
    try {
      const res = await databases.listDocuments(DATABASE_ID, CHATS_ID, [
        Query.equal("conversationId", convId),
        Query.orderAsc("$createdAt")
      ]);
      const msgs: Message[] = [];
      res.documents.forEach(doc => {
        msgs.push({ id: doc.$id + "_u", text: doc.message, isUser: true });
        msgs.push({ id: doc.$id + "_a", text: doc.response, isUser: false, aiUsed: doc.aiUsed });
      });
      setMessages(msgs);
      setCurrentConvId(convId);
    } catch {}
  }

  async function startNewConversation() {
    setMessages([]);
    setCurrentConvId(null);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    if (!hasKeys) {
      alert("Please add at least one API key in Settings first!");
      return;
    }

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const userMsg: Message = { id: Date.now().toString(), text: userMessage, isUser: true };
    setMessages(prev => [...prev, userMsg]);

    try {
      const aiResponse = await getAIResponse(userMessage, userKeys);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.text,
        isUser: false,
        aiUsed: aiResponse.aiUsed
      };
      setMessages(prev => [...prev, aiMsg]);

      let convId = currentConvId;
      if (!convId) {
        const conv = await databases.createDocument(DATABASE_ID, CONVERSATIONS_ID, ID.unique(), {
          userId: user.$id,
          title: userMessage.slice(0, 50),
          lastUpdated: new Date().toISOString()
        });
        convId = conv.$id;
        setCurrentConvId(convId);
        loadConversations();
      } else {
        await databases.updateDocument(DATABASE_ID, CONVERSATIONS_ID, convId, {
          lastUpdated: new Date().toISOString()
        });
      }

      await databases.createDocument(DATABASE_ID, CHATS_ID, ID.unique(), {
        userId: user.$id,
        conversationId: convId,
        message: userMessage,
        response: aiResponse.text,
        aiUsed: aiResponse.aiUsed,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 2).toString(),
        text: "Error: " + err.message,
        isUser: false
      }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-white font-bold text-lg">Kostenlos AI</h1>
          <p className="text-gray-500 text-xs">Multi-AI Assistant</p>
        </div>
        <div className="p-3">
          <button
            onClick={startNewConversation}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium transition"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => loadConversationMessages(conv.id)}
              className={"w-full text-left p-2 rounded-lg text-sm mb-1 transition " + (currentConvId === conv.id ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800")}
            >
              {conv.title}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-800 space-y-2">
          <a href="/settings" className="block w-full text-center bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2 text-sm transition">
            Settings / API Keys
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {!hasKeys && (
          <div className="bg-yellow-900 border-b border-yellow-700 p-3 text-center">
            <p className="text-yellow-300 text-sm">
              Please <a href="/settings" className="underline font-semibold">add your API keys in Settings</a> to start chatting.
            </p>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to Kostenlos AI</h2>
                <p className="text-gray-400">Your free multi-AI assistant with auto-failover</p>
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={"flex " + (msg.isUser ? "justify-end" : "justify-start")}>
              <div className={"max-w-2xl rounded-2xl px-4 py-3 " + (msg.isUser ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-100")}>
                {!msg.isUser && msg.aiUsed && msg.aiUsed !== "none" && (
                  <p className="text-xs text-gray-500 mb-1">via {msg.aiUsed}</p>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay:"0.1s"}}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay:"0.2s"}}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Ask anything..."
              className="flex-1 bg-gray-800 text-white rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-semibold transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}