
import { createHash, randomBytes } from "node:crypto";
import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { supabase } from "../config/supabase.js";

const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;
const REFRESH_TOKEN_LIFETIME_DAYS = 30;

interface TokenOwner {
  client_id: string;
  user_id: string;
  workspace_id: string;
  scopes: string[];
  resource: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenExpiry(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function toOAuthTokens(
  accessToken: string,
  refreshToken: string,
  scopes: string[]
): OAuthTokens {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
    scope: scopes.join(" "),
  };
}

export async function issueTokenPair(
  owner: TokenOwner
): Promise<OAuthTokens> {
  const accessToken = generateToken();
  const refreshToken = generateToken();

  const { error } = await supabase.from("oauth_tokens").insert({
    client_id: owner.client_id,
    user_id: owner.user_id,
    workspace_id: owner.workspace_id,
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    scopes: owner.scopes,
    resource: owner.resource,
    access_expires_at: tokenExpiry(ACCESS_TOKEN_LIFETIME_SECONDS),
    refresh_expires_at: tokenExpiry(
      REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60
    ),
  });

  if (error) {
    throw new Error(`Could not issue OAuth tokens: ${error.message}`);
  }

  return toOAuthTokens(accessToken, refreshToken, owner.scopes);
}

export async function refreshTokenPair(
  clientId: string,
  oldRefreshToken: string,
  requestedScopes?: string[],
  requestedResource?: URL
): Promise<OAuthTokens> {
  const oldHash = hashToken(oldRefreshToken);

  const { data: existing, error: lookupError } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("client_id", clientId)
    .eq("refresh_token_hash", oldHash)
    .is("revoked_at", null)
    .gt("refresh_expires_at", new Date().toISOString())
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not retrieve refresh token: ${lookupError.message}`);
  }

  if (!existing) {
    throw new Error("Invalid, expired, or revoked refresh token.");
  }

  const existingScopes = existing.scopes as string[];
  const scopes = requestedScopes ?? existingScopes;

  if (!scopes.every((scope) => existingScopes.includes(scope))) {
    throw new Error("Requested scopes exceed the original authorization.");
  }

  if (
    requestedResource &&
    existing.resource !== requestedResource.toString()
  ) {
    throw new Error("Refresh token resource does not match.");
  }

  const accessToken = generateToken();
  const refreshToken = generateToken();

  // Replace both hashes in one conditional update.
  // The old refresh token cannot be used again after this succeeds.
  const { data: updated, error: updateError } = await supabase
    .from("oauth_tokens")
    .update({
      access_token_hash: hashToken(accessToken),
      refresh_token_hash: hashToken(refreshToken),
      scopes,
      access_expires_at: tokenExpiry(ACCESS_TOKEN_LIFETIME_SECONDS),
      refresh_expires_at: tokenExpiry(
        REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60
      ),
    })
    .eq("id", existing.id)
    .eq("refresh_token_hash", oldHash)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Could not rotate refresh token: ${updateError.message}`);
  }

  if (!updated) {
    throw new Error("Refresh token has already been used.");
  }

  return toOAuthTokens(accessToken, refreshToken, scopes);
}

export async function verifyOAuthAccessToken(
  accessToken: string
): Promise<AuthInfo> {
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select("*")
    .eq("access_token_hash", hashToken(accessToken))
    .is("revoked_at", null)
    .gt("access_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error(`Could not verify access token: ${error.message}`);
  }

  if (!data) {
    throw new Error("Invalid, expired, or revoked access token.");
  }

  return {
    token: accessToken,
    clientId: data.client_id,
    scopes: data.scopes as string[],
    expiresAt: Math.floor(
      new Date(data.access_expires_at).getTime() / 1000
    ),
    ...(data.resource ? { resource: new URL(data.resource) } : {}),
    extra: {
      userId: data.user_id,
      workspaceId: data.workspace_id,
    },
  };
}

export async function revokeOAuthToken(
  clientId: string,
  token: string
): Promise<void> {
  const tokenHash = hashToken(token);

  const { error } = await supabase
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .is("revoked_at", null)
    .or(
      `access_token_hash.eq.${tokenHash},refresh_token_hash.eq.${tokenHash}`
    );

  if (error) {
    throw new Error(`Could not revoke OAuth token: ${error.message}`);
  }
}
