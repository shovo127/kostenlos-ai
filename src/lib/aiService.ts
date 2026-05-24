export interface UserKeys {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
}

export interface ChatHistoryItem {
  text: string;
  isUser: boolean;
}

export interface AIResponse {
  text: string;
  aiUsed: string;
  webSearchUsed: boolean;
}

const SYSTEM_PROMPT =
  "You are Kostenlos AI, a helpful, accurate, and professional AI assistant. You have access to web search results when provided. Always give complete, well-formatted answers.";

const FALLBACK_MESSAGE =
  "All your AI services are currently at their limit. Please wait a moment or add more API keys in Settings.";

function cleanKeys(keys: UserKeys): UserKeys {
  return {
    groqKey: keys.groqKey?.trim(),
    geminiKey: keys.geminiKey?.trim(),
    openaiKey: keys.openaiKey?.trim(),
    mistralKey: keys.mistralKey?.trim(),
    tavilyKey: keys.tavilyKey?.trim()
  };
}

function recentHistory(history: ChatHistoryItem[] = []) {
  return history.slice(-10).filter(item => item.text.trim());
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function searchWeb(query: string, tavilyKey: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: 3,
        search_depth: "basic"
      })
    });

    if (!res.ok) return "";

    const data = await safeJson(res);
    const results =
      data?.results
        ?.map((result: any) => `${result.title}: ${result.content}`)
        .filter(Boolean)
        .join("\n") || "";

    return results ? `Web search results:\n${results}` : "";
  } catch {
    return "";
  }
}

function openAiMessages(message: string, history: ChatHistoryItem[], webContext: string) {
  return [
    { role: "system", content: webContext ? `${SYSTEM_PROMPT}\n\n${webContext}` : SYSTEM_PROMPT },
    ...recentHistory(history).map(item => ({
      role: item.isUser ? "user" : "assistant",
      content: item.text
    })),
    { role: "user", content: message }
  ];
}

function geminiContents(message: string, history: ChatHistoryItem[], webContext: string) {
  const contents = recentHistory(history).map(item => ({
    role: item.isUser ? "user" : "model",
    parts: [{ text: item.text }]
  }));

  contents.push({
    role: "user",
    parts: [{ text: webContext ? `${webContext}\n\n${message}` : message }]
  });

  return contents;
}

async function tryGroq(message: string, history: ChatHistoryItem[], context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: openAiMessages(message, history, context),
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!res.ok) return null;

    const data = await safeJson(res);
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function tryGemini(message: string, history: ChatHistoryItem[], context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiContents(message, history, context),
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7
          }
        })
      }
    );

    if (!res.ok) return null;

    const data = await safeJson(res);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function tryOpenAI(message: string, history: ChatHistoryItem[], context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: openAiMessages(message, history, context),
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!res.ok) return null;

    const data = await safeJson(res);
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function tryMistral(message: string, history: ChatHistoryItem[], context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: openAiMessages(message, history, context),
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!res.ok) return null;

    const data = await safeJson(res);
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function getBrowserAIResponse(message: string, keys: UserKeys, history: ChatHistoryItem[]): Promise<AIResponse> {
  const safeKeys = cleanKeys(keys);
  const context = safeKeys.tavilyKey ? await searchWeb(message, safeKeys.tavilyKey) : "";
  const webSearchUsed = Boolean(context);

  if (safeKeys.groqKey) {
    const result = await tryGroq(message, history, context, safeKeys.groqKey);
    if (result) return { text: result, aiUsed: "Groq LLaMA 70B", webSearchUsed };
  }

  if (safeKeys.geminiKey) {
    const result = await tryGemini(message, history, context, safeKeys.geminiKey);
    if (result) return { text: result, aiUsed: "Gemini 2.0 Flash", webSearchUsed };
  }

  if (safeKeys.openaiKey) {
    const result = await tryOpenAI(message, history, context, safeKeys.openaiKey);
    if (result) return { text: result, aiUsed: "OpenAI GPT-3.5 Turbo", webSearchUsed };
  }

  if (safeKeys.mistralKey) {
    const result = await tryMistral(message, history, context, safeKeys.mistralKey);
    if (result) return { text: result, aiUsed: "Mistral Small", webSearchUsed };
  }

  return { text: FALLBACK_MESSAGE, aiUsed: "none", webSearchUsed: false };
}

export async function getAIResponse(message: string, keys: UserKeys, history: ChatHistoryItem[] = []): Promise<AIResponse> {
  const workerUrl = process.env.REACT_APP_AI_WORKER_URL || "/api/chat";
  const safeHistory = recentHistory(history);

  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, keys: cleanKeys(keys), history: safeHistory })
    });

    if (res.ok) {
      const data = await safeJson(res);
      if (data?.text) {
        return {
          text: data.text,
          aiUsed: data.aiUsed || "none",
          webSearchUsed: Boolean(data.webSearchUsed)
        };
      }
    }
  } catch {
    // In local CRA dev without Cloudflare Pages Functions, fall back to browser calls.
  }

  return getBrowserAIResponse(message, keys, safeHistory);
}
