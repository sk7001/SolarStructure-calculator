"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deletePanel, getPanelById, updatePanel, type PanelRow } from "../../lib/panelsDb";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function EditPanelPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<PanelRow | null>(null);

  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const p = await getPanelById(id);
        setPanel(p);

        setName(p.name || "");
        setWidth(String(p.width ?? ""));
        setHeight(String(p.height ?? ""));
        setDescription(p.description || "");
      } catch (e: any) {
        setPanel(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onSave = async () => {
    if (!name || !width || !height) {
      alert("Please fill Name, Width, Height.");
      return;
    }

    try {
      await updatePanel(id, {
        name,
        width: Number(width),
        height: Number(height),
        description,
      });
      router.push("/panels");
    } catch (e: any) {
      alert(e?.message || "Failed to save.");
    }
  };

  const onDelete = async () => {
    const ok = confirm("Delete this panel model?");
    if (!ok) return;

    try {
      await deletePanel(id);
      router.push("/panels");
    } catch (e: any) {
      alert(e?.message || "Failed to delete.");
    }
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Edit panel</h1>
          <Link
            href="/panels"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
          >
            Back
          </Link>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : !panel ? (
            <div className="text-gray-400">
              Panel not found.{" "}
              <Link className="underline" href="/panels">
                Go back
              </Link>
            </div>
          ) : (
            <>
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
                onClick={onSave}
                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
              >
                Save Changes (Cloud)
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="mt-3 w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-3 rounded-lg shadow-md transition"
              >
                Delete Panel Model (Cloud)
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
