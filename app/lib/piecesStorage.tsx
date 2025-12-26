const STORAGE_KEY = "usable_pieces_v2";

export type UsablePiece = {
  id: string;
  len: number;
  qty: number;
  note?: string;
  createdAt: number;
};

export type RequiredPiece = {
  len: number;
  qty: number;
};

export type UsedPiece = {
  len: number;
  qty: number;
  fromLen: number;
};

const safeParse = (v: string | null): unknown | null => {
  if (!v) return null;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return null;
  }
};

const genId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalize = (p: unknown): UsablePiece => {
  const obj = (p && typeof p === "object") ? (p as Record<string, unknown>) : {};

  const len = Number(obj.len ?? 0);
  const qtyRaw = obj.qty ?? 0;
  const qty = Math.max(0, parseInt(String(qtyRaw), 10) || 0);

  return {
    id: String(obj.id ?? genId()),
    len,
    qty,
    note: String(obj.note ?? "").trim(),
    createdAt: Number(obj.createdAt ?? Date.now()),
  };
};

export const loadPieces = (): UsablePiece[] => {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : [];
  const arr = Array.isArray(parsed) ? parsed : [];

  return arr.map(normalize).filter((p) => p.len > 0 && p.qty > 0);
};

export const savePieces = (pieces: UsablePiece[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
};

export const addPiece = (input: { len: number; qty: number; note?: string }): UsablePiece[] => {
  const pieces = loadPieces();
  const item = normalize({ ...input, createdAt: Date.now() });
  const next = [item, ...pieces];
  savePieces(next);
  return next;
};

export const deletePiece = (id: string): UsablePiece[] => {
  const pieces = loadPieces();
  const next = pieces.filter((p) => p.id !== id);
  savePieces(next);
  return next;
};

export const clearPieces = (): UsablePiece[] => {
  savePieces([]);
  return [];
};

export const consumeInventory = (
  requiredPieces: RequiredPiece[],
  inventoryPieces: UsablePiece[],
  tolerance: number = 0.25
): {
  remainingRequired: RequiredPiece[];
  remainingInventory: UsablePiece[];
  used: UsedPiece[];
} => {
  const inv: UsablePiece[] = inventoryPieces.map((p) => ({ ...p }));
  const used: UsedPiece[] = [];
  const req = requiredPieces.map((r) => ({ ...r, needed: r.qty }));

  for (const r of req) {
    if (r.needed <= 0) continue;

    const candidates = inv
      .map((p, idx) => ({ p, idx, diff: Math.abs(p.len - r.len) }))
      .filter((x) => x.diff <= tolerance && x.p.qty > 0)
      .sort((a, b) => a.diff - b.diff);

    for (const c of candidates) {
      if (r.needed <= 0) break;

      const take = Math.min(r.needed, c.p.qty);
      if (take <= 0) continue;

      c.p.qty -= take;
      r.needed -= take;

      used.push({ len: r.len, qty: take, fromLen: c.p.len });
    }
  }

  const remainingInventory = inv.filter((p) => p.qty > 0);
  const remainingRequired = req
    .map(({ len, needed }) => ({ len, qty: needed }))
    .filter((x) => x.qty > 0);

  return { remainingRequired, remainingInventory, used };
};
