
import { createHash, randomBytes } from "node:crypto";
import { supabase } from "../config/supabase.js";

export interface AuthorizationCodeRecord {
  client_id: string;
  user_id: string;
  workspace_id: string;
  redirect_uri: string;
  code_challenge: string;
  scopes: string[];
  resource: string | null;
  expires_at: string;
}

export interface ConsumedAuthorizationCode
  extends AuthorizationCodeRecord {
  code_hash: string;
  consumed_at: string;
}

export function hashAuthorizationCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function createAuthorizationCode(
  record: AuthorizationCodeRecord
): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const codeHash = hashAuthorizationCode(code);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("oauth_authorization_codes")
    .insert({
      code_hash: codeHash,
      client_id: record.client_id,
      user_id: record.user_id,
      workspace_id: record.workspace_id,
      redirect_uri: record.redirect_uri,
      code_challenge: record.code_challenge,
      scopes: record.scopes,
      resource: record.resource,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error(
      `Could not create authorization code: ${error.message}`
    );
  }

  return code;
}

export async function consumeAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string
): Promise<ConsumedAuthorizationCode | null> {
  const codeHash = hashAuthorizationCode(code);
  const now = new Date().toISOString();

  // The conditional update makes code consumption one-time:
  // only one request can change an unconsumed, unexpired code.
  const { data, error } = await supabase
    .from("oauth_authorization_codes")
    .update({ consumed_at: now })
    .eq("code_hash", codeHash)
    .eq("client_id", clientId)
    .eq("redirect_uri", redirectUri)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not validate authorization code: ${error.message}`
    );
  }

  return data as ConsumedAuthorizationCode | null;
}

export async function getAuthorizationCodeChallenge(
    code: string,
    clientId: string
  ): Promise<string> {
    const codeHash = hashAuthorizationCode(code);
    const { data, error } = await supabase
      .from("oauth_authorization_codes")
      .select("code_challenge")
      .eq("code_hash", codeHash)
      .eq("client_id", clientId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error) {
      throw new Error(
        `Could not retrieve PKCE challenge: ${error.message}`
      );
    }
    if (!data) {   throw new Error("Authorization code is invalid or expired.");
    }
    return data.code_challenge;
  }