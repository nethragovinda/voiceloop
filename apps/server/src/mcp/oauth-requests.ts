
import { randomUUID } from "node:crypto";
import { supabase } from "../config/supabase.js";

export interface PendingAuthorizationRequest {
  id: string;
  client_id: string;
  redirect_uri: string;
  state: string | null;
  code_challenge: string;
  scopes: string[];
  resource: string | null;
  expires_at: string;
}

export async function createPendingAuthorizationRequest(
  request: Omit<PendingAuthorizationRequest, "id" | "expires_at">
): Promise<string> {
  const id = randomUUID();

  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  ).toISOString();

  const { error } = await supabase
    .from("oauth_authorization_requests")
    .insert({
      id,
      ...request,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(
      `Could not create authorization request: ${error.message}`
    );
  }

  return id;
}

export async function getPendingAuthorizationRequest(
  requestId: string
): Promise<PendingAuthorizationRequest | null> {
  const { data, error } = await supabase
    .from("oauth_authorization_requests")
    .select("*")
    .eq("id", requestId)
    .is("completed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not retrieve authorization request: ${error.message}`
    );
  }

  return data as PendingAuthorizationRequest | null;
}
