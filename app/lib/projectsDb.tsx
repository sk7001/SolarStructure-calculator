import { supabase } from "./supabaseClient";

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  inputs: {
    frontLegHeight: string;
    numberOfPanels: string;
    selectedPanelModel: string;
    isVertical: boolean;
  };
  results: any; // your complex results object
  created_at?: string;
  updated_at?: string;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Not logged in.");
  return data.user.id;
}

// List all projects (for /projects page later)
export async function listProjects(): Promise<ProjectRow[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as ProjectRow[];
}

// Get single project by ID
export async function getProjectById(id: string): Promise<ProjectRow> {
  await requireUserId();

  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ProjectRow;
}

// Create new project (your "Save Project" button)
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

// Update project (for /projects page editing later)
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

// Delete project
export async function deleteProject(id: string) {
  await requireUserId();

  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  return true;
}
