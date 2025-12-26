"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { listProjects, deleteProject, type ProjectRow } from "../lib/projectsDb";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const rows = await listProjects();
    setProjects(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: any) {
        alert(e?.message || "Failed to load projects from cloud.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasProjects = projects.length > 0;

  const onDelete = async (id: string) => {
    const ok = confirm("Delete this project?");
    if (!ok) return;

    try {
      await deleteProject(id);
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to delete project.");
    }
  };

  const onOpen = (id: string) => {
    // Open in calculator page using query param (cloud-friendly)
    router.push(`/?projectId=${id}`);
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Projects</h1>

          <div className="flex items-center gap-2">
            {hasProjects ? (
              <Link
                href="/"
                className="rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 border border-blue-500"
              >
                Add Project
              </Link>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className={`${cardClass} p-8 w-full max-w-md text-center`}>
              <div className="text-gray-400">Loading...</div>
            </div>
          </div>
        ) : !hasProjects ? (
          <div className="min-h-[70vh] flex items-center justify-center">
            <div className={`${cardClass} p-8 w-full max-w-md text-center`}>
              <div className="text-gray-200 font-semibold text-lg">No projects yet</div>
              <div className="text-gray-400 text-sm mt-2">
                Save a project from the Calculator (bottom button).
              </div>

              <Link
                href="/"
                className="mt-6 inline-block w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
              >
                Go to Calculator
              </Link>
            </div>
          </div>
        ) : (
          <div className={`${cardClass} p-6 mt-6`}>
            <h2 className="text-xl font-semibold mb-4">Saved projects</h2>

            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="text-gray-100 font-semibold">{p.name}</div>
                    <div className="text-gray-400 text-sm mt-1">
                      Panels: {p.inputs?.numberOfPanels || "-"} | Model: {p.inputs?.selectedPanelModel || "-"} |{" "}
                      {p.inputs?.isVertical ? "Vertical" : "Horizontal"}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 border border-blue-500"
                    >
                      Open
                    </button>

                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="rounded-lg bg-red-600 hover:bg-red-700 transition-colors px-4 py-2 border border-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
