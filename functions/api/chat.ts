type UserKeys = {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
};

type ChatHistoryItem = {
  text: string;
  isUser: boolean;
};

type AIResult = {
  text: string;
  aiUsed: string;
  webSearchUsed: boolean;
};

const systemPrompt =
  "You are Kostenlos AI, a helpful, accurate, and professional AI assistant. You have access to web search results when provided. Always give complete, well-formatted answers.";

const fallbackMessage =
  "All your AI services are currently at their limit. Please wait a moment or add more API keys in Settings.";

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
    { role: "system", content: webContext ? `${systemPrompt}\n\n${webContext}` : systemPrompt },
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
          systemInstruction: { parts: [{ text: systemPrompt }] },
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

async function getAIResponse(message: string, rawKeys: UserKeys, history: ChatHistoryItem[]): Promise<AIResult> {
  const keys = cleanKeys(rawKeys);
  const context = keys.tavilyKey ? await searchWeb(message, keys.tavilyKey) : "";
  const webSearchUsed = Boolean(context);

  if (keys.groqKey) {
    const result = await tryGroq(message, history, context, keys.groqKey);
    if (result) return { text: result, aiUsed: "Groq LLaMA 70B", webSearchUsed };
  }

  if (keys.geminiKey) {
    const result = await tryGemini(message, history, context, keys.geminiKey);
    if (result) return { text: result, aiUsed: "Gemini 2.0 Flash", webSearchUsed };
  }

  if (keys.openaiKey) {
    const result = await tryOpenAI(message, history, context, keys.openaiKey);
    if (result) return { text: result, aiUsed: "OpenAI GPT-3.5 Turbo", webSearchUsed };
  }

  if (keys.mistralKey) {
    const result = await tryMistral(message, history, context, keys.mistralKey);
    if (result) return { text: result, aiUsed: "Mistral Small", webSearchUsed };
  }

  return { text: fallbackMessage, aiUsed: "none", webSearchUsed: false };
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const body = await request.json<any>();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const keys = cleanKeys(body?.keys || {});
    const history = Array.isArray(body?.history) ? recentHistory(body.history) : [];

    if (!message) {
      return json({ text: "Please enter a message.", aiUsed: "none", webSearchUsed: false }, 400);
    }

    if (!keys.groqKey && !keys.geminiKey && !keys.openaiKey && !keys.mistralKey) {
      return json({ text: "Add at least one AI provider key in Settings before chatting.", aiUsed: "none", webSearchUsed: false });
    }

    return json(await getAIResponse(message, keys, history));
  } catch {
    return json({ text: fallbackMessage, aiUsed: "none", webSearchUsed: false });
  }
};

export const onRequest: PagesFunction = async () => json({ error: "Method not allowed" }, 405);
