import { supabase } from "./supabaseClient";

export type PieceRow = {
  id: string;
  user_id: string;
  len: number;
  qty: number;
  note: string;
  created_at?: string;
};

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Not logged in.");
  return data.user.id;
}

export async function listPieces(): Promise<PieceRow[]> {
  await requireUserId();

  const { data, error } = await supabase
    .from("pieces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as PieceRow[];
}

export async function createPiece(input: { len: number; qty: number; note?: string }) {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("pieces")
    .insert([
      {
        user_id: userId,
        len: Number(input.len),
        qty: Number(input.qty),
        note: (input.note ?? "").trim(),
      },
    ])
    .select("*")
    .single();

  if (error) throw error;
  return data as PieceRow;
}

export async function deletePieceById(id: string) {
  await requireUserId();

  const { error } = await supabase.from("pieces").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function clearPieces() {
  const userId = await requireUserId();

  const { error } = await supabase.from("pieces").delete().eq("user_id", userId);
  if (error) throw error;
  return true;
}
