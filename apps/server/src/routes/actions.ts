
import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/supabase.js";

const router = Router();

const actionSchema = z.object({
  feedback_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  owner: z.string().trim().max(150).optional().nullable(),
  due_date: z.string().date().optional().nullable(),
  status: z.enum(["open", "in_progress", "resolved"]).default("open"),
});

const updateActionSchema = actionSchema
  .omit({ feedback_id: true })
  .partial();

// GET: List actions belonging to the authenticated workspace
router.get("/", async (_req, res) => {
  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("actions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve actions",
    });
  }

  return res.json({
    success: true,
    count: data.length,
    actions: data,
  });
});

// GET: List actions belonging to a feedback record in this workspace
router.get("/feedback/:feedbackId", async (req, res) => {
  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("actions")
    .select("*")
    .eq("feedback_id", req.params.feedbackId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve feedback actions",
    });
  }

  return res.json({
    success: true,
    count: data.length,
    actions: data,
  });
});

// POST: Create an action within the authenticated workspace
router.post("/", async (req, res) => {
  const validation = actionSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid action data",
      errors: validation.error.issues,
    });
  }

  const { workspaceId } = res.locals.auth;
  const { feedback_id, ...actionData } = validation.data;

  // Verify that the linked feedback belongs to this workspace
  const { data: feedback, error: feedbackError } = await supabase
    .from("feedback")
    .select("id")
    .eq("id", feedback_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (feedbackError) {
    console.error(feedbackError.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify linked feedback",
    });
  }

  if (!feedback) {
    return res.status(404).json({
      success: false,
      message: "Feedback not found in your workspace",
    });
  }

  const { data, error } = await supabase
    .from("actions")
    .insert({
      ...actionData,
      feedback_id,
      workspace_id: workspaceId,
    })
    .select()
    .single();

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create action",
    });
  }

  return res.status(201).json({
    success: true,
    message: "Action created successfully",
    action: data,
  });
});

// PATCH: Update an action only within the authenticated workspace
router.patch("/:id", async (req, res) => {
  const validation = updateActionSchema.safeParse(req.body);

  if (
    !validation.success ||
    Object.keys(validation.data ?? {}).length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Provide valid fields to update",
      errors: validation.success ? undefined : validation.error.issues,
    });
  }

  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("actions")
    .update(validation.data)
    .eq("id", req.params.id)
    .eq("workspace_id", workspaceId)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update action",
    });
  }

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Action not found",
    });
  }

  return res.json({
    success: true,
    message: "Action updated successfully",
    action: data,
  });
});

export default router;
