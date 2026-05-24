type UserKeys = {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
  perplexityKey?: string;
  togetherKey?: string;
  cohereKey?: string;
};

type ChatHistoryItem = {
  text: string;
  isUser: boolean;
};

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type AIResult = {
  text: string;
  aiUsed: string;
  webSearchUsed: boolean;
};

const systemPrompt =
  "You are Kostenlos AI, a helpful, accurate and professional AI assistant. Maintain full conversation context. When web search results are provided, use them to give current accurate answers.";

const fallbackMessage =
  "All your AI services are currently at their limit. Please wait a moment or add more API keys in Settings.";

const maxContextTokens = 6000;
const responseTokens = 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

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
  return messages
    .map(message => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
    .slice(0, 6000);
}

function buildContextMessages(message: string, history: ChatHistoryItem[] = [], webContext = ""): ChatMessage[] {
  const systemContent = webContext ? `${systemPrompt}\n\n${webContext}` : systemPrompt;
  const allHistory = historyToMessages(history);
  const baseTokens = estimateTokens(systemContent) + estimateTokens(message) + responseTokens;
  const budget = Math.max(1200, maxContextTokens - baseTokens);
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

  return [
    { role: "system", content: systemContent },
    ...(summary ? [{ role: "system" as const, content: `Earlier conversation summary:\n${summary}` }] : []),
    ...selected,
    { role: "user", content: message }
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

async function tryOpenAICompatible(endpoint: string, key: string, model: string, messages: ChatMessage[], label: string): Promise<AIResult | null> {
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
        max_tokens: responseTokens,
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

async function tryGemini(messages: ChatMessage[], key: string): Promise<AIResult | null> {
  try {
    const system = messages.find(message => message.role === "system")?.content || systemPrompt;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: geminiContents(messages),
          generationConfig: {
            maxOutputTokens: responseTokens,
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

async function tryCohere(message: string, history: ChatHistoryItem[], webContext: string, key: string): Promise<AIResult | null> {
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
        preamble: webContext ? `${systemPrompt}\n\n${webContext}` : systemPrompt,
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

async function getAIResponse(message: string, rawKeys: UserKeys, history: ChatHistoryItem[]): Promise<AIResult> {
  const keys = cleanKeys(rawKeys);
  const webContext = keys.tavilyKey ? await searchWeb(message, keys.tavilyKey) : "";
  const messages = buildContextMessages(message, history, webContext);
  const providers: Array<() => Promise<AIResult | null>> = [];

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
    if (result?.text) return { ...result, webSearchUsed: Boolean(webContext) };
  }

  return { text: fallbackMessage, aiUsed: "none", webSearchUsed: false };
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const body = await request.json<any>();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const keys = cleanKeys(body?.keys || {});
    const history = Array.isArray(body?.history) ? body.history.filter((item: any) => item?.text) : [];

    if (!message) {
      return json({ text: "Please enter a message.", aiUsed: "none", webSearchUsed: false }, 400);
    }

    if (!keys.groqKey && !keys.geminiKey && !keys.perplexityKey && !keys.togetherKey && !keys.cohereKey && !keys.openaiKey && !keys.mistralKey) {
      return json({ text: "Add at least one AI provider key in Settings before chatting.", aiUsed: "none", webSearchUsed: false });
    }

    return json(await getAIResponse(message, keys, history));
  } catch {
    return json({ text: fallbackMessage, aiUsed: "none", webSearchUsed: false });
  }
};

export const onRequest: PagesFunction = async () => json({ error: "Method not allowed" }, 405);
