const STORAGE_KEY = "solar_panel_models_v1";

const DEFAULT_PANELS = [
  { id: "p1", name: "540W", width: 89, height: 45, description: "Default 540W panel" },
  { id: "p2", name: "550W", width: 90, height: 45, description: "Default 550W panel" },
];

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const genId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizePanel = (p) => ({
  id: String(p.id || genId()),
  name: String(p.name || "").trim(),
  width: Number(p.width || 0),
  height: Number(p.height || 0),
  description: String(p.description || "").trim(),
});

const ensureIdsAndClean = (panels) => {
  let changed = false;

  const cleaned = (Array.isArray(panels) ? panels : []).map((p) => {
    const hasId = p && typeof p === "object" && p.id;
    if (!hasId) changed = true;
    return normalizePanel(p || {});
  });

  const filtered = cleaned.filter((p) => p.name && p.width > 0 && p.height > 0);
  if (filtered.length !== cleaned.length) changed = true;

  return { panels: filtered, changed };
};

const nameKeyOf = (p) => String(p?.name || "").trim().toLowerCase();
const dimKeyOf = (p) => `${Number(p?.width || 0)}x${Number(p?.height || 0)}`;

export const savePanels = (panels) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
};

export const loadPanels = () => {
  if (typeof window === "undefined") return DEFAULT_PANELS;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    savePanels(DEFAULT_PANELS);
    return DEFAULT_PANELS;
  }

  const parsed = safeParse(raw);
  const { panels, changed } = ensureIdsAndClean(parsed);

  if (changed) savePanels(panels);
  return panels.length ? panels : DEFAULT_PANELS;
};

export const getPanelById = (id) => {
  const panels = loadPanels();
  return panels.find((p) => p.id === id) || null;
};

// Optional: can be used to display duplicates in UI later
export const findPanelDuplicates = (panels) => {
  const byName = new Map();
  const byDim = new Map();

  for (const p of panels) {
    const nk = nameKeyOf(p);
    const dk = dimKeyOf(p);

    if (nk) {
      if (!byName.has(nk)) byName.set(nk, []);
      byName.get(nk).push(p);
    }
    if (Number(p.width) > 0 && Number(p.height) > 0) {
      if (!byDim.has(dk)) byDim.set(dk, []);
      byDim.get(dk).push(p);
    }
  }

  const duplicateNames = [...byName.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({ key, panels: arr }));

  const duplicateDims = [...byDim.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([key, arr]) => ({ key, panels: arr }));

  return { duplicateNames, duplicateDims };
};

export const addPanel = (panel) => {
  const panels = loadPanels();
  const newPanel = normalizePanel({ ...panel, id: genId() });

  const newNameKey = nameKeyOf(newPanel);
  const newDimKey = dimKeyOf(newPanel);

  // Duplicate NAME
  if (panels.some((p) => nameKeyOf(p) === newNameKey)) {
    throw new Error("Panel model name already exists.");
  }

  // Duplicate DIMENSIONS
  if (panels.some((p) => dimKeyOf(p) === newDimKey)) {
    throw new Error("A panel model with same Width × Height already exists.");
  }

  const next = [newPanel, ...panels];
  savePanels(next);
  return next;
};

export const updatePanel = (id, patch) => {
  const panels = loadPanels();
  const idx = panels.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Panel not found.");

  const updated = normalizePanel({ ...panels[idx], ...patch, id });
  const updNameKey = nameKeyOf(updated);
  const updDimKey = dimKeyOf(updated);

  // Duplicate NAME (ignore the same record)
  if (panels.some((p) => p.id !== id && nameKeyOf(p) === updNameKey)) {
    throw new Error("Another panel model already has this name.");
  }

  // Duplicate DIMENSIONS (ignore the same record)
  if (panels.some((p) => p.id !== id && dimKeyOf(p) === updDimKey)) {
    throw new Error("Another panel model already has same Width × Height.");
  }

  const next = panels.slice();
  next[idx] = updated;

  savePanels(next);
  return next;
};

export const deletePanel = (id) => {
  const panels = loadPanels();
  const next = panels.filter((p) => p.id !== id);
  savePanels(next);
  return next;
};
