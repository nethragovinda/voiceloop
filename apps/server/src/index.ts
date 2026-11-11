import "dotenv/config";
import express from "express";
import cors from "cors";

import feedbackRoutes from "./routes/feedback.js";
import actionRoutes from "./routes/actions.js";
import oauthConsentRoutes from "./routes/oauth-consent.js";

import { authenticateUser } from "./middleware/auth.js";
import { supabase } from "./config/supabase.js";

import {
  mcpAuthRouter,
  mcpAuthMetadataRouter,
  createOAuthMetadata,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { voiceLoopOAuthProvider } from "./mcp/oauth-provider.js";
import { createVoiceLoopMcpServer } from "./mcp/server.js";

const app = express();

app.use(cors());
app.use(express.json());

// Public server configuration
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "http://localhost:3001";

const ISSUER_URL = new URL(PUBLIC_BASE_URL);
const MCP_RESOURCE_URL = new URL(
  process.env.MCP_RESOURCE_URL || `${PUBLIC_BASE_URL}/mcp`
);

const SUPPORTED_SCOPES = [
  "feedback:read",
  "feedback:write",
  "actions:read",
  "actions:write",
];

// Health check
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "VoiceLoop API is running",
  });
});

// OAuth authorization server endpoints
app.use(
  mcpAuthRouter({
    provider: voiceLoopOAuthProvider,
    issuerUrl: ISSUER_URL,
    baseUrl: ISSUER_URL,
    resourceServerUrl: MCP_RESOURCE_URL,
    scopesSupported: SUPPORTED_SCOPES,
    resourceName: "VoiceLoop MCP Server",
  })
);

// OAuth protected resource metadata
const oauthMetadata = createOAuthMetadata({
  provider: voiceLoopOAuthProvider,
  issuerUrl: ISSUER_URL,
  baseUrl: ISSUER_URL,
  scopesSupported: SUPPORTED_SCOPES,
});

app.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: MCP_RESOURCE_URL,
    scopesSupported: SUPPORTED_SCOPES,
    resourceName: "VoiceLoop MCP Server",
  })
);

// OAuth consent endpoint
// This route verifies the Supabase access token itself.
app.use("/api/oauth", oauthConsentRoutes);

// Protect regular REST API routes with Supabase authentication
app.use("/api", authenticateUser);

app.use("/api/feedback", feedbackRoutes);
app.use("/api/actions", actionRoutes);

// Protect MCP requests with OAuth bearer authentication
const authenticateMcp = requireBearerAuth({
  verifier: voiceLoopOAuthProvider,
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
    MCP_RESOURCE_URL
  ),
  expectedResource: MCP_RESOURCE_URL,
});

// MCP endpoint
app.all("/mcp", authenticateMcp, async (req, res) => {
  try {
    const workspaceId = req.auth?.extra?.workspaceId;

    if (typeof workspaceId !== "string") {
      return res.status(401).json({
        error: "Authenticated workspace could not be identified.",
      });
    }

    // Create an MCP server scoped to the authenticated workspace.
    const mcpServer = createVoiceLoopMcpServer(workspaceId);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await mcpServer.connect(transport);

    await transport.handleRequest(
      req,
      res,
      req.method === "POST" ? req.body : undefined
    );
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error: "MCP request failed.",
      });
    }
  }
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`VoiceLoop API running at http://localhost:${PORT}`);
});