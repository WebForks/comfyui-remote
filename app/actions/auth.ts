"use server";

import { revalidatePath } from "next/cache";

import {
  clearSessionCookie,
  getConfiguredPassword,
  isPasswordConfigured,
  readIsAuthenticated,
  setSessionCookie,
} from "@/lib/auth";

export type AuthState = {
  ok: boolean;
  message?: string;
};

const initialState: AuthState = {
  ok: false,
  message: "",
};

export async function login(
  _prevState: AuthState = initialState,
  formData: FormData,
): Promise<AuthState> {
  void _prevState;

  const providedPassword =
    (formData.get("password") as string | null)?.trim() || "";
  const configuredPassword = getConfiguredPassword();

  if (!providedPassword) {
    return {
      ok: false,
      message: "Enter the password you configured for this dashboard.",
    };
  }

  if (providedPassword !== configuredPassword) {
    return { ok: false, message: "That password does not match." };
  }

  await setSessionCookie();
  revalidatePath("/");

  return { ok: true, message: "Signed in" };
}

export async function logout() {
  await clearSessionCookie();
  revalidatePath("/");
}

export async function serverIsAuthenticated() {
  return readIsAuthenticated();
}

export async function passwordConfiguredFlag() {
  return isPasswordConfigured();
}
