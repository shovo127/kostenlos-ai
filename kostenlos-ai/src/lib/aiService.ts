interface UserKeys {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
  mistralKey?: string;
  tavilyKey?: string;
}

interface AIResponse {
  text: string;
  aiUsed: string;
}

async function searchWeb(query: string, tavilyKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: tavilyKey, query, max_results: 3 })
    });
    const data = await res.json();
    const results = data.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n') || '';
    return results ? `Web Search Results:\n${results}\n\n` : '';
  } catch {
    return '';
  }
}

async function tryGroq(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are Kostenlos AI, a helpful assistant.' },
          { role: 'user', content: context + message }
        ],
        max_tokens: 1000
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function tryGemini(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: context + message }] }]
        })
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch { return null; }
}

async function tryOpenAI(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are Kostenlos AI, a helpful assistant.' },
          { role: 'user', content: context + message }
        ],
        max_tokens: 1000
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

async function tryMistral(message: string, context: string, key: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: 'You are Kostenlos AI, a helpful assistant.' },
          { role: 'user', content: context + message }
        ],
        max_tokens: 1000
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

export async function getAIResponse(message: string, keys: UserKeys): Promise<AIResponse> {
  let context = '';

  if (keys.tavilyKey) {
    context = await searchWeb(message, keys.tavilyKey);
  }

  if (keys.groqKey) {
    const result = await tryGroq(message, context, keys.groqKey);
    if (result) return { text: result, aiUsed: 'Groq LLaMA 70B' };
  }

  if (keys.geminiKey) {
    const result = await tryGemini(message, context, keys.geminiKey);
    if (result) return { text: result, aiUsed: 'Gemini 2.0 Flash' };
  }

  if (keys.openaiKey) {
    const result = await tryOpenAI(message, context, keys.openaiKey);
    if (result) return { text: result, aiUsed: 'OpenAI GPT' };
  }

  if (keys.mistralKey) {
    const result = await tryMistral(message, context, keys.mistralKey);
    if (result) return { text: result, aiUsed: 'Mistral' };
  }

  return {
    text: 'All your AI services are currently busy. Please try again in a moment or add more API keys in Settings.',
    aiUsed: 'none'
  };
}
