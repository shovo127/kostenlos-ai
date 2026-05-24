import { Client, Account, Databases } from "appwrite";

const client = new Client();

client
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject("6a11cdf800349b89e378");

export const account = new Account(client);
export const databases = new Databases(client);
export const DATABASE_ID = "6a11ce3300221a2c360f";
export const CHATS_ID = "chats";
export const KEYS_ID = "user_keys";
export const CONVERSATIONS_ID = "conversations";