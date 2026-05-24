export interface UserKeys {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
  perplexityKey?: string;
  togetherKey?: string;
  cohereKey?: string;
}

export interface ChatHistoryItem {
  text: string;
  isUser: boolean;
}

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

export interface AIResponse {
  text: string;
  aiUsed: string;
  webSearchUsed: boolean;
}

const SYSTEM_PROMPT =
  "You are Kostenlos AI, a helpful, accurate and professional AI assistant. Maintain full conversation context. When web search results are provided, use them to give current accurate answers.";

const FALLBACK_MESSAGE =
  "All your AI services are currently at their limit. Please wait a moment or add more API keys in Settings.";

const MAX_CONTEXT_TOKENS = 6000;
const RESPONSE_TOKENS = 1000;

function cleanKeys(keys: UserKeys): UserKeys {
  return {
    groqKey: keys.groqKey?.trim(),
    geminiKey: keys.geminiKey?.trim(),
    openaiKey: keys.openaiKey?.trim(),
    mistralKey: keys.mistralKey?.trim(),
    tavilyKey: keys.tavilyKey?.trim(),
    perplexityKey: keys.perplexityKey?.trim(),
    togetherKey: keys.togetherKey?.trim(),
    cohereKey: keys.cohereKey?.trim()
  };
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function shouldFailover(status: number) {
  return status === 429 || status >= 500 || status === 401 || status === 403 || status === 400;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function historyToMessages(history: ChatHistoryItem[]): ChatMessage[] {
  return history
    .filter(item => item.text.trim())
    .map(item => ({
      role: item.isUser ? "user" : "assistant",
      content: item.text.trim()
    }));
}

function summarizeOlderMessages(messages: ChatMessage[]) {
  if (messages.length === 0) return "";

  return messages
    .map(message => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
    .slice(0, 6000);
}

function buildContextMessages(message: string, history: ChatHistoryItem[] = [], webContext = ""): ChatMessage[] {
  const systemContent = webContext ? `${SYSTEM_PROMPT}\n\n${webContext}` : SYSTEM_PROMPT;
  const allHistory = historyToMessages(history);
  const currentMessage: ChatMessage = { role: "user", content: message };
  const baseTokens = estimateTokens(systemContent) + estimateTokens(message) + RESPONSE_TOKENS;
  const budget = Math.max(1200, MAX_CONTEXT_TOKENS - baseTokens);
  const selected: ChatMessage[] = [];
  let used = 0;

  for (let i = allHistory.length - 1; i >= 0; i -= 1) {
    const candidate = allHistory[i];
    const candidateTokens = estimateTokens(candidate.content);
    if (used + candidateTokens > budget) break;
    selected.unshift(candidate);
    used += candidateTokens;
  }

  const older = allHistory.slice(0, allHistory.length - selected.length);
  const summary = summarizeOlderMessages(older);
  const summaryMessage: ChatMessage[] = summary
    ? [{
        role: "system",
        content: `Earlier conversation summary, preserving context without verbatim detail:\n${summary}`
      }]
    : [];

  return [
    { role: "system", content: systemContent },
    ...summaryMessage,
    ...selected,
    currentMessage
  ];
}

function geminiContents(messages: ChatMessage[]) {
  return messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }]
    }));
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

async function tryOpenAICompatible(
  endpoint: string,
  key: string,
  model: string,
  messages: ChatMessage[],
  label: string
): Promise<AIResponse | null> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: RESPONSE_TOKENS,
        temperature: 0.7
      })
    });

    if (!res.ok || shouldFailover(res.status)) return null;

    const data = await safeJson(res);
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text ? { text, aiUsed: label, webSearchUsed: false } : null;
  } catch {
    return null;
  }
}

async function tryGemini(messages: ChatMessage[], key: string): Promise<AIResponse | null> {
  try {
    const system = messages.find(message => message.role === "system")?.content || SYSTEM_PROMPT;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: geminiContents(messages),
          generationConfig: {
            maxOutputTokens: RESPONSE_TOKENS,
            temperature: 0.7
          }
        })
      }
    );

    if (!res.ok || shouldFailover(res.status)) return null;

    const data = await safeJson(res);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ? { text, aiUsed: "Gemini 2.0 Flash", webSearchUsed: false } : null;
  } catch {
    return null;
  }
}

