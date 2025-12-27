"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  clearPieces,
  createPiece,
  deletePieceById,
  listPieces,
  type PieceRow,
} from "../lib/piecesDb";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

// Simple spinner
function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-gray-200">
      <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label ? <div className="text-sm">{label}</div> : null}
    </div>
  );
}

// Full-screen processing overlay
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
          <div className="px-4 sm:px-5 py-4 border-b border-gray-800">
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

export default function PiecesPage() {
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Optional: show what action is running (nice UX)
  const [busyLabel, setBusyLabel] = useState<string>("Processing...");

  const [len, setLen] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  const refresh = async () => {
    const rows = await listPieces();
    setPieces(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (e: any) {
        alert(e?.message || "Failed to load pieces from cloud.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    return {
      lines: pieces.length,
      totalQty: pieces.reduce((s, p) => s + (Number(p.qty) || 0), 0),
    };
  }, [pieces]);

  const resetForm = () => {
    setLen("");
    setQty("");
    setNote("");
  };

  const onUseOne = async (p: PieceRow) => {
    const currentQty = Number(p.qty) || 0;
    if (currentQty <= 0) return;

    try {
      setBusyLabel(`Using 1 piece of ${p.len}"...`);
      setSaving(true);

      const nextQty = currentQty - 1;

      if (nextQty <= 0) {
        await deletePieceById(p.id);
      } else {
        await deletePieceById(p.id);
        await createPiece({
          len: Number(p.len),
          qty: nextQty,
          note: p.note || "",
        });
      }

      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to update qty.");
    } finally {
      setSaving(false);
    }
  };

  const onAdd = async () => {
    if (!len || !qty) {
      alert("Please fill Length and Quantity.");
      return;
    }

    const L = Number(len);
    const Q = parseInt(qty, 10);

    if (!(L > 0) || !(Q > 0)) {
      alert("Length and Quantity must be > 0.");
      return;
    }

    try {
      setBusyLabel("Adding to inventory...");
      setSaving(true);

      const existing = pieces.find((p) => Number(p.len) === L);

      if (!existing) {
        await createPiece({ len: L, qty: Q, note });
      } else {
        const newQty = (Number(existing.qty) || 0) + Q;
        await deletePieceById(existing.id);
        await createPiece({
          len: L,
          qty: newQty,
          note:
            existing.note && String(existing.note).trim()
              ? existing.note
              : note,
        });
      }

      await refresh();
      resetForm();
      setAddOpen(false);
    } catch (e: any) {
      alert(e?.message || "Failed to add piece.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = confirm("Delete this inventory line?");
    if (!ok) return;

    try {
      setBusyLabel("Deleting line...");
      setSaving(true);
      await deletePieceById(id);
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  const onClear = async () => {
    const ok = confirm("Clear ALL usable pieces inventory?");
    if (!ok) return;

    try {
      setBusyLabel("Clearing inventory...");
      setSaving(true);
      await clearPieces();
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to clear.");
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
          <h1 className="text-2xl font-bold">Usable Pieces (Inventory)</h1>

          <button
            type="button"
            disabled={saving}
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 border border-blue-700 transition disabled:opacity-60"
          >
            Add usable piece
          </button>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <div className="text-gray-300 text-sm">
            Saved lines:{" "}
            <span className="text-gray-100 font-semibold">{totals.lines}</span>{" "}
            | Total qty:{" "}
            <span className="text-gray-100 font-semibold">
              {totals.totalQty}
            </span>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClear}
            className="mt-4 w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-3 rounded-lg shadow-md transition disabled:opacity-60"
          >
            {saving ? "Working..." : "Clear inventory (Cloud)"}
          </button>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <h2 className="text-xl font-semibold mb-4">Saved usable pieces</h2>

          {loading ? (
            <div className="text-gray-400 flex items-center gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-gray-500 border-t-transparent animate-spin" />
              Loading...
            </div>
          ) : pieces.length === 0 ? (
            <div className="text-gray-400">No saved pieces.</div>
          ) : (
            <div className="space-y-3">
              {pieces.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="text-gray-100 font-semibold">
                      {p.len}" × {p.qty}
                    </div>
                    {p.note ? (
                      <div className="text-gray-400 text-sm mt-1">{p.note}</div>
                    ) : null}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saving || (Number(p.qty) || 0) <= 0}
                      onClick={() => onUseOne(p)}
                      className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-3 py-2 border border-gray-700 disabled:opacity-60"
                      title="Use 1 piece"
                    >
                      -1
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onDelete(p.id)}
                      className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={addOpen}
        title="Add usable piece"
        onClose={() => {
          if (saving) return;
          setAddOpen(false);
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 mb-2">Length (inches)</label>
            <input
              type="number"
              value={len}
              onChange={(e) => setLen(e.target.value)}
              className={fieldClass}
              disabled={saving}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Quantity</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={fieldClass}
              disabled={saving}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-gray-300 mb-2">Note (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={fieldClass}
              disabled={saving}
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
            {saving ? "Saving..." : "Add to inventory (Cloud)"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
