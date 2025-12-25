const STORAGE_KEY = "usable_pieces_v2";

// Each item: { id, len: number, qty: number, note?: string, createdAt: number }

const safeParse = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const genId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalize = (p) => ({
  id: String(p?.id || genId()),
  len: Number(p?.len || 0),
  qty: Math.max(0, parseInt(p?.qty || 0, 10)),
  note: String(p?.note || "").trim(),
  createdAt: Number(p?.createdAt || Date.now()),
});

export const loadPieces = () => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : [];
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map(normalize).filter((p) => p.len > 0 && p.qty > 0);
};

export const savePieces = (pieces) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pieces));
};

export const addPiece = ({ len, qty, note }) => {
  const pieces = loadPieces();
  const item = normalize({ len, qty, note, createdAt: Date.now() });
  const next = [item, ...pieces];
  savePieces(next);
  return next;
};

export const deletePiece = (id) => {
  const pieces = loadPieces();
  const next = pieces.filter((p) => p.id !== id);
  savePieces(next);
  return next;
};

export const clearPieces = () => {
  savePieces([]);
  return [];
};

// requiredPieces: [{ len, qty }]
// inventoryPieces: [{ len, qty, ... }]
export const consumeInventory = (requiredPieces, inventoryPieces, tolerance = 0.25) => {
  const inv = inventoryPieces.map((p) => ({ ...p })); // copy to mutate
  const used = [];
  const req = requiredPieces.map((r) => ({ ...r, needed: r.qty }));

  for (const r of req) {
    if (r.needed <= 0) continue;

    // closest match first within tolerance
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
  const remainingRequired = req.map(({ len, needed }) => ({ len, qty: needed })).filter((x) => x.qty > 0);

  return { remainingRequired, remainingInventory, used };
};
