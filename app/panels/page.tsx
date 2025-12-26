"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createPanel, listPanels, seedDefaultPanelsIfEmpty, type PanelRow } from "../lib/panelsDb";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function PanelsPage() {
  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [description, setDescription] = useState("");

  const refresh = async () => {
    const rows = await listPanels();
    setPanels(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await seedDefaultPanelsIfEmpty(); // optional: keep your “hardcoded” ones by pushing once
        await refresh();
      } catch (e: any) {
        alert(e?.message || "Failed to load panels from cloud.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onAdd = async () => {
    if (!name || !width || !height) {
      alert("Please fill Name, Width, Height.");
      return;
    }

    try {
      await createPanel({
        name,
        width: Number(width),
        height: Number(height),
        description,
      });

      await refresh();

      setName("");
      setWidth("");
      setHeight("");
      setDescription("");
    } catch (e: any) {
      alert(e?.message || "Failed to add panel.");
    }
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">List of panels</h1>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <h2 className="text-xl font-semibold mb-4">Add panel</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Width (in)</label>
              <input type="number" value={width} onChange={(e) => setWidth(e.target.value)} className={fieldClass} />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Height (in)</label>
              <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
          >
            Add Panel (Cloud)
          </button>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <h2 className="text-xl font-semibold mb-4">Saved panels</h2>

          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : panels.length === 0 ? (
            <div className="text-gray-400">No panels found.</div>
          ) : (
            <div className="space-y-3">
              {panels.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="text-gray-100 font-semibold">{p.name}</div>
                    <div className="text-gray-300 text-sm mt-1">
                      {p.width} × {p.height} (in)
                    </div>
                    {p.description ? <div className="text-gray-400 text-sm mt-1">{p.description}</div> : null}
                  </div>

                  <Link
                    href={`/panels/${p.id}`}
                    className="shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
