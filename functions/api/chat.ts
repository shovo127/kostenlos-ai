type UserKeys = {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
};

type AIResult = {
  text: string;
  aiUsed: string;
};

const fallbackMessage =
  "All configured AI providers are unavailable right now. Please try again in a moment or add another API key in Settings.";

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

async function getAIResponse(message: string, rawKeys: UserKeys): Promise<AIResult> {
  const keys = cleanKeys(rawKeys);
  let context = "";

  if (keys.tavilyKey) {
    context = await searchWeb(message, keys.tavilyKey);
  }

  if (keys.groqKey) {
    const result = await tryGroq(message, context, keys.groqKey);
    if (result) return { text: result, aiUsed: "Groq LLaMA 70B" };
  }

  if (keys.geminiKey) {
    const result = await tryGemini(message, context, keys.geminiKey);
    if (result) return { text: result, aiUsed: "Gemini 2.0 Flash" };
  }

  if (keys.openaiKey) {
    const result = await tryOpenAI(message, context, keys.openaiKey);
    if (result) return { text: result, aiUsed: "OpenAI GPT-3.5 Turbo" };
  }

  if (keys.mistralKey) {
    const result = await tryMistral(message, context, keys.mistralKey);
    if (result) return { text: result, aiUsed: "Mistral Small" };
  }

  return { text: fallbackMessage, aiUsed: "none" };
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  try {
    const body = await request.json<any>();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const keys = cleanKeys(body?.keys || {});

    if (!message) {
      return json({ text: "Please enter a message.", aiUsed: "none" }, 400);
    }

    if (!keys.groqKey && !keys.geminiKey && !keys.openaiKey && !keys.mistralKey) {
      return json({ text: "Add at least one AI provider key in Settings before chatting.", aiUsed: "none" });
    }

    return json(await getAIResponse(message, keys));
  } catch {
    return json({ text: fallbackMessage, aiUsed: "none" });
  }
};

export const onRequest: PagesFunction = async () => json({ error: "Method not allowed" }, 405);
