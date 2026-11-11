
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "../config/supabase.js";
import {
  getPendingAuthorizationRequest,
} from "../mcp/oauth-requests.js";
import {
  createAuthorizationCode,
} from "../mcp/oauth-codes.js";

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error("Missing Supabase authentication configuration.");
}

const authClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

router.post("/approve", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please sign in to VoiceLoop first.",
      });
    }

    const accessToken = authorization.slice(7);
    const { data: userData, error: authError } =
      await authClient.auth.getUser(accessToken);

    if (authError || !userData.user) {
      return res.status(401).json({
        message: "Your session is invalid or expired.",
      });
    }

    const { request_id } = req.body;

    if (typeof request_id !== "string") {
      return res.status(400).json({
        message: "Authorization request ID is required.",
      });
    }

    const pending = await getPendingAuthorizationRequest(request_id);

    if (!pending) {
      return res.status(404).json({
        message: "Authorization request is invalid or expired.",
      });
    }

    // Find the user's VoiceLoop workspace.
    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userData.user.id)
      .limit(2);

    if (membershipError) {
      throw membershipError;
    }

    if (!memberships || memberships.length !== 1) {
      return res.status(403).json({
        message: "A single VoiceLoop workspace membership is required.",
      });
    }

    const workspaceId = memberships[0].workspace_id;

    // Mark the pending request as completed before issuing a code.
    const now = new Date().toISOString();

    const { data: completedRequest, error: completionError } =
      await supabase
        .from("oauth_authorization_requests")
        .update({
          approved_at: now,
          completed_at: now,
        })
        .eq("id", request_id)
        .is("completed_at", null)
        .gt("expires_at", now)
        .select("id")
        .maybeSingle();

    if (completionError) {
      throw completionError;
    }

    if (!completedRequest) {
      return res.status(409).json({
        message: "This authorization request has already been processed.",
      });
    }

    const code = await createAuthorizationCode({
      client_id: pending.client_id,
      user_id: userData.user.id,
      workspace_id: workspaceId,
      redirect_uri: pending.redirect_uri,
      code_challenge: pending.code_challenge,
      scopes: pending.scopes,
      resource: pending.resource,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    const redirectUrl = new URL(pending.redirect_uri);
    redirectUrl.searchParams.set("code", code);

    if (pending.state) {
      redirectUrl.searchParams.set("state", pending.state);
    }

    return res.json({
      success: true,
      redirect_url: redirectUrl.toString(),
    });
  } catch (error) {
    console.error("OAuth approval failed:", error);

    return res.status(500).json({
      message: "Could not complete authorization.",
    });
  }
});

export default router;
