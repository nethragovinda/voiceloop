
import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../config/supabase.js";

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in server environment."
  );
}

const authClient = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const accessToken = authorization.slice(7);

    const { data: userData, error: userError } =
      await authClient.auth.getUser(accessToken);

    if (userError || !userData.user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
      });
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userData.user.id)
      .limit(2);

    if (membershipError) {
      console.error("Workspace lookup failed:", membershipError.message);

      return res.status(500).json({
        success: false,
        message: "Could not verify workspace access.",
      });
    }

    if (!memberships || memberships.length !== 1) {
      return res.status(403).json({
        success: false,
        message: "A single workspace membership is required.",
      });
    }

    res.locals.auth = {
      userId: userData.user.id,
      workspaceId: memberships[0].workspace_id,
    };

    next();
  } catch (error) {
    console.error("Authentication failed:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
}
