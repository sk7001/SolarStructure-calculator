export const PANELS_KEY = "solar_panel_models_v1";

export const defaultPanels = [
  { name: "Panel 45x90", width: 45, height: 90, description: "Default panel model" },
];

export const loadPanels = () => {
  if (typeof window === "undefined") return defaultPanels;
  try {
    const raw = localStorage.getItem(PANELS_KEY);
    if (!raw) return defaultPanels;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultPanels;
    return parsed;
  } catch {
    return defaultPanels;
  }
};

export const savePanels = (panels) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
};

export const findDuplicateByDims = (panels, width, height) => {
  const w = Number(width);
  const h = Number(height);

  return panels.find((p) => {
    const pw = Number(p.width);
    const ph = Number(p.height);
    return (pw === w && ph === h) || (pw === h && ph === w);
  });
};
