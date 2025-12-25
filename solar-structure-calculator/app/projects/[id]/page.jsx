"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getProjectById, setActiveProjectId, updateProject } from "../../lib/projectsStorage";
import { loadPanels } from "../../lib/panelsStorage";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [panelModels, setPanelModels] = useState([]);

  const [name, setName] = useState("");
  const [frontLegHeight, setFrontLegHeight] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [selectedPanelModel, setSelectedPanelModel] = useState("");
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    const models = loadPanels();
    setPanelModels(models);

    const p = getProjectById(id);
    setProject(p);

    if (p) {
      setName(p.name || "");
      setFrontLegHeight(p.inputs.frontLegHeight || "");
      setNumberOfPanels(p.inputs.numberOfPanels || "");
      setSelectedPanelModel(p.inputs.selectedPanelModel || models[0]?.name || "");
      setIsVertical(Boolean(p.inputs.isVertical));
    }

    setLoading(false);
  }, [id]);

  const summary = useMemo(() => {
    const r = project?.results;
    if (!r) return null;

    const structuresText = Array.isArray(r.structures)
      ? r.structures.map((s) => `${s.count}x${s.panels}`).join(" + ")
      : "-";

    const totalRods = r?.rods?.totals?.totalRodsNeeded ?? "-";
    const totalInches = r?.rods?.totals?.totalInchesRequired ?? "-";

    return { structuresText, totalRods, totalInches };
  }, [project]);

  const onSave = () => {
    if (!name.trim()) {
      alert("Project name required.");
      return;
    }

    try {
      const updated = updateProject(id, {
        name: name.trim(),
        inputs: { frontLegHeight, numberOfPanels, selectedPanelModel, isVertical },
        // keep existing results as-is (calculator will generate new results if needed)
        results: project?.results ?? null,
      });

      setProject(updated);
      alert("Saved.");
    } catch (e) {
      alert(e?.message || "Failed to save.");
    }
  };

  const onOpenInCalculator = () => {
    setActiveProjectId(id);
    router.push("/");
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Project</h1>
          <Link
            href="/projects"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
          >
            Back
          </Link>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : !project ? (
            <div className="text-gray-400">Project not found.</div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-4">Edit details</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2">Project name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Front Leg Height (in)</label>
                  <input
                    type="number"
                    value={frontLegHeight}
                    onChange={(e) => setFrontLegHeight(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2">Number of Panels</label>
                  <input
                    type="number"
                    value={numberOfPanels}
                    onChange={(e) => setNumberOfPanels(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2">Panel Model</label>
                  <select
                    value={selectedPanelModel}
                    onChange={(e) => setSelectedPanelModel(e.target.value)}
                    className={fieldClass}
                  >
                    {panelModels.map((m, idx) => (
                      <option key={`${m.name}-${idx}`} value={m.name}>
                        {m.name} - {m.width}x{m.height} - {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-300 mb-2">Orientation</label>
                  <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 h-14">
                    <input type="checkbox" checked={isVertical} onChange={(e) => setIsVertical(e.target.checked)} />
                    <span className="text-gray-300">Vertical</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onSave}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
              >
                Save Changes
              </button>

              <button
                type="button"
                onClick={onOpenInCalculator}
                className="mt-3 w-full bg-gray-800 hover:bg-gray-700 transition-colors text-white px-4 py-3 rounded-lg border border-gray-700"
              >
                Open in Calculator
              </button>
            </>
          )}
        </div>

        {project?.results ? (
          <div className={`${cardClass} p-6 mt-6`}>
            <h2 className="text-xl font-semibold mb-3">Saved results snapshot</h2>
            {summary ? (
              <div className="text-gray-300 text-sm space-y-1">
                <div>Structure distribution: {summary.structuresText}</div>
                <div>Total GI rods (164"): {summary.totalRods}</div>
                <div>Total inches: {summary.totalInches}</div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No summary available.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
