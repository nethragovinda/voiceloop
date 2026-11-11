
import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/supabase.js";

const router = Router();

const feedbackSchema = z.object({
  customer_name: z.string().trim().min(1).max(150),
  feedback_text: z.string().trim().min(1).max(5000),
  category: z.enum([
    "product",
    "onboarding",
    "billing",
    "support",
    "other",
  ]).default("other"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z.enum(["open", "in_progress", "resolved"]).default("open"),
});

const updateFeedbackSchema = feedbackSchema.partial();

// GET: List feedback belonging to the authenticated workspace
router.get("/", async (_req, res) => {
  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve feedback",
    });
  }

  return res.json({
    success: true,
    count: data.length,
    feedback: data,
  });
});

// GET: Retrieve one feedback record within the workspace
router.get("/:id", async (req, res) => {
  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("id", req.params.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve feedback",
    });
  }

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Feedback not found",
    });
  }

  return res.json({
    success: true,
    feedback: data,
  });
});

// POST: Create feedback in the authenticated workspace
router.post("/", async (req, res) => {
  const validation = feedbackSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid feedback data",
      errors: validation.error.issues,
    });
  }

  const { workspaceId } = res.locals.auth;

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      ...validation.data,
      workspace_id: workspaceId,
    })
    .select()
    .single();

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to create feedback",
    });
  }

  return res.status(201).json({
    success: true,
    message: "Feedback created successfully",
    feedback: data,
  });
});

// PATCH: Update feedback only within the authenticated workspace
router.patch("/:id", async (req, res) => {
  const validation = updateFeedbackSchema.safeParse(req.body);

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
    .from("feedback")
    .update(validation.data)
    .eq("id", req.params.id)
    .eq("workspace_id", workspaceId)
    .select()
    .maybeSingle();

  if (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to update feedback",
    });
  }

  if (!data) {
    return res.status(404).json({
      success: false,
      message: "Feedback not found",
    });
  }

  return res.json({
    success: true,
    message: "Feedback updated successfully",
    feedback: data,
  });
});

export default router;
