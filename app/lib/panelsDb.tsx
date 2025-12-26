import { supabase } from "./supabaseClient";

export type PanelRow = {
  id: string;
  user_id: string;
  name: string;
  width: number;
  height: number;
  description: string;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_PANELS: Array<Pick<PanelRow, "name" | "width" | "height" | "description">> = [
  // Put your current “hardcoded” panels here (examples below — replace with yours)
  { name: "540W", width: 89.6, height: 44.7, description: "Default model" },
  { name: "550W", width: 89.6, height: 44.7, description: "Default model" },
];

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Not logged in.");
  return data.user.id;
}

// Load panels from cloud
export async function listPanels(): Promise<PanelRow[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("panels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as PanelRow[];
}

// Seed default panels ONCE per user (safe to call many times)
export async function seedDefaultPanelsIfEmpty() {
  const userId = await requireUserId();

  const existing = await listPanels();
  if (existing.length > 0) return;

  // Upsert so it won’t create duplicates if you rerun
  const { error } = await supabase
    .from("panels")
    .upsert(
      DEFAULT_PANELS.map((p) => ({
        user_id: userId,
        name: p.name,
        width: p.width,
        height: p.height,
        description: p.description ?? "",
      })),
      { onConflict: "user_id,name" }
    );

  if (error) throw error;
}

export async function createPanel(input: {
  name: string;
  width: number;
  height: number;
  description?: string;
}) {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("panels")
    .insert([
      {
        user_id: userId,
        name: input.name.trim(),
        width: Number(input.width),
        height: Number(input.height),
        description: (input.description ?? "").trim(),
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data as PanelRow;
}

export async function getPanelById(id: string) {
  await requireUserId();

  const { data, error } = await supabase.from("panels").select("*").eq("id", id).single();
  if (error) throw error;
  return data as PanelRow;
}

export async function updatePanel(
  id: string,
  patch: { name: string; width: number; height: number; description?: string }
) {
  await requireUserId();

  const { data, error } = await supabase
    .from("panels")
    .update({
      name: patch.name.trim(),
      width: Number(patch.width),
      height: Number(patch.height),
      description: (patch.description ?? "").trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as PanelRow;
}

export async function deletePanel(id: string) {
  await requireUserId();

  const { error } = await supabase.from("panels").delete().eq("id", id);
  if (error) throw error;
  return true;
}
