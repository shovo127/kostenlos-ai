export interface UserKeys {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
}

export interface AIResponse {
  text: string;
  aiUsed: string;
}

const FALLBACK_MESSAGE =
  "All configured AI providers are unavailable right now. Please try again in a moment or add another API key in Settings.";

function cleanKeys(keys: UserKeys): UserKeys {
  return {
    groqKey: keys.groqKey?.trim(),
    geminiKey: keys.geminiKey?.trim(),
    openaiKey: keys.openaiKey?.trim(),
    mistralKey: keys.mistralKey?.trim(),
    tavilyKey: keys.tavilyKey?.trim()
  };
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

    return results ? `Use these recent web results when helpful:\n${results}\n\n` : "";
  } catch {
    return "";
  }
}

async function tryGroq(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are Kostenlos AI, a helpful, concise assistant." },
          { role: "user", content: context + message }
        ],
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

async function tryGemini(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: context + message }] }],
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

async function tryOpenAI(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are Kostenlos AI, a helpful, concise assistant." },
          { role: "user", content: context + message }
        ],
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

async function tryMistral(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: "You are Kostenlos AI, a helpful, concise assistant." },
          { role: "user", content: context + message }
        ],
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

async function getBrowserAIResponse(message: string, keys: UserKeys): Promise<AIResponse> {
  const safeKeys = cleanKeys(keys);
  let context = "";

  if (safeKeys.tavilyKey) {
    context = await searchWeb(message, safeKeys.tavilyKey);
  }

  if (safeKeys.groqKey) {
    const result = await tryGroq(message, context, safeKeys.groqKey);
    if (result) return { text: result, aiUsed: "Groq LLaMA 70B" };
  }

  if (safeKeys.geminiKey) {
    const result = await tryGemini(message, context, safeKeys.geminiKey);
    if (result) return { text: result, aiUsed: "Gemini 2.0 Flash" };
  }

  if (safeKeys.openaiKey) {
    const result = await tryOpenAI(message, context, safeKeys.openaiKey);
    if (result) return { text: result, aiUsed: "OpenAI GPT-3.5 Turbo" };
  }

  if (safeKeys.mistralKey) {
    const result = await tryMistral(message, context, safeKeys.mistralKey);
    if (result) return { text: result, aiUsed: "Mistral Small" };
  }

  return { text: FALLBACK_MESSAGE, aiUsed: "none" };
}

export async function getAIResponse(message: string, keys: UserKeys): Promise<AIResponse> {
  const workerUrl = process.env.REACT_APP_AI_WORKER_URL || "/api/chat";

  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, keys: cleanKeys(keys) })
    });

    if (res.ok) {
      const data = await safeJson(res);
      if (data?.text) {
        return {
          text: data.text,
          aiUsed: data.aiUsed || "none"
        };
      }
    }
  } catch {
    // In local CRA dev without Cloudflare Pages Functions, fall back to browser calls.
  }

  return getBrowserAIResponse(message, keys);
}
