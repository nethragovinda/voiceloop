
import { supabaseClient } from "./supabase";

const BACKEND_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3001"
).replace(/\/$/, "");

const API_BASE_URL = `${BACKEND_URL}/api`;


export interface Feedback {
  id: string;
  customer_name: string;
  feedback_text: string;
  category: "product" | "onboarding" | "billing" | "support" | "other";
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface Action {
  id: string;
  feedback_id: string;
  title: string;
  description: string | null;
  owner: string | null;
  due_date: string | null;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string;
}


async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error || !data.session) {
    throw new Error("Please sign in to continue.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}


export const api = {
  getFeedback: () =>
    request<{ success: boolean; feedback: Feedback[] }>("/feedback"),

  getActions: () =>
    request<{ success: boolean; actions: Action[] }>("/actions"),

  updateFeedback: (id: string, updates: Partial<Feedback>) =>
    request(`/feedback/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  updateAction: (id: string, updates: Partial<Action>) =>
    request(`/actions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),
};
