"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { defaultPanels, findDuplicateByDims, loadPanels, savePanels } from "../lib/panelsStorage";

const fieldClass =
  "w-full h-12 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-3 " +
  "outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

const Navbar = () => {
  return (
    <nav className="bg-gray-950 md:bg-gray-900/60 md:backdrop-blur text-gray-100 p-4 flex items-center justify-between sticky top-0 z-30 border-b border-gray-800">
      <Link href="/" className="text-gray-100 rounded-lg hover:bg-gray-800 transition-colors px-3 py-2">
        ← Back
      </Link>

      <h1 className="text-lg sm:text-xl font-bold tracking-wide">List of Panels</h1>

      <div className="w-16" />
    </nav>
  );
};

export default function PanelsPage() {
  const [panelModels, setPanelModels] = useState(defaultPanels);

  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setPanelModels(loadPanels());
  }, []);

  const sortedPanels = useMemo(() => {
    return [...panelModels].sort((a, b) => a.name.localeCompare(b.name));
  }, [panelModels]);

  const addPanel = () => {
    const w = Number(width);
    const h = Number(height);

    if (!name.trim() || !(w > 0) || !(h > 0)) {
      alert("Enter valid Name, Width, Height.");
      return;
    }

    const dup = findDuplicateByDims(panelModels, w, h);
    if (dup) {
      alert(`Panel already exists: ${dup.name} (${dup.width}x${dup.height})`);
      return;
    }

    const newPanel = {
      name: name.trim(),
      width: w,
      height: h,
      description: (description || "Custom panel").trim(),
    };

    const next = [...panelModels, newPanel];
    setPanelModels(next);
    savePanels(next);

    setName("");
    setWidth("");
    setHeight("");
    setDescription("");
  };

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen antialiased">
      <Navbar />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className={`${cardClass} p-6`}>
          <h2 className="text-xl font-semibold mb-4 text-gray-100">Saved panels</h2>

          <ul className="space-y-3">
            {sortedPanels.map((p, idx) => (
              <li
                key={`${p.name}-${idx}`}
                className="bg-gray-950/40 border border-gray-800 rounded-xl p-4
                           transition-transform transition-shadow duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <div className="font-semibold text-gray-100">{p.name}</div>
                <div className="text-sm text-gray-300 mt-1">
                  {p.width} × {p.height} inches
                </div>
                <div className="text-xs text-gray-400 mt-1">{p.description}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${cardClass} p-6`}>
          <h2 className="text-xl font-semibold mb-4 text-gray-100">Add new panel</h2>

          {/* Simple + clean on desktop: name full, dims side-by-side on md+ */}
          <div className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm mb-2">Panel name</label>
              <input
                className={fieldClass}
                placeholder="Eg: Panel 45x90"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Width (inches)</label>
                <input
                  className={fieldClass}
                  placeholder="Eg: 45"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-2">Height (inches)</label>
                <input
                  className={fieldClass}
                  placeholder="Eg: 90"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 text-sm mb-2">Description (optional)</label>
              <textarea
                className="w-full rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-3 py-3 outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                placeholder="Eg: 500W mono panel"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <button
              onClick={addPanel}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition w-full"
            >
              Add New Panel
            </button>

            <div className="text-xs text-gray-400">
              Duplicate check is done using dimensions (W×H) and also swapped (H×W).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
