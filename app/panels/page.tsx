"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  createPanel,
  listPanels,
  seedDefaultPanelsIfEmpty,
  type PanelRow,
} from "../lib/panelsDb";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

// Spinner component
function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-gray-200">
      <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label ? <div className="text-sm">{label}</div> : null}
    </div>
  );
}

// Full-screen buffering overlay
function ProcessingOverlay({ open, label }: { open: boolean; label?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div className="rounded-xl border border-gray-800 bg-gray-950 px-5 py-4 shadow-2xl">
        <Spinner label={label || "Processing..."} />
      </div>
    </div>
  );
}

// Same modal pattern as your other page [file:150]
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="fixed inset-0 bg-black/60"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-800">
            <div className="text-gray-100 font-semibold text-base sm:text-lg">
              {title}
            </div>
          </div>
          <div className="p-4 sm:p-5 overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function PanelsPage() {
  const [panels, setPanels] = useState<PanelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Label for overlay
  const [busyLabel, setBusyLabel] = useState<string>("Processing...");

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
        setBusyLabel("Loading panels...");
        setLoading(true);

        // keep same logic as your code
        await seedDefaultPanelsIfEmpty();
        await refresh();
      } catch (e: any) {
        alert(e?.message || "Failed to load panels from cloud.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const resetForm = () => {
    setName("");
    setWidth("");
    setHeight("");
    setDescription("");
  };

  const onAdd = async () => {
    if (!name || !width || !height) {
      alert("Please fill Name, Width, Height.");
      return;
    }

    try {
      setBusyLabel("Saving panel to cloud...");
      setSaving(true);

      await createPanel({
        name,
        width: Number(width),
        height: Number(height),
        description,
      });

      await refresh();
      resetForm();
      setAddOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to add panel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      {/* Buffering overlay */}
      <ProcessingOverlay open={saving} label={busyLabel} />

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">List of panels</h1>

          <button
            type="button"
            disabled={saving}
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 border border-blue-700 transition disabled:opacity-60"
          >
            Add new panel
          </button>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <h2 className="text-xl font-semibold mb-4">Saved panels</h2>

          {loading ? (
            <div className="text-gray-400 flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-gray-500 border-t-transparent animate-spin" />
              Loading...
            </div>
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
                    {p.description ? (
                      <div className="text-gray-400 text-sm mt-1">
                        {p.description}
                      </div>
                    ) : null}
                  </div>

                  <Link
                    href={`/panels/${p.id}`}
                    className={`shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700 ${
                      saving ? "pointer-events-none opacity-60" : ""
                    }`}
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={addOpen}
        title="Add panel"
        onClose={() => {
          if (saving) return;
          setAddOpen(false);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 mb-2">Name</label>
            <input
              disabled={saving}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Description</label>
            <input
              disabled={saving}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Width (in)</label>
            <input
              disabled={saving}
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Height (in)</label>
            <input
              disabled={saving}
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setAddOpen(false);
              resetForm();
            }}
            className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700 text-gray-100 text-sm disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onAdd}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors px-4 py-2 border border-blue-700 text-white text-sm disabled:opacity-60"
          >
            {saving ? "Saving..." : "Add Panel (Cloud)"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
