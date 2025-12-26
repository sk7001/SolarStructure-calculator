const STORAGE_KEY = "solar_projects_v2";
const ACTIVE_PROJECT_KEY = "solar_active_project_id_v1";

export type ProjectInputs = {
  frontLegHeight: string;
  numberOfPanels: string;
  selectedPanelModel: string;
  isVertical: boolean;
};

export type SolarProject = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  inputs: ProjectInputs;
  results: unknown | null;
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
  return `pr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalize = (p: unknown): SolarProject => {
  const obj = (p && typeof p === "object") ? (p as Record<string, any>) : {};

  const inputsObj = (obj.inputs && typeof obj.inputs === "object") ? (obj.inputs as Record<string, any>) : {};

  return {
    id: String(obj.id ?? genId()),
    name: String(obj.name ?? "").trim(),
    createdAt: Number(obj.createdAt ?? Date.now()),
    updatedAt: Number(obj.updatedAt ?? Date.now()),
    inputs: {
      frontLegHeight: String(inputsObj.frontLegHeight ?? ""),
      numberOfPanels: String(inputsObj.numberOfPanels ?? ""),
      selectedPanelModel: String(inputsObj.selectedPanelModel ?? ""),
      isVertical: Boolean(inputsObj.isVertical ?? false),
    },
    results: (obj.results ?? null) as unknown | null,
  };
};

export const loadProjects = (): SolarProject[] => {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeParse(raw) : [];
  const arr = Array.isArray(parsed) ? parsed : [];

  return arr.map(normalize).filter((p) => p.name);
};

export const saveProjects = (projects: SolarProject[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const getProjectById = (id: string): SolarProject | null => {
  const projects = loadProjects();
  return projects.find((p) => p.id === id) || null;
};

export const addProject = (input: {
  name: string;
  inputs?: Partial<ProjectInputs>;
  results?: unknown | null;
}): SolarProject => {
  const { name, inputs, results } = input;

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

export const updateProject = (id: string, patch: Partial<SolarProject>): SolarProject => {
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

export const deleteProject = (id: string): SolarProject[] => {
  const projects = loadProjects();
  const next = projects.filter((p) => p.id !== id);
  saveProjects(next);
  return next;
};

/** Used to jump from Projects -> Calculator with the selected project */
export const setActiveProjectId = (id: string | null | undefined): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROJECT_KEY, String(id ?? ""));
};

export const popActiveProjectId = (): string | null => {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(ACTIVE_PROJECT_KEY);
  localStorage.removeItem(ACTIVE_PROJECT_KEY);
  return id || null;
};
