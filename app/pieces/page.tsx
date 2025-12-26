"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clearPieces, createPiece, deletePieceById, listPieces, type PieceRow } from "../lib/piecesDb";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function PiecesPage() {
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);

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
      await createPiece({ len: L, qty: Q, note });
      await refresh();

      setLen("");
      setQty("");
      setNote("");
    } catch (e: any) {
      alert(e?.message || "Failed to add piece.");
    }
  };

  const onDelete = async (id: string) => {
    const ok = confirm("Delete this inventory line?");
    if (!ok) return;

    try {
      await deletePieceById(id);
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to delete.");
    }
  };

  const onClear = async () => {
    const ok = confirm("Clear ALL usable pieces inventory?");
    if (!ok) return;

    try {
      await clearPieces();
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to clear.");
    }
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Usable Pieces (Inventory)</h1>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <div className="text-gray-300 text-sm">
            Saved lines: <span className="text-gray-100 font-semibold">{totals.lines}</span> | Total qty:{" "}
            <span className="text-gray-100 font-semibold">{totals.totalQty}</span>
          </div>

          <h2 className="text-xl font-semibold mt-4 mb-4">Add usable piece</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 mb-2">Length (inches)</label>
              <input type="number" value={len} onChange={(e) => setLen(e.target.value)} className={fieldClass} />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Quantity</label>
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={fieldClass} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-300 mb-2">Note (optional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} />
            </div>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
          >
            Add to inventory (Cloud)
          </button>

          <button
            type="button"
            onClick={onClear}
            className="mt-3 w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-3 rounded-lg shadow-md transition"
          >
            Clear inventory (Cloud)
          </button>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <h2 className="text-xl font-semibold mb-4">Saved usable pieces</h2>

          {loading ? (
            <div className="text-gray-400">Loading...</div>
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
                    {p.note ? <div className="text-gray-400 text-sm mt-1">{p.note}</div> : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDelete(p.id)}
                    className="shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
