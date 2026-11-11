
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabase } from "../config/supabase.js";

function success(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function failure(error: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: error instanceof Error ? error.message : "Something went wrong.",
      },
    ],
    isError: true,
  };
}

export function createVoiceLoopMcpServer(workspaceId: string) {
  const server = new McpServer({
    name: "voiceloop",
    version: "1.0.0",
  });

  // TOOL 1: Create feedback
  server.registerTool(
    "create_feedback",
    {
      description: "Create a customer feedback record in VoiceLoop.",
      inputSchema: {
        customer_name: z.string().trim().min(1).max(150),
        feedback_text: z.string().trim().min(1).max(5000),
        category: z.enum([
          "product", "onboarding", "billing", "support", "other",
        ]),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        status: z.enum(["open", "in_progress", "resolved"]).default("open"),
      },
    },
    async (input) => {
      try {
        const { data, error } = await supabase
          .from("feedback")
          .insert({
            ...input,
            workspace_id: workspaceId,
          })
          .select()
          .single();

        if (error) throw error;

        return success({
          message: "Feedback successfully created in VoiceLoop.",
          feedback: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 2: List feedback
  server.registerTool(
    "list_feedback",
    {
      description: "List customer feedback records stored in VoiceLoop.",
      inputSchema: {
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ status, priority, limit }) => {
      try {
        let query = supabase
          .from("feedback")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status) query = query.eq("status", status);
        if (priority) query = query.eq("priority", priority);

        const { data, error } = await query;

        if (error) throw error;

        return success({
          count: data.length,
          feedback: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 3: Get one feedback record
  server.registerTool(
    "get_feedback",
    {
      description: "Get one customer feedback record by its ID.",
      inputSchema: {
        id: z.string().uuid(),
      },
    },
    async ({ id }) => {
      try {
        const { data, error } = await supabase
          .from("feedback")
          .select("*")
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Feedback record not found.");

        return success(data);
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 4: Update feedback
  server.registerTool(
    "update_feedback",
    {
      description: "Update a customer feedback record in VoiceLoop.",
      inputSchema: {
        id: z.string().uuid(),
        customer_name: z.string().trim().min(1).max(150).optional(),
        feedback_text: z.string().trim().min(1).max(5000).optional(),
        category: z.enum([
          "product", "onboarding", "billing", "support", "other",
        ]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
      },
    },
    async ({ id, ...updates }) => {
      try {
        if (Object.keys(updates).length === 0) {
          throw new Error("Provide at least one field to update.");
        }

        const { data, error } = await supabase
          .from("feedback")
          .update(updates)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Feedback record not found.");

        return success({
          message: "Feedback successfully updated.",
          feedback: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 5: Create an action linked to workspace feedback
  server.registerTool(
    "create_action",
    {
      description:
        "Create an action item linked to a customer feedback record in VoiceLoop.",
      inputSchema: {
        feedback_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(2000).nullable().optional(),
        owner: z.string().trim().max(150).nullable().optional(),
        due_date: z.string().date().nullable().optional(),
        status: z.enum(["open", "in_progress", "resolved"]).default("open"),
      },
    },
    async (input) => {
      try {
        const { data: feedbackRecord, error: feedbackError } =
          await supabase
            .from("feedback")
            .select("id")
            .eq("id", input.feedback_id)
            .eq("workspace_id", workspaceId)
            .maybeSingle();

        if (feedbackError) throw feedbackError;

        if (!feedbackRecord) {
          throw new Error("Linked feedback record not found in this workspace.");
        }

        const { data, error } = await supabase
          .from("actions")
          .insert({
            ...input,
            workspace_id: workspaceId,
          })
          .select()
          .single();

        if (error) throw error;

        return success({
          message: "Action successfully created in VoiceLoop.",
          action: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 6: List actions
  server.registerTool(
    "list_actions",
    {
      description:
        "Retrieve action items from VoiceLoop, optionally filtered by feedback record or status.",
      inputSchema: {
        feedback_id: z.string().uuid().optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      },
    },
    async ({ feedback_id, status, limit }) => {
      try {
        let query = supabase
          .from("actions")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (feedback_id) query = query.eq("feedback_id", feedback_id);
        if (status) query = query.eq("status", status);

        const { data, error } = await query;

        if (error) throw error;

        return success({
          count: data.length,
          actions: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  // TOOL 7: Update an action
  server.registerTool(
    "update_action",
    {
      description:
        "Update an existing VoiceLoop action item, including its title, description, owner, due date, or status.",
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        owner: z.string().trim().max(150).nullable().optional(),
        due_date: z.string().date().nullable().optional(),
        status: z.enum(["open", "in_progress", "resolved"]).optional(),
      },
    },
    async ({ id, ...updates }) => {
      try {
        if (Object.keys(updates).length === 0) {
          throw new Error("Provide at least one field to update.");
        }

        const { data, error } = await supabase
          .from("actions")
          .update(updates)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select()
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Action record not found.");

        return success({
          message: "Action successfully updated.",
          action: data,
        });
      } catch (error) {
        return failure(error);
      }
    }
  );

  return server;
}
