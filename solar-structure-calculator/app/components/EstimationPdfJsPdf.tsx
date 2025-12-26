"use client";

import React from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CostData } from "../lib/costing";

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function EstimationPdfJsPdf({
  cost,
  projectName,
}: {
  cost: CostData | null;
  projectName: string;
}) {
  if (!cost) return null;

  const download = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "p" });

    const dateStr = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Solar Structure Cost Estimation", 40, 50);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${dateStr}`, 40, 70);
    if (projectName?.trim()) doc.text(`Project: ${projectName.trim()}`, 40, 85);

    // Table
    autoTable(doc, {
      startY: 110,
      theme: "grid",
      head: [["Item", "Amount (INR)"]],
      body: [
        ["Subtotal", `INR ${money(cost.subtotal)}`],
        [`Wastage (${Number(cost.price.wastagePct).toFixed(0)}%)`, `INR ${money(cost.wastage)}`],
        ["Service charges", `INR ${money(cost.price.service)}`],
        ["GRAND TOTAL", `INR ${money(cost.total)}`],
      ],
      styles: { font: "helvetica", fontSize: 11, cellPadding: 6 },
      headStyles: { fillColor: [17, 24, 39], textColor: 255 }, // dark header
      didParseCell: (data) => {
        // Right align amount column
        if (data.column.index === 1) data.cell.styles.halign = "right";

        // Style GRAND TOTAL row (last row)
        if (data.section === "body" && data.row.index === 3) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 252, 231]; // light green
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 110;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Note: This is an estimation. Final amount may change based on site conditions.", 40, finalY + 25);

    doc.save(`Estimation-${(projectName || "Project").replaceAll(" ", "-")}-${Date.now()}.pdf`);
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-6 mt-6">
      <button
        type="button"
        onClick={download}
        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-3 rounded-lg shadow-md transition font-semibold"
      >
        Download estimation PDF
      </button>
    </div>
  );
}
