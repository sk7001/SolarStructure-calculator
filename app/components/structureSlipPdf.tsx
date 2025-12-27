"use client";

import React from "react";
import jsPDF from "jspdf";

const money = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface StructureSlipData {
  projectName: string;
  date: string;
  panelModel: string;
  panelLen: number; // long side (inches)
  panelWid: number; // short side (inches)
  totalPanels: number;
  orientation: string; // "Horizontal" | "Vertical"
  frontLegHeight: number;
  rearLegHeight: number;
  tiltAngle: number; // degrees (ex: 19)
  footprintLen: number;
  footprintWid: number;
  structures: any[];
  totalRods: number;
  totalInches: string | number;
  totalFrontLegs: number;
  totalRearLegs: number;
  totalHypoRods: number;
  cuttingPatterns: any[];
  totalWaste: string;
  hardware: any;
  cost: any;
}

export default function StructureSlipPdf({ data }: { data: StructureSlipData }) {
  const downloadPdf = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    let yPos = 32;

    const safeNum = (v: any) => Number(v) || 0;
    const safeStr = (v: any) => String(v ?? "-");

    const fmtInches = (v: any) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return "-";
      const isInt = Math.abs(n - Math.round(n)) < 1e-9;
      return isInt ? `${Math.round(n)}"` : `${n.toFixed(2)}"`;
    };

    // ===== Footprint logic (your rule) =====
    // - Remove 1/6 left + 1/6 right => multiply by 2/3
    // - For front-to-back (base) use cos(tiltAngle) because panel "width" lies on hypotenuse
    // Assumption:
    // - panelLen is the left-to-right direction (row direction / along rod)
    // - panelWid is the front-to-back sloped direction (on hypotenuse)
    const tiltRad = (safeNum(data.tiltAngle) * Math.PI) / 180;
    const shrink = 2 / 3;

    const panelFootprintLeftRight = safeNum(data.panelLen) * shrink;
    const panelFootprintFrontBack = safeNum(data.panelWid) * shrink * Math.cos(tiltRad);

    // ===== Header =====
    const addHeader = () => {
      doc.setFillColor(0, 102, 204);
      doc.rect(0, 0, pageWidth, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("STRUCTURE SLIP", pageWidth / 2, 15, { align: "center" });

      doc.setFontSize(9);
      doc.text("Solar Structure Fabrication Document", pageWidth / 2, 21, {
        align: "center",
      });
    };

    const addProjectInfo = () => {
      yPos = 32;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      doc.setFont("helvetica", "bold");
      doc.text("Project:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(safeStr(data.projectName), margin + 22, yPos);

      yPos += 5;

      doc.setFont("helvetica", "bold");
      doc.text("Date:", margin, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(safeStr(data.date), margin + 22, yPos);

      yPos += 7;
    };

    const newPageIfNeeded = (estimatedHeight: number) => {
      if (yPos + estimatedHeight > pageHeight - 15) {
        doc.addPage();
        addHeader();
        addProjectInfo();
      }
    };

    type TableColors = {
      titleFill: [number, number, number];
      titleBorder: [number, number, number];
      headFill: [number, number, number];
      headText: [number, number, number];
      rowEven: [number, number, number];
      rowOdd: [number, number, number];
      border: [number, number, number];
    };

    type StructureRow = { isTitle: boolean; cells: (string | number)[] };

    const drawStyledTable = (
      title: string,
      head: string[],
      body: (string | number)[][],
      colWidths: number[] | undefined,
      colors: TableColors,
      rowBoldFlags?: boolean[]
    ) => {
      if (!body.length) return;

      const tableWidth = pageWidth - margin * 2;
      let widths: number[];

      if (colWidths && colWidths.length === head.length) {
        const sum = colWidths.reduce((a, b) => a + b, 0);
        widths =
          sum > 0.95 && sum < 1.05
            ? colWidths.map((f) => f * tableWidth)
            : colWidths;
      } else {
        const colWidth = tableWidth / head.length;
        widths = head.map(() => colWidth);
      }

      const titleHeight = 8;
      const headerHeight = 7;
      const rowHeight = 6;
      const totalHeight = titleHeight + headerHeight + body.length * rowHeight + 3;

      newPageIfNeeded(totalHeight);

      const topY = yPos;

      // Title bar
      doc.setFillColor(...colors.titleFill);
      doc.setDrawColor(...colors.titleBorder);
      doc.rect(margin, topY, tableWidth, titleHeight, "F");
      doc.rect(margin, topY, tableWidth, titleHeight, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin + 3, topY + 5);

      // Header
      let y = topY + titleHeight;
      doc.setFillColor(...colors.headFill);
      doc.rect(margin, y, tableWidth, headerHeight, "F");
      doc.setTextColor(...colors.headText);
      doc.setFontSize(8);

      let x = margin;
      head.forEach((h, i) => {
        doc.text(String(h), x + 2, y + 4);
        x += widths[i];
      });
      y += headerHeight;

      // Body rows
      doc.setFontSize(8);
      body.forEach((row, index) => {
        const isEven = index % 2 === 0;
        const bg = isEven ? colors.rowEven : colors.rowOdd;

        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.rect(margin, y, tableWidth, rowHeight, "F");
        doc.setTextColor(0, 0, 0);

        const makeBold = rowBoldFlags?.[index] === true;
        doc.setFont("helvetica", makeBold ? "bold" : "normal");

        let cx = margin;
        row.forEach((cell, i) => {
          doc.text(String(cell), cx + 2, y + 3, { maxWidth: widths[i] - 4 });
          cx += widths[i];
        });

        y += rowHeight;
      });

      doc.setFont("helvetica", "normal");

      // Border
      doc.setDrawColor(...colors.border);
      doc.rect(margin, topY, tableWidth, y - topY, "S");

      yPos = y + 2;
    };

    // Soft color sets
    const colorsPanel: TableColors = {
      titleFill: [235, 244, 255],
      titleBorder: [180, 200, 230],
      headFill: [92, 136, 218],
      headText: [255, 255, 255],
      rowEven: [246, 249, 255],
      rowOdd: [236, 242, 252],
      border: [180, 200, 230],
    };

    const colorsStructures: TableColors = {
      titleFill: [233, 247, 238],
      titleBorder: [170, 205, 180],
      headFill: [76, 156, 110],
      headText: [255, 255, 255],
      rowEven: [241, 252, 244],
      rowOdd: [230, 245, 236],
      border: [170, 205, 180],
    };

    const colorsRods: TableColors = {
      titleFill: [255, 245, 230],
      titleBorder: [220, 190, 150],
      headFill: [214, 144, 62],
      headText: [255, 255, 255],
      rowEven: [255, 249, 238],
      rowOdd: [252, 241, 225],
      border: [220, 190, 150],
    };

    const colorsCutting: TableColors = {
      titleFill: [250, 236, 245],
      titleBorder: [210, 170, 200],
      headFill: [192, 80, 135],
      headText: [255, 255, 255],
      rowEven: [252, 242, 248],
      rowOdd: [244, 230, 240],
      border: [210, 170, 200],
    };

    const colorsHardware: TableColors = {
      titleFill: [238, 236, 250],
      titleBorder: [190, 180, 220],
      headFill: [142, 36, 170],
      headText: [255, 255, 255],
      rowEven: [248, 248, 255],
      rowOdd: [238, 238, 252],
      border: [190, 180, 220],
    };

    const colorsCostSummary: TableColors = {
      titleFill: [234, 248, 234],
      titleBorder: [170, 205, 170],
      headFill: [52, 132, 80],
      headText: [255, 255, 255],
      rowEven: [241, 252, 241],
      rowOdd: [230, 245, 230],
      border: [170, 205, 170],
    };

    const colorsBreakdown: TableColors = {
      titleFill: [255, 247, 231],
      titleBorder: [215, 190, 140],
      headFill: [190, 120, 52],
      headText: [255, 255, 255],
      rowEven: [255, 250, 239],
      rowOdd: [250, 243, 228],
      border: [215, 190, 140],
    };

    // -------- PAGE 1 --------
    addHeader();
    addProjectInfo();

    // PANEL DETAILS (Rear leg removed, Footprint added)
    drawStyledTable(
      "PANEL DETAILS",
      ["Property", "Value", "Property", "Value"],
      [
        ["Model", safeStr(data.panelModel), "Orientation", safeStr(data.orientation)],
        ["Total Panels", safeNum(data.totalPanels), "Tilt Angle", `${safeNum(data.tiltAngle)}°`],
        [
          "Panel Size",
          `${safeNum(data.panelLen)}" x ${safeNum(data.panelWid)}"`,
          "Footprint (Leg-Leg)",
          `${panelFootprintLeftRight.toFixed(1)}" x ${panelFootprintFrontBack.toFixed(1)}"`,
        ],
        ["Front Leg", fmtInches(data.frontLegHeight), "", ""],
      ],
      [0.18, 0.32, 0.18, 0.32],
      colorsPanel
    );

    // STRUCTURE BREAKDOWN – now includes individual footprint per structure type
    const structureRowsObjects: StructureRow[] =
      (data.structures || []).length > 0
        ? (data.structures as any[]).flatMap((s: any) => {
            const panelsPerStructure = safeNum(s.panels);

            // Individual footprint for this structure:
            // Left-right: panels count * panelLen * (2/3)
            const structLeftRight = panelsPerStructure * safeNum(data.panelLen) * shrink;

            // Front-back: panelWid * (2/3) * cos(tilt)
            const structFrontBack = safeNum(data.panelWid) * shrink * Math.cos(tiltRad);

            const panelsLabel = `${safeNum(s.count)} × ${panelsPerStructure}-panel structure`;
            const footprintText = `Footprint: ${structLeftRight.toFixed(1)}" x ${structFrontBack.toFixed(1)}"`;

            const frontLegLen = s.legs?.frontLegHeight ?? data.frontLegHeight ?? 0;
            const rearLegLen = s.legs?.rearLegHeight ?? data.rearLegHeight ?? 0;

            const hypoLen =
              s.legs?.hypoRodLength ??
              s.hypoRodLength ??
              s.legs?.hypotenuseRodLength ??
              s.hypotenuseRodLength ??
              0;

            return [
              { isTitle: true, cells: [panelsLabel, footprintText] },
              {
                isTitle: false,
                cells: ["Front legs", `${safeNum(s.frontLegsCount)} × ${fmtInches(frontLegLen)}`],
              },
              {
                isTitle: false,
                cells: ["Rear legs", `${safeNum(s.rearLegsCount)} × ${fmtInches(rearLegLen)}`],
              },
              {
                isTitle: false,
                cells: ["Hypotenuse rods (GI)", `${safeNum(s.hypoRodsCount)} × ${fmtInches(hypoLen)}`],
              },
            ];
          })
        : [{ isTitle: false, cells: ["No data", "-"] }];

    const structuresRows = structureRowsObjects.map((r) => r.cells);
    const structuresBoldFlags = structureRowsObjects.map((r) => r.isTitle);

    drawStyledTable(
      "STRUCTURE BREAKDOWN",
      ["Description", "Details"],
      structuresRows,
      [0.62, 0.38],
      colorsStructures,
      structuresBoldFlags
    );

    // ROD TOTALS (keep short)
    drawStyledTable(
      "ROD TOTALS",
      ["Metric", "Quantity"],
      [
        ['Total GI Rods (164")', safeNum(data.totalRods)],
        ["Total Material (inches)", safeStr(data.totalInches)],
      ],
      undefined,
      colorsRods
    );

    // ROD CUTTING PLAN (limit to 4)
    const cuttingRows =
      (data.cuttingPatterns || []).length > 0
        ? data.cuttingPatterns.slice(0, 4).map((p: any) => [
            `x${safeNum(p.count)}`,
            `${safeStr(p.exampleWaste)}"`,
            safeStr(p.pattern),
          ])
        : [["No data", "-", "-"]];

    drawStyledTable(
      "ROD CUTTING PLAN",
      ["Count", "Waste", "Pattern"],
      cuttingRows,
      [0.12, 0.13, 0.75],
      colorsCutting
    );

    // HARDWARE REQUIRED (kept as in your code)
    drawStyledTable(
      "HARDWARE REQUIRED",
      ["Item", "Quantity"],
      [
        ["Base Plates", safeNum(data.hardware?.basePlates)],
        ["Anchor Bolts", safeNum(data.hardware?.anchorBolts)],
        ["Angle Attachers", safeNum(data.hardware?.angleAttachers)],
        ["Nuts/Bolts", safeNum(data.hardware?.nuts)],
        ["U-Clamps", safeNum(data.hardware?.uClamps)],
      ],
      undefined,
      colorsHardware
    );

    // -------- PAGE 2 --------
    doc.addPage();
    addHeader();
    addProjectInfo();

    // COST SUMMARY
    drawStyledTable(
      "COST SUMMARY",
      ["Item", "Amount (Rs)"],
      [
        ["Subtotal", money(safeNum(data.cost?.subtotal))],
        ["Wastage", money(safeNum(data.cost?.wastage))],
        ["Fabrication", money(safeNum(data.cost?.price?.service))],
        ["Installation", money(safeNum(data.cost?.price?.installation))],
        ["GRAND TOTAL", money(safeNum(data.cost?.total))],
      ],
      undefined,
      colorsCostSummary
    );

    // DETAILED BREAKDOWN
    drawStyledTable(
      "DETAILED BREAKDOWN",
      ["Item", "Qty", "Rs"],
      [
        [
          "GI Rods",
          `${safeNum(data.cost?.qty?.inchesUsed).toFixed(0)}"`,
          money(safeNum(data.cost?.items?.rodsByInches)),
        ],
        ["Base Plates", safeNum(data.cost?.qty?.basePlates), money(safeNum(data.cost?.items?.basePlates))],
        ["Anchor Bolts", safeNum(data.cost?.qty?.anchorBolts), money(safeNum(data.cost?.items?.anchorBolts))],
        ["Angle Brackets", safeNum(data.cost?.qty?.angleFitters), money(safeNum(data.cost?.items?.angleFitters))],
        ["Nuts/Bolts", safeNum(data.cost?.qty?.normalBolts), money(safeNum(data.cost?.items?.normalBolts))],
        ["U-Clamps", safeNum(data.cost?.qty?.uClamps), money(safeNum(data.cost?.items?.uClamps))],
      ],
      [0.35, 0.2, 0.45],
      colorsBreakdown
    );

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "italic");
    doc.text(
      "Generated by Solar Structure Calculator | For fabrication reference only",
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );

    const filename = `Structure-Slip-${safeStr(data.projectName).replace(/[^a-zA-Z0-9]/g, "-")}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-6 mt-6">
      <button
        type="button"
        onClick={downloadPdf}
        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-4 py-3 rounded-lg shadow-md transition font-semibold"
        disabled={!data}
      >
        Download Structure Slip PDF
      </button>
    </div>
  );
}
