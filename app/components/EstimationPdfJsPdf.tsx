"use client";

import React from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CostData } from "../lib/costing";

const money = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

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
}: {
  cost: CostData | null;
  projectName: string; // kept in props type but unused
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

    // ===== Header (logo + business details + contact) =====
    const logoDataUrl = await loadAsDataURL("/talogo.png");

    const headerTopY = 30;
    const logoW = 48;
    const logoH = 48;

    // Logo (top-left)
    doc.addImage(logoDataUrl, "PNG", margin, headerTopY, logoW, logoH);

    // Left text (after logo)
    const leftTextX = margin + logoW + 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("TARUN AGENCIES", leftTextX, headerTopY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(
      "Housing board, Rayagada, Odisha, 765001",
      leftTextX,
      headerTopY + 34
    );

    // Right block (top-right)
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

    // Email (clickable mailto)
    doc.setTextColor(0, 0, 255);
    doc.textWithLink(email, rightX - doc.getTextWidth(email), emailY, {
      url: `mailto:${email}`,
    });
    doc.setTextColor(60);

    // Divider line under header
    const headerBottomY = headerTopY + logoH + 14;
    doc.setDrawColor(200);
    doc.line(margin, headerBottomY, pageW - margin, headerBottomY);

    // ===== Date BELOW the line (top-right) =====
    const dateLine = `Date: ${dateStr}`;
    const dateY = headerBottomY + 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(dateLine, rightX - doc.getTextWidth(dateLine), dateY);

    // ===== Center title =====
    const titleY = headerBottomY + 40;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0);
    doc.text("Solar Structure Cost Estimation", pageW / 2, titleY, {
      align: "center",
    });

    // Start content directly after title (no project name)
    const contentStartY = titleY + 28;

    // ===== Wastage baked into rod per-inch =====
    const wastagePct = Number(cost.price.wastagePct) || 0;
    const factor = 1 + wastagePct / 100;
    const effectiveRodPerInch = cost.price.rodPerInch * factor;
    const rodTotalWithWastage = cost.qty.inchesUsed * effectiveRodPerInch;

    // Recompute material subtotal for PDF (visual only)
    const materialSubtotal =
      rodTotalWithWastage +
      cost.items.basePlates +
      cost.items.anchorBolts +
      cost.items.angleFitters +
      (cost.items as any).uClamps +
      cost.items.normalBolts;

    const breakdownRows: any[] = [
      [
        "  GI 42 X 42 X 2mm slotted channels",
        `${cost.qty.inchesUsed.toFixed(2)} in`,
        `INR ${money(effectiveRodPerInch)}/in`,
        `INR ${money(rodTotalWithWastage)}`,
      ],
      [
        "  Base Plate",
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
        "  Angle Finder",
        `${cost.qty.angleFitters} units`,
        `INR ${money(cost.price.angleFitter)}/unit`,
        `INR ${money(cost.items.angleFitters)}`,
      ],
      [
        "  GI U-Clamp",
        `${(cost.qty as any).uClamps ?? 0} units`,
        `INR ${money((cost.price as any).uClamp ?? 0)}/unit`,
        `INR ${money((cost.items as any).uClamps ?? 0)}`,
      ],
      [
        "  Nuts and bolts",
        `${cost.qty.normalBolts} units`,
        `INR ${money(cost.price.normalBolt)}/unit`,
        `INR ${money(cost.items.normalBolts)}`,
      ],
    ];

    const mainBody: any[] = [
      ["Materials", "", "", `INR ${money(materialSubtotal)}`],
      ...breakdownRows,
      ["Fabrication charges", "", "", `INR ${money(cost.price.service)}`],
      [
        "Installation charges",
        "",
        "",
        `INR ${money(cost.price.installation ?? 0)}`,
      ],
      ["GRAND TOTAL", "", "", `INR ${money(cost.total)}`],
    ];

    autoTable(doc, {
      startY: contentStartY,
      theme: "grid",
      head: [["Item", "Quantity", "Price/Unit", "Total (INR)"]],
      body: mainBody,
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [41, 41, 41], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 180 },
      },
      didParseCell: (data) => {
        if (data.column.index === 0) data.cell.styles.halign = "left";
        if (data.column.index >= 1) data.cell.styles.halign = "right";

        if (data.section === "body") {
          const label = String((data.row.raw as any[])[0] ?? "").trim();
          if (
            ["Materials", "Fabrication charges", "Installation charges", "GRAND TOTAL"].includes(
              label
            )
          ) {
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
    doc.setTextColor(120);
    doc.text(
      "Note: This is an estimation. Final amount may change based on site conditions.",
      margin,
      finalY + 24
    );

    doc.save(`Estimation-Project-${Date.now()}.pdf`);
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
