import { ID } from "appwrite";
import { account } from "./appwrite";

export async function signUp(email: string, password: string, name: string) {
  await account.create(ID.unique(), email, password, name);
  await account.createEmailPasswordSession(email, password);
  await account.createVerification(window.location.origin + "/verify");
}

export async function signIn(email: string, password: string) {
  await account.createEmailPasswordSession(email, password);
}

export async function signOut() {
  await account.deleteSession("current");
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}
