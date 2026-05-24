import { Account, Client, Databases } from "appwrite";

const client = new Client();

client
  .setEndpoint(process.env.REACT_APP_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
  .setProject(process.env.REACT_APP_APPWRITE_PROJECT_ID || "");

export const account = new Account(client);
export const databases = new Databases(client);
export const DATABASE_ID = process.env.REACT_APP_APPWRITE_DATABASE_ID || "";
export const CHATS_ID = process.env.REACT_APP_APPWRITE_CHATS_ID || "";
export const KEYS_ID = process.env.REACT_APP_APPWRITE_KEYS_ID || "";
export const CONVERSATIONS_ID = process.env.REACT_APP_APPWRITE_CONVERSATIONS_ID || "";