async function tryCohere(message: string, history: ChatHistoryItem[], webContext: string, key: string): Promise<AIResponse | null> {
  try {
    const chatHistory = historyToMessages(history).slice(-20).map(item => ({
      role: item.role === "assistant" ? "CHATBOT" : "USER",
      message: item.content
    }));

    const res = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "command-r-plus",
        preamble: webContext ? `${SYSTEM_PROMPT}\n\n${webContext}` : SYSTEM_PROMPT,
        message,
        chat_history: chatHistory,
        temperature: 0.7
      })
    });

    if (!res.ok || shouldFailover(res.status)) return null;

    const data = await safeJson(res);
    const text = data?.text?.trim();
    return text ? { text, aiUsed: "Cohere Command R+", webSearchUsed: false } : null;
  } catch {
    return null;
  }
}

async function runFailover(message: string, keys: UserKeys, history: ChatHistoryItem[], webContext: string): Promise<AIResponse> {
  const messages = buildContextMessages(message, history, webContext);
  const providers: Array<() => Promise<AIResponse | null>> = [];

  if (keys.groqKey) {
    providers.push(
      () => tryOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", keys.groqKey!, "llama-3.3-70b-versatile", messages, "Groq LLaMA 70B"),
      () => tryOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", keys.groqKey!, "llama-3.1-8b-instant", messages, "Groq LLaMA 8B")
    );
  }
  if (keys.geminiKey) providers.push(() => tryGemini(messages, keys.geminiKey!));
  if (keys.perplexityKey) providers.push(() => tryOpenAICompatible("https://api.perplexity.ai/chat/completions", keys.perplexityKey!, "llama-3.1-sonar-large-128k-online", messages, "Perplexity Sonar"));
  if (keys.togetherKey) providers.push(() => tryOpenAICompatible("https://api.together.xyz/v1/chat/completions", keys.togetherKey!, "meta-llama/Llama-3-70b-chat-hf", messages, "Together LLaMA 70B"));
  if (keys.cohereKey) providers.push(() => tryCohere(message, history, webContext, keys.cohereKey!));
  if (keys.openaiKey) providers.push(() => tryOpenAICompatible("https://api.openai.com/v1/chat/completions", keys.openaiKey!, "gpt-3.5-turbo", messages, "OpenAI GPT-3.5 Turbo"));
  if (keys.mistralKey) providers.push(() => tryOpenAICompatible("https://api.mistral.ai/v1/chat/completions", keys.mistralKey!, "mistral-small-latest", messages, "Mistral Small"));

  for (const provider of providers) {
    const result = await provider();
    if (result?.text) {
      return { ...result, webSearchUsed: Boolean(webContext) };
    }
  }

  return { text: FALLBACK_MESSAGE, aiUsed: "none", webSearchUsed: false };
}

async function getBrowserAIResponse(message: string, keys: UserKeys, history: ChatHistoryItem[]): Promise<AIResponse> {
  const safeKeys = cleanKeys(keys);
  const webContext = safeKeys.tavilyKey ? await searchWeb(message, safeKeys.tavilyKey) : "";
  return runFailover(message, safeKeys, history, webContext);
}

export async function getAIResponse(message: string, keys: UserKeys, history: ChatHistoryItem[] = []): Promise<AIResponse> {
  const workerUrl = process.env.REACT_APP_AI_WORKER_URL || "/api/chat";
  const safeHistory = history.filter(item => item.text.trim());

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
    // Local CRA dev can run without Cloudflare Pages Functions.
  }

  try {
    return await getBrowserAIResponse(message, keys, safeHistory);
  } catch {
    return { text: FALLBACK_MESSAGE, aiUsed: "none", webSearchUsed: false };
  }
}

export async function generateConversationTitle(firstMessage: string, keys: UserKeys): Promise<string> {
  const result = await getBrowserAIResponse(
    `Generate a short 4-6 word title for this conversation.\nUser asked: ${firstMessage}\nReply with ONLY the title, nothing else.`,
    keys,
    []
  );

  return result.text
    .replace(/^["']|["']$/g, "")
    .replace(/[.\n\r]/g, "")
    .trim()
    .slice(0, 60) || firstMessage.slice(0, 40);
}
