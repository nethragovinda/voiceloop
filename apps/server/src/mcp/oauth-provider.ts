
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import {
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

import { supabase } from "../config/supabase.js";

import { oauthClientsStore } from "./oauth-store.js";
import {
  createAuthorizationCode,
  consumeAuthorizationCode,
  getAuthorizationCodeChallenge,
} from "./oauth-codes.js";

import {
  issueTokenPair,
  refreshTokenPair,
  verifyOAuthAccessToken,
  revokeOAuthToken,
} from "./oauth-tokens.js";

import { createPendingAuthorizationRequest } from "./oauth-requests.js";

const FRONTEND_URL = process.env.FRONTEND_URL;

if (!FRONTEND_URL) {
  throw new Error("Missing FRONTEND_URL in server environment.");
}

const DEFAULT_SCOPES = [
  "feedback:read",
  "feedback:write",
  "actions:read",
  "actions:write",
];

export const voiceLoopOAuthProvider: OAuthServerProvider = {
  get clientsStore() {
    return oauthClientsStore;
  },

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ) {
    const requestId = await createPendingAuthorizationRequest({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      state: params.state ?? null,
      code_challenge: params.codeChallenge,
      scopes: params.scopes?.length ? params.scopes : DEFAULT_SCOPES,
      resource: params.resource?.toString() ?? null,
    });

    const consentUrl = new URL("/oauth/consent", FRONTEND_URL);
    consentUrl.searchParams.set("request_id", requestId);

    res.redirect(302, consentUrl.toString());
  },

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ) {
    try {
      return await getAuthorizationCodeChallenge(
        authorizationCode,
        client.client_id
      );
    } catch {
      throw new InvalidGrantError(
        "Authorization code is invalid or expired."
      );
    }
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL
  ) {
    const expectedRedirectUri = redirectUri ?? client.redirect_uris[0];

    if (!expectedRedirectUri) {
      throw new InvalidGrantError("Missing redirect URI.");
    }

    let record;

    try {
      record = await consumeAuthorizationCode(
        authorizationCode,
        client.client_id,
        expectedRedirectUri
      );
    } catch {
      throw new InvalidGrantError("Authorization code could not be exchanged.");
    }

    if (!record) {
      throw new InvalidGrantError(
        "Authorization code is invalid, expired, or already used."
      );
    }

    if (
      resource &&
      record.resource !== resource.toString()
    ) {
      throw new InvalidGrantError("Resource does not match.");
    }

    // Confirm that the user still belongs to the authorized workspace.
    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", record.user_id)
      .eq("workspace_id", record.workspace_id)
      .maybeSingle();

    if (error || !membership) {
      throw new InvalidGrantError(
        "Workspace membership is no longer valid."
      );
    }

    return issueTokenPair({
      client_id: client.client_id,
      user_id: record.user_id,
      workspace_id: record.workspace_id,
      scopes: record.scopes,
      resource: record.resource,
    });
  },

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ) {
    try {
      return await refreshTokenPair(
        client.client_id,
        refreshToken,
        scopes,
        resource
      );
    } catch {
      throw new InvalidGrantError(
        "Refresh token is invalid, expired, or revoked."
      );
    }
  },

  async verifyAccessToken(token: string) {
    let authInfo;

    try {
      authInfo = await verifyOAuthAccessToken(token);
    } catch {
      throw new InvalidTokenError(
        "Access token is invalid or expired."
      );
    }

    const userId = authInfo.extra?.userId;
    const workspaceId = authInfo.extra?.workspaceId;

    if (
      typeof userId !== "string" ||
      typeof workspaceId !== "string"
    ) {
      throw new InvalidTokenError("Invalid token ownership.");
    }

    const { data: membership, error } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error || !membership) {
      throw new InvalidTokenError(
        "Workspace access is no longer valid."
      );
    }

    return authInfo;
  },

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest
  ) {
    await revokeOAuthToken(client.client_id, request.token);
  },
};
