const STORAGE_KEY = "solar_projects_v2";
const ACTIVE_PROJECT_KEY = "solar_active_project_id_v1";

const safeParse = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const genId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `pr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalize = (p) => ({
  id: String(p?.id || genId()),
  name: String(p?.name || "").trim(),
  createdAt: Number(p?.createdAt || Date.now()),
  updatedAt: Number(p?.updatedAt || Date.now()),
  inputs: {
    frontLegHeight: String(p?.inputs?.frontLegHeight ?? ""),
    numberOfPanels: String(p?.inputs?.numberOfPanels ?? ""),
    selectedPanelModel: String(p?.inputs?.selectedPanelModel ?? ""),
    isVertical: Boolean(p?.inputs?.isVertical ?? false),
  },
  results: p?.results ?? null,
});

export const loadProjects = () => {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : [];
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map(normalize).filter((p) => p.name);
};

export const saveProjects = (projects) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getProjectById = (id) => {
  const projects = loadProjects();
  return projects.find((p) => p.id === id) || null;
};

export const addProject = ({ name, inputs, results }) => {
  const projects = loadProjects();
  const item = normalize({
    name,
    inputs,
    results,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const next = [item, ...projects];
  saveProjects(next);
  return item;
};

export const updateProject = (id, patch) => {
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error("Project not found.");

  const updated = normalize({
    ...projects[idx],
    ...patch,
    id,
    updatedAt: Date.now(),
  });

  const next = projects.slice();
  next[idx] = updated;
  saveProjects(next);
  return updated;
};

export const deleteProject = (id) => {
  const projects = loadProjects();
  const next = projects.filter((p) => p.id !== id);
  saveProjects(next);
  return next;
};

/** Used to jump from Projects -> Calculator with the selected project */
export const setActiveProjectId = (id) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROJECT_KEY, String(id || ""));
};

export const popActiveProjectId = () => {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY);
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  return id || null;
};
