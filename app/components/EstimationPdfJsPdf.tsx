"use client";

import React from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CostData } from "../lib/costing";

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

async function loadAsDataURL(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load image: ${url}`);
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export default function EstimationPdfJsPdf({
  cost,
  projectName,
}: {
  cost: CostData | null;
  projectName: string;
}) {
  if (!cost) return null;

  const download = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "p" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;

    const dateStr = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // ===== Header =====
    const logoDataUrl = await loadAsDataURL("/talogo.png");

    const headerTopY = 30;
    const logoW = 48;
    const logoH = 48;

    doc.addImage(logoDataUrl, "PNG", margin, headerTopY, logoW, logoH);

    const leftTextX = margin + logoW + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("TARUN AGENCIES", leftTextX, headerTopY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text("Housing board, Rayagada, Odisha, 765001", leftTextX, headerTopY + 34);

    const rightX = pageW - margin;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0);
    const name = "Sridhar Kintali";
    doc.text(name, rightX - doc.getTextWidth(name), headerTopY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    const phones = "9437033750, 7381033750";
    doc.text(phones, rightX - doc.getTextWidth(phones), headerTopY + 34);

    const email = "tarunagencies25@gmail.com";
    const emailY = headerTopY + 48;

    doc.setTextColor(0, 0, 255);
    doc.textWithLink(email, rightX - doc.getTextWidth(email), emailY, { url: `mailto:${email}` });
    doc.setTextColor(60);

    const headerBottomY = headerTopY + logoH + 14;
    doc.setDrawColor(200);
    doc.line(margin, headerBottomY, pageW - margin, headerBottomY);

    const dateLine = `Date: ${dateStr}`;
    const dateY = headerBottomY + 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(dateLine, rightX - doc.getTextWidth(dateLine), dateY);

    const titleY = headerBottomY + 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text("Solar Structure Cost Estimation", pageW / 2, titleY, { align: "center" });

    let contentStartY = titleY + 22;
    if (projectName?.trim()) {
      const p = `Project: ${projectName.trim()}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text(p, pageW / 2, titleY + 16, { align: "center" });
      contentStartY = titleY + 32;
    }

    // ===== Wastage baked into Rod per-inch =====
    const pct = Number(cost.price.wastagePct) || 0;
    const factor = 1 + pct / 100;

    const effectiveRodPerInch = cost.price.rodPerInch * factor;
    const rodTotal = cost.qty.inchesUsed * effectiveRodPerInch;

    // Recompute material subtotal so table totals match (no separate wastage row)
    const materialSubtotal =
      rodTotal +
      cost.items.basePlates +
      cost.items.anchorBolts +
      cost.items.angleFitters +
      cost.items.normalBolts;

    // Recompute grand total for PDF
    const grandTotal =
      materialSubtotal +
      cost.price.service +
      (cost.price.installation ?? 0);

    const breakdownRows: any[] = [
      [
        "  Rod (GI)",
        `${cost.qty.inchesUsed.toFixed(2)} in`,
        `INR ${money(effectiveRodPerInch)}/in`,
        `INR ${money(rodTotal)}`,
      ],
      [
        "  Base Plates",
        `${cost.qty.basePlates} units`,
        `INR ${money(cost.price.basePlate)}/unit`,
        `INR ${money(cost.items.basePlates)}`,
      ],
      [
        "  Anchor Bolts",
        `${cost.qty.anchorBolts} units`,
        `INR ${money(cost.price.anchorBolt)}/unit`,
        `INR ${money(cost.items.anchorBolts)}`,
      ],
      [
        "  Angle Finders",
        `${cost.qty.angleFitters} units`,
        `INR ${money(cost.price.angleFitter)}/unit`,
        `INR ${money(cost.items.angleFitters)}`,
      ],
      [
        "  Nuts (Normal bolts)",
        `${cost.qty.normalBolts} units`,
        `INR ${money(cost.price.normalBolt)}/unit`,
        `INR ${money(cost.items.normalBolts)}`,
      ],
    ];

    const mainBody: any[] = [
      ["Materials", "", "", `INR ${money(materialSubtotal)}`],
      ...breakdownRows,
      ["Fabrication charges", "", "", `INR ${money(cost.price.service)}`],
      ["Installation charges", "", "", `INR ${money(cost.price.installation ?? 0)}`],
      ["GRAND TOTAL", "", "", `INR ${money(grandTotal)}`],
    ];

    autoTable(doc, {
      startY: contentStartY,
      theme: "grid",
      head: [["Item", "Quantity", "Price/Unit", "Total (INR)"]],
      body: mainBody,
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: "bold" },
      didParseCell: (data) => {
        if (data.column.index === 0) data.cell.styles.halign = "left";
        if (data.column.index >= 1) data.cell.styles.halign = "right";

        if (data.section === "body") {
          const label = String((data.row.raw as any[])[0] ?? "").trim();
          if (["Materials", "Fabrication charges", "Installation charges", "GRAND TOTAL"].includes(label)) {
            data.cell.styles.fontStyle = "bold";
          }
          if (label === "GRAND TOTAL") {
            data.cell.styles.fillColor = [220, 252, 231];
          }
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? contentStartY;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Note: This is an estimation. Final amount may change based on site conditions.", margin, finalY + 25);

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
