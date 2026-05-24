# Kostenlos AI

Kostenlos AI is a bring-your-own-key multi-AI chat app. Users sign up, save their own provider keys in Appwrite, and chat with automatic failover across Groq, Gemini, OpenAI, and Mistral. Tavily can be used to add web-search context to answers.

## Stack

- React, TypeScript, Tailwind CSS
- Appwrite Auth and Databases
- Cloudflare Pages with a Pages Function at `/api/chat`

## Local Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start the app with `npm start`.

Required environment variables:

```bash
REACT_APP_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
REACT_APP_APPWRITE_PROJECT_ID=6a11cdf800349b89e378
REACT_APP_APPWRITE_DATABASE_ID=6a11ce3300221a2c360f
REACT_APP_APPWRITE_CHATS_ID=chats
REACT_APP_APPWRITE_KEYS_ID=user_keys
REACT_APP_APPWRITE_CONVERSATIONS_ID=conversations
```

`REACT_APP_AI_WORKER_URL` is optional and defaults to `/api/chat` for Cloudflare Pages.

## Appwrite Collections

Enable document-level security on these collections so the owner permissions applied by the app are enforced:

- `chats`: `userId`, `message`, `response`, `timestamp`, `conversationId`, `aiUsed`
- `user_keys`: `userId`, `groqKey`, `geminiKey`, `openaiKey`, `mistralKey`, `tavilyKey`
- `conversations`: `userId`, `title`, `lastUpdated`

The app creates documents with owner-only read, update, and delete permissions.

## Scripts

```bash
npm start
npm test
npm run build
```

Cloudflare Pages build command: `npm run build`

Cloudflare Pages output directory: `build`
