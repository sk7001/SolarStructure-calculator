// ✅ YOUR FILE IS PERFECT - NO CHANGES NEEDED
import { supabase } from "./supabaseClient";

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  inputs: any;
  results: any;
  created_at?: string;
  updated_at?: string;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Not logged in.");
  return data.user.id;
}

export async function listProjects(): Promise<ProjectRow[]> {
  await requireUserId();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ProjectRow[];
}

export async function getProjectById(id: string): Promise<ProjectRow> {
  await requireUserId();
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function createProject(input: {
  name: string;
  inputs: any;
  results?: any;
}): Promise<ProjectRow> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("projects")
    .insert([
      {
        user_id: userId,
        name: input.name.trim(),
        inputs: input.inputs || {},
        results: input.results ?? null,
      },
    ])
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function updateProject(
  id: string,
  patch: { name: string; inputs?: any; results?: any }
): Promise<ProjectRow> {
  await requireUserId();
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: patch.name.trim(),
      inputs: patch.inputs,
      results: patch.results ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function deleteProject(id: string) {
  await requireUserId();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  return true;
}
