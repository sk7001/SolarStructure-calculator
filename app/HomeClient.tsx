"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { listPanels, seedDefaultPanelsIfEmpty, type PanelRow } from "./lib/panelsDb";
import { createProject, getProjectById } from "./lib/projectsDb";

import { computeCost, type CostData } from "./lib/costing";
import EstimationPdfJsPdf from "./components/EstimationPdfJsPdf";

const ROD_LENGTH = 164;
const GAP = 5;
const TILT_ANGLE = 19;

// Hardware per structure
const HARDWARE_PER_STRUCTURE = {
  basePlates: 4,
  anchorBolts: 16,
  angleAttachers: 4,
  nuts: 24, // normal bolts

  // NEW (this is NOT "per structure", but kept here as your default config)
  uClampsPerPanel: 4,
};

// 1/6th outside => structure supports 5/6th (support size only; panels still occupy full size)
const SUPPORT_FRACTION = 5 / 6;

// FIXED: For south-facing tilt, rows are along East-West.
// Row azimuth: 90° means the row direction is E–W line.
const FIXED_ROW_AZIMUTH_DEG = 90;

/** ===== Calculations ===== */
const calculatePanelsPerRod = (panelLen: number, rodLength: number = ROD_LENGTH, gap: number = GAP) => {
  let maxPanels = 0;
  while (maxPanels * panelLen + (maxPanels - 1) * gap <= rodLength) {
    maxPanels++;
  }
  return maxPanels - 1;
};

/**
 * Structure footprint length along the rod direction (inches)
 */
const structureFootprintLen = (panelsInStructure: number, panelLen: number, gap: number) => {
  if (panelsInStructure <= 0) return 0;
  return panelsInStructure * panelLen + (panelsInStructure - 1) * gap;
};

/**
 * Balanced distribution:
 * prefers more "square-ish" structures (length ~ width) rather than one long structure,
 * while respecting maxPanelsPerRod.
 */
const distributePanelsBalanced = (
  totalPanels: number,
  maxPanelsPerRod: number,
  panelLen: number,
  panelWid: number,
  gap: number = GAP
) => {
  const N = Math.max(0, Math.floor(totalPanels));
  const maxK = Math.max(1, Math.floor(maxPanelsPerRod));

  const STRUCTURE_PENALTY = 0.35;

  const aspectPenalty = (k: number) => {
    const L = structureFootprintLen(k, panelLen, gap);
    const W = Math.max(1e-6, panelWid);
    const ratio = L / W;
    return Math.abs(Math.log(ratio));
  };

  const dp = Array(N + 1).fill(Infinity);
  const pick = Array(N + 1).fill(0);
  dp[0] = 0;

  for (let n = 1; n <= N; n++) {
    const lim = Math.min(maxK, n);
    for (let k = 1; k <= lim; k++) {
      const score = dp[n - k] + aspectPenalty(k) + STRUCTURE_PENALTY;
      if (score < dp[n]) {
        dp[n] = score;
        pick[n] = k;
      }
    }
  }

  const sizes: number[] = [];
  let n = N;
  while (n > 0) {
    const k = pick[n] || 1;
    sizes.push(k);
    n -= k;
  }

  sizes.sort((a, b) => b - a);
  const out: { panels: number; count: number }[] = [];
  for (const k of sizes) {
    const last = out[out.length - 1];
    if (last && last.panels === k) last.count += 1;
    else out.push({ panels: k, count: 1 });
  }
  return out;
};

// roof-optimized distribution (capped panels per structure)
const distributePanelsCapped = (totalPanels: number, cap: number) => {
  const N = Math.max(0, Math.floor(totalPanels));
  const K = Math.max(1, Math.floor(cap));

  const out: { panels: number; count: number }[] = [];
  let left = N;

  while (left > 0) {
    const k = Math.min(K, left);
    const last = out[out.length - 1];
    if (last && last.panels === k) last.count += 1;
    else out.push({ panels: k, count: 1 });
    left -= k;
  }

  out.sort((a, b) => b.panels - a.panels);
  return out;
};

const calculateLegsPerStructure = (
  frontLegHeight: number,
  panelsPerStructure: number,
  panelLen: number,
  tiltAngle: number = TILT_ANGLE,
  gap: number = GAP
) => {
  const totalHypotenuse = (panelLen + gap) * panelsPerStructure;
  const triangleHeight = ((totalHypotenuse * 2) / 3) * Math.sin((tiltAngle * Math.PI) / 180);
  const rearLegHeight = frontLegHeight + triangleHeight;

  return {
    totalFrontLegs: 2,
    totalRearLegs: 2,
    frontLegHeight,
    rearLegHeight: rearLegHeight.toFixed(2),
    panelsPerStructure,
    hypotenuseRodLength: totalHypotenuse.toFixed(2),
  };
};

const calculateRodsForProject = (
  structures: any[],
  frontLegHeight: number,
  panelLen: number,
  rodLength: number = ROD_LENGTH
) => {
  let totalInches = 0;
  let totalFrontLegs = 0;
  let totalRearLegs = 0;
  let totalHypoRods = 0;

  const breakdown = structures.map((s) => {
    const legs = calculateLegsPerStructure(frontLegHeight, s.panels, panelLen);
    const rear = parseFloat(legs.rearLegHeight);
    const hypo = parseFloat(legs.hypotenuseRodLength);

    const frontLegsCount = legs.totalFrontLegs * s.count;
    const rearLegsCount = legs.totalRearLegs * s.count;
    const hypoRodsCount = 2 * s.count;

    const inchesFront = frontLegsCount * frontLegHeight;
    const inchesRear = rearLegsCount * rear;
    const inchesHypo = hypoRodsCount * hypo;

    const inchesThisType = inchesFront + inchesRear + inchesHypo;

    totalFrontLegs += frontLegsCount;
    totalRearLegs += rearLegsCount;
    totalHypoRods += hypoRodsCount;
    totalInches += inchesThisType;

    return {
      panels: s.panels,
      count: s.count,
      legs,
      frontLegsCount,
      rearLegsCount,
      hypoRodsCount,
      inchesThisType: inchesThisType.toFixed(0),
    };
  });

  const totalRodsNeeded = Math.ceil(totalInches / rodLength);

  return {
    breakdown,
    totals: {
      totalFrontLegs,
      totalRearLegs,
      totalHypoRods,
      totalInchesRequired: totalInches.toFixed(0),
      totalRodsNeeded,
    },
    isUniform: breakdown.length === 1,
  };
};

/** ===== Roof fitment ===== */
const panelFootprintLen = (panelsInStructure: number, panelLen: number, gap: number) => {
  return structureFootprintLen(panelsInStructure, panelLen, gap);
};
const panelFootprintWid = (panelWid: number) => panelWid;

// structure support footprint (5/6th support)
const structureSupportFootprintLen = (panelsInStructure: number, panelLen: number, gap: number) => {
  const supported = panelLen * SUPPORT_FRACTION;
  if (panelsInStructure <= 0) return 0;
  return panelsInStructure * supported + (panelsInStructure - 1) * gap;
};
const structureSupportFootprintWid = (panelWid: number) => panelWid * SUPPORT_FRACTION;

type RoofRowItem = { panels: number; lenAlong: number; supportLenAlong: number };
type RoofRow = { usedAlong: number; usedSupportAlong: number; items: RoofRowItem[] };

const normDeg = (deg: number) => {
  const x = deg % 360;
  return x < 0 ? x + 360 : x;
};

const deg2rad = (d: number) => (d * Math.PI) / 180;

const projectedRoofSpans = (roofL: number, roofW: number, roofLenAzimuthDeg: number, rowAzimuthDeg: number) => {
  const d = deg2rad(normDeg(rowAzimuthDeg) - normDeg(roofLenAzimuthDeg));
  const along = Math.abs(roofL * Math.cos(d)) + Math.abs(roofW * Math.sin(d));
  const across = Math.abs(roofL * Math.sin(d)) + Math.abs(roofW * Math.cos(d));
  return { along, across };
};

const maxPanelsThatFitInAlong = (roofAlong: number, panelLen: number, gap: number) => {
  const denom = panelLen + gap;
  if (denom <= 0) return 0;
  return Math.max(0, Math.floor((roofAlong + gap) / denom));
};

const suggestRoofFit = ({
  structures,
  panelLen,
  panelWid,
  roofLength,
  roofWidth,
  roofLenAzimuthDeg,
  gap,
}: {
  structures: { panels: number; count: number }[];
  panelLen: number;
  panelWid: number;
  roofLength: number;
  roofWidth: number;
  roofLenAzimuthDeg: number;
  gap: number;
}) => {
  if (!roofLength || !roofWidth || roofLength <= 0 || roofWidth <= 0) return null;
  if (!Number.isFinite(roofLenAzimuthDeg)) return null;
  if (!structures?.length) return null;

  const rowAzimuthDeg = FIXED_ROW_AZIMUTH_DEG;
  const { along: roofAlong, across: roofAcross } = projectedRoofSpans(roofLength, roofWidth, roofLenAzimuthDeg, rowAzimuthDeg);

  const items: {
    panels: number;
    lenAlong: number;
    widAcross: number;
    supportLenAlong: number;
    supportWidAcross: number;
  }[] = [];

  for (const s of structures) {
    const lenAlong = panelFootprintLen(s.panels, panelLen, gap);
    const widAcross = panelFootprintWid(panelWid);

    const supportLenAlong = structureSupportFootprintLen(s.panels, panelLen, gap);
    const supportWidAcross = structureSupportFootprintWid(panelWid);

    for (let i = 0; i < s.count; i++) {
      items.push({ panels: s.panels, lenAlong, widAcross, supportLenAlong, supportWidAcross });
    }
  }

  items.sort((a, b) => b.lenAlong - a.lenAlong);

  const rows: RoofRow[] = [];
  const rowWidthsAcross: number[] = [];
  const rowSupportWidthsAcross: number[] = [];

  for (const it of items) {
    let placed = false;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const needAlong = (row.items.length > 0 ? gap : 0) + it.lenAlong;

      if (row.usedAlong + needAlong <= roofAlong + 1e-9) {
        row.items.push({ panels: it.panels, lenAlong: it.lenAlong, supportLenAlong: it.supportLenAlong });
        row.usedAlong += needAlong;

        const needSupportAlong = (row.items.length > 1 ? gap : 0) + it.supportLenAlong;
        row.usedSupportAlong += needSupportAlong;

        rowWidthsAcross[r] = Math.max(rowWidthsAcross[r] ?? 0, it.widAcross);
        rowSupportWidthsAcross[r] = Math.max(rowSupportWidthsAcross[r] ?? 0, it.supportWidAcross);

        placed = true;
        break;
      }
    }

    if (!placed) {
      rows.push({
        usedAlong: it.lenAlong,
        usedSupportAlong: it.supportLenAlong,
        items: [{ panels: it.panels, lenAlong: it.lenAlong, supportLenAlong: it.supportLenAlong }],
      });
      rowWidthsAcross.push(it.widAcross);
      rowSupportWidthsAcross.push(it.supportWidAcross);
    }
  }

  const usedAlong = rows.reduce((m, r) => Math.max(m, r.usedAlong), 0);
  const usedSupportAlong = rows.reduce((m, r) => Math.max(m, r.usedSupportAlong), 0);

  const usedAcross =
    rowWidthsAcross.reduce((sum, w) => sum + w, 0) + (rows.length > 1 ? (rows.length - 1) * gap : 0);

  const usedSupportAcross =
    rowSupportWidthsAcross.reduce((sum, w) => sum + w, 0) + (rows.length > 1 ? (rows.length - 1) * gap : 0);

  return {
    roofAlong: Number(roofAlong.toFixed(1)),
    roofAcross: Number(roofAcross.toFixed(1)),
    fitsPanels: usedAlong <= roofAlong + 1e-9 && usedAcross <= roofAcross + 1e-9,
    usedAlong: Number(usedAlong.toFixed(1)),
    usedAcross: Number(usedAcross.toFixed(1)),
    usedSupportAlong: Number(usedSupportAlong.toFixed(1)),
    usedSupportAcross: Number(usedSupportAcross.toFixed(1)),
    rowsCount: rows.length,
    rows,
    roofLenAzimuthDeg: normDeg(roofLenAzimuthDeg),
    rowAzimuthDeg: FIXED_ROW_AZIMUTH_DEG,
  };
};

/** ===== UI helpers ===== */
const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** ===== Cutting plan ===== */
type CutPiece = { type: string; len: number };
type RodPlan = { cuts: CutPiece[]; used: number; waste: number };

const buildCutPlanFFD = (pieces: CutPiece[], rodLen: number, kerf: number): RodPlan[] => {
  const sorted = [...pieces].sort((a, b) => b.len - a.len);
  const rods: { cuts: CutPiece[]; used: number }[] = [];

  for (const piece of sorted) {
    let placed = false;

    for (const rod of rods) {
      const extraKerf = rod.cuts.length > 0 ? kerf : 0;
      const needed = piece.len + extraKerf;

      if (rod.used + needed <= rodLen + 1e-9) {
        rod.cuts.push(piece);
        rod.used += needed;
        placed = true;
        break;
      }
    }

    if (!placed) rods.push({ cuts: [piece], used: piece.len });
  }

  return rods.map((r) => ({ ...r, waste: Number((rodLen - r.used).toFixed(2)) }));
};

const summarizePatterns = (rods: RodPlan[]) => {
  const map = new Map<string, { count: number; exampleWaste: number }>();

  for (const rod of rods) {
    const sig = rod.cuts
      .slice()
      .sort((a, b) => b.len - a.len)
      .map((c) => `${c.type}:${c.len.toFixed(2)}`)
      .join(" | ");

    const prev = map.get(sig);
    if (!prev) map.set(sig, { count: 1, exampleWaste: rod.waste });
    else map.set(sig, { count: prev.count + 1, exampleWaste: prev.exampleWaste });
  }

  return [...map.entries()]
    .map(([pattern, meta]) => ({ pattern, ...meta }))
    .sort((a, b) => b.count - a.count);
};

const RodCuttingSuggestions = ({ results }: { results: any }) => {
  const kerfNum = 0.125;

  const cutData = useMemo(() => {
    if (!results?.rods?.breakdown?.length) return null;

    const pieces: CutPiece[] = [];
    for (const b of results.rods.breakdown) {
      const frontLen = Number(b.legs.frontLegHeight);
      const rearLen = Number(b.legs.rearLegHeight);
      const hypoLen = Number(b.legs.hypotenuseRodLength);

      for (let i = 0; i < b.frontLegsCount; i++) pieces.push({ type: "Front", len: frontLen });
      for (let i = 0; i < b.rearLegsCount; i++) pieces.push({ type: "Rear", len: rearLen });
      for (let i = 0; i < b.hypoRodsCount; i++) pieces.push({ type: "Hypo", len: hypoLen });
    }

    const rodsPlan = buildCutPlanFFD(pieces, ROD_LENGTH, kerfNum);
    const totalWaste = rodsPlan.reduce((s, r) => s + r.waste, 0);
    const patterns = summarizePatterns(rodsPlan);

    return {
      piecesCount: pieces.length,
      rodsCount: rodsPlan.length,
      totalWaste: Number(totalWaste.toFixed(2)),
      patterns,
    };
  }, [results]);

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Rod cutting plan</h2>

      {!cutData ? (
        <div className="text-gray-400 text-sm">Calculate first to see suggestions.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Pieces</div>
              <div className="text-gray-100 font-semibold text-2xl">{cutData.piecesCount}</div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Rods (plan)</div>
              <div className="text-gray-100 font-semibold text-2xl">{cutData.rodsCount}</div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Estimated waste</div>
              <div className="text-gray-100 font-semibold text-2xl">{cutData.totalWaste}"</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {cutData.patterns.slice(0, 6).map((p, idx) => (
              <div key={idx} className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-gray-100 font-semibold">× {p.count}</div>
                  <div className="text-gray-300 text-sm">Waste: {p.exampleWaste}"</div>
                </div>
                <div className="text-gray-300 text-sm mt-2 break-words">{p.pattern}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** ===== Hardware totals (UPDATED to include U-Clamps) ===== */
const HardwareTotals = ({
  results,
  basePlatePrice,
  anchorBoltPrice,
  angleFitterPrice,
  normalBoltPrice,
  uClampPrice,
  uClampsPerPanel,
}: {
  results: any;
  basePlatePrice: string;
  anchorBoltPrice: string;
  angleFitterPrice: string;
  normalBoltPrice: string;
  uClampPrice: string;
  uClampsPerPanel: string;
}) => {
  const totalStructures = useMemo(() => {
    if (!results?.structures?.length) return 0;
    return results.structures.reduce((sum: number, s: any) => sum + (Number(s.count) || 0), 0);
  }, [results]);

  const totalPanels = useMemo(() => {
    if (!results?.structures?.length) return 0;
    return results.structures.reduce(
      (sum: number, s: any) => sum + (Number(s.panels) || 0) * (Number(s.count) || 0),
      0
    );
  }, [results]);

  const toNum = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const totals = useMemo(() => {
    const perPanel =
      uClampsPerPanel === "" ? HARDWARE_PER_STRUCTURE.uClampsPerPanel : Math.max(0, Math.floor(toNum(uClampsPerPanel, 0)));

    const qty = {
      structures: totalStructures,
      basePlates: totalStructures * HARDWARE_PER_STRUCTURE.basePlates,
      anchorBolts: totalStructures * HARDWARE_PER_STRUCTURE.anchorBolts,
      angleAttachers: totalStructures * HARDWARE_PER_STRUCTURE.angleAttachers,
      nuts: totalStructures * HARDWARE_PER_STRUCTURE.nuts,

      // NEW: based on panels
      uClamps: totalPanels * perPanel,
    };

    const price = {
      basePlate: toNum(basePlatePrice, 150),
      anchorBolt: toNum(anchorBoltPrice, 20),
      angleFitter: toNum(angleFitterPrice, 150),
      normalBolt: toNum(normalBoltPrice, 15),
      uClamp: toNum(uClampPrice, 0),
    };

    const cost = {
      basePlates: qty.basePlates * price.basePlate,
      anchorBolts: qty.anchorBolts * price.anchorBolt,
      angleAttachers: qty.angleAttachers * price.angleFitter,
      nuts: qty.nuts * price.normalBolt,
      uClamps: qty.uClamps * price.uClamp,
    };

    return { qty, cost };
  }, [
    totalStructures,
    totalPanels,
    basePlatePrice,
    anchorBoltPrice,
    angleFitterPrice,
    normalBoltPrice,
    uClampPrice,
    uClampsPerPanel,
  ]);

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Hardware totals</h2>

      {totalStructures === 0 ? (
        <div className="text-gray-400 text-sm">Calculate first to see hardware totals.</div>
      ) : (
        <>
          <div className="text-gray-300 text-sm mb-4">
            Total structures: <span className="text-gray-100 font-semibold">{totals.qty.structures}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Base plates</div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-gray-100 font-semibold text-2xl">{totals.qty.basePlates}</div>
                <div className="text-emerald-300 font-semibold text-sm">₹ {money(totals.cost.basePlates)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Anchor bolts</div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-gray-100 font-semibold text-2xl">{totals.qty.anchorBolts}</div>
                <div className="text-emerald-300 font-semibold text-sm">₹ {money(totals.cost.anchorBolts)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Angle finder</div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-gray-100 font-semibold text-2xl">{totals.qty.angleAttachers}</div>
                <div className="text-emerald-300 font-semibold text-sm">₹ {money(totals.cost.angleAttachers)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Normal bolts</div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-gray-100 font-semibold text-2xl">{totals.qty.nuts}</div>
                <div className="text-emerald-300 font-semibold text-sm">₹ {money(totals.cost.nuts)}</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">U-Clamps</div>
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-gray-100 font-semibold text-2xl">{totals.qty.uClamps}</div>
                <div className="text-emerald-300 font-semibold text-sm">₹ {money(totals.cost.uClamps)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** ===== Results ===== */
const ResultsTable = ({ results }: { results: any }) => {
  if (!results) return null;

  const { maxPanelsPerRod, structures, rods } = results;

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Results</h2>

      <div
        className={`p-4 rounded-xl mb-6 border ${
          rods.isUniform ? "bg-green-900/20 border-green-800" : "bg-yellow-900/20 border-yellow-800"
        }`}
      >
        <div className="font-semibold mb-1">{rods.isUniform ? "Uniform structures" : "Mixed structures"}</div>
        <div className="text-gray-200">
          {structures
            .map((s: any, i: number) => `${s.count} × ${s.panels}-panel${i < structures.length - 1 ? " + " : ""}`)
            .join("")}
        </div>
      </div>

      <table className="w-full text-gray-100 mb-2">
        <thead>
          <tr>
            <th className="border-b border-gray-800 p-2 text-left">Metric</th>
            <th className="border-b border-gray-800 p-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-gray-800 p-2">Max Panels per Rod</td>
            <td className="border-b border-gray-800 p-2">{maxPanelsPerRod}</td>
          </tr>

          <tr>
            <td className="border-b border-gray-800 p-2">Structure Distribution</td>
            <td className="border-b border-gray-800 p-2">{structures.map((s: any) => `${s.count}x${s.panels}`).join(" + ")}</td>
          </tr>

          {rods.breakdown.map((b: any, idx: number) => (
            <React.Fragment key={`${b.panels}-${idx}`}>
              <tr className="bg-gray-950/40">
                <td className="border-b border-gray-800 p-2 font-semibold" colSpan={2}>
                  {b.count} × {b.panels}-panel structure
                </td>
              </tr>

              <tr>
                <td className="border-b border-gray-800 p-2">Front legs</td>
                <td className="border-b border-gray-800 p-2">
                  {b.frontLegsCount} × {b.legs.frontLegHeight}"
                </td>
              </tr>

              <tr>
                <td className="border-b border-gray-800 p-2">Rear legs</td>
                <td className="border-b border-gray-800 p-2">
                  {b.rearLegsCount} × {b.legs.rearLegHeight}"
                </td>
              </tr>

              <tr className="bg-blue-900/20">
                <td className="border-b border-gray-800 p-2 font-semibold">Hypotenuse rods (GI)</td>
                <td className="border-b border-gray-800 p-2 font-semibold">
                  {b.hypoRodsCount} × {b.legs.hypotenuseRodLength}"
                </td>
              </tr>
            </React.Fragment>
          ))}

          <tr className="bg-green-900/30">
            <td className="border-b border-gray-800 p-2 font-bold text-lg">TOTAL GI Rods (164")</td>
            <td className="border-b border-gray-800 p-2 font-bold text-lg text-green-300">{rods.totals.totalRodsNeeded}</td>
          </tr>

          <tr>
            <td className="border-b border-gray-800 p-2">Total Material Length</td>
            <td className="border-b border-gray-800 p-2">{rods.totals.totalInchesRequired} inches</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/** ===== Roof suggestion UI ===== */
const RoofFitCard = ({
  currentFit,
  optimized,
  roofLength,
  roofWidth,
  roofLenAzimuthDeg,
}: {
  currentFit: ReturnType<typeof suggestRoofFit> | null;
  optimized: {
    maxPerStructure: number;
    maxByRoof: number;
    structures: { panels: number; count: number }[];
    fit: ReturnType<typeof suggestRoofFit> | null;
  } | null;
  roofLength: string;
  roofWidth: string;
  roofLenAzimuthDeg: string;
}) => {
  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Roof fit suggestion</h2>

      {!roofLength || !roofWidth || roofLenAzimuthDeg === "" ? (
        <div className="text-gray-400 text-sm">Enter roof length, roof width, and roof long-edge degrees (azimuth).</div>
      ) : !currentFit ? (
        <div className="text-gray-400 text-sm">Calculate first to see roof fitment.</div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 mb-4">
            <div className="text-gray-200 text-sm space-y-1">
              <div>
                Roof input (L×W): {Number(roofLength)}" × {Number(roofWidth)}"
              </div>
              <div>Roof long-edge azimuth: {normDeg(Number(roofLenAzimuthDeg))}°</div>
              <div>Row direction: fixed {FIXED_ROW_AZIMUTH_DEG}° (East–West rows)</div>
              <div>
                Roof projected (Along × Across): {currentFit.roofAlong}" × {currentFit.roofAcross}"
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border mb-4 ${
              currentFit.fitsPanels ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"
            }`}
          >
            <div className="text-gray-100 font-semibold mb-2">
              Current structure layout: {currentFit.fitsPanels ? "Fits" : "Does NOT fit"}
            </div>

            <div className="text-gray-200 text-sm space-y-1">
              <div>
                Needed by panels (Along × Across): {currentFit.usedAlong}" × {currentFit.usedAcross}"
              </div>
              <div>
                Needed by support (Along × Across): {currentFit.usedSupportAlong}" × {currentFit.usedSupportAcross}"
              </div>
              <div>Rows needed (stacked Across): {currentFit.rowsCount}</div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              optimized?.fit?.fitsPanels ? "bg-green-900/20 border-green-800" : "bg-red-900/20 border-red-800"
            }`}
          >
            <div className="text-gray-100 font-semibold mb-2">Roof-optimized suggestion</div>

            {!optimized ? (
              <div className="text-gray-400 text-sm">Enter panel count and calculate.</div>
            ) : (
              <div className="text-gray-200 text-sm space-y-1">
                <div>
                  Max panels per structure (roof limit): {optimized.maxByRoof} | Final cap (roof+rod): {optimized.maxPerStructure}
                </div>
                <div>Suggested structures: {optimized.structures.map((s) => `${s.count}x${s.panels}`).join(" + ")}</div>

                {!optimized.fit ? (
                  <div>Fit details: (not available)</div>
                ) : (
                  <>
                    <div>
                      Fit result: {optimized.fit.fitsPanels ? "Fits" : "Does NOT fit"} | Rows: {optimized.fit.rowsCount}
                    </div>
                    <div>
                      Needed by panels (Along × Across): {optimized.fit.usedAlong}" × {optimized.fit.usedAcross}"
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/** ===== U-Clamp helpers ===== */
const toNumSafe = (v: string, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const totalPanelsFromResults = (results: any) => {
  if (!results?.structures?.length) return 0;
  return results.structures.reduce(
    (sum: number, s: any) => sum + (Number(s.panels) || 0) * (Number(s.count) || 0),
    0
  );
};

const extendCostWithUClamps = (
  base: CostData | null,
  results: any,
  uClampPriceStr: string,
  uClampsPerPanelStr: string
): CostData | null => {
  if (!base) return null;

  const panels = totalPanelsFromResults(results);

  const perPanel =
    uClampsPerPanelStr === ""
      ? HARDWARE_PER_STRUCTURE.uClampsPerPanel
      : Math.max(0, Math.floor(toNumSafe(uClampsPerPanelStr, 0)));

  const qtyUClamps = panels * perPanel;

  const unitPrice = toNumSafe(uClampPriceStr, 0);
  const uClampsCost = qtyUClamps * unitPrice;

  const baseSubtotal = (base as any).subtotal ?? 0;
  const newSubtotal = baseSubtotal + uClampsCost;

  const wastagePct = (base as any).price?.wastagePct ?? 0;
  const newWastage = (newSubtotal * wastagePct) / 100;

  const service = (base as any).price?.service ?? (base as any).price?.fabrication ?? 0;
  const installation = (base as any).price?.installation ?? 0;

  const newTotal = newSubtotal + newWastage + service + installation;

  return {
    ...(base as any),
    subtotal: newSubtotal,
    wastage: newWastage,
    wastaged: newWastage,
    total: newTotal,
    qty: { ...(base as any).qty, uClamps: qtyUClamps },
    price: { ...(base as any).price, uClamp: unitPrice },
    items: { ...(base as any).items, uClamps: uClampsCost },
  } as any;
};

/** ===== Form ===== */
const InputForm = ({
  panelModels,
  onCalculate,
  frontLegHeight,
  setFrontLegHeight,
  numberOfPanels,
  setNumberOfPanels,
  selectedPanelModel,
  setSelectedPanelModel,
  isVertical,
  setIsVertical,

  roofLength,
  setRoofLength,
  roofWidth,
  setRoofWidth,
  roofLenAzimuthDeg,
  setRoofLenAzimuthDeg,

  rodPrice,
  setRodPrice,
  basePlatePrice,
  setBasePlatePrice,
  anchorBoltPrice,
  setAnchorBoltPrice,
  angleFitterPrice,
  setAngleFitterPrice,
  normalBoltPrice,
  setNormalBoltPrice,

  uClampPrice,
  setUClampPrice,
  uClampsPerPanel,
  setUClampsPerPanel,

  fabricationCharges,
  setFabricationCharges,
  installationCharges,
  setInstallationCharges,
  wastagePercent,
  setWastagePercent,
}: {
  panelModels: PanelRow[];
  onCalculate: (res: any) => void;

  frontLegHeight: string;
  setFrontLegHeight: (v: string) => void;

  numberOfPanels: string;
  setNumberOfPanels: (v: string) => void;

  selectedPanelModel: string;
  setSelectedPanelModel: (v: string) => void;

  isVertical: boolean;
  setIsVertical: (v: boolean) => void;

  roofLength: string;
  setRoofLength: (v: string) => void;

  roofWidth: string;
  setRoofWidth: (v: string) => void;

  roofLenAzimuthDeg: string;
  setRoofLenAzimuthDeg: (v: string) => void;

  rodPrice: string;
  setRodPrice: (v: string) => void;

  basePlatePrice: string;
  setBasePlatePrice: (v: string) => void;

  anchorBoltPrice: string;
  setAnchorBoltPrice: (v: string) => void;

  angleFitterPrice: string;
  setAngleFitterPrice: (v: string) => void;

  normalBoltPrice: string;
  setNormalBoltPrice: (v: string) => void;

  uClampPrice: string;
  setUClampPrice: (v: string) => void;

  uClampsPerPanel: string;
  setUClampsPerPanel: (v: string) => void;

  fabricationCharges: string;
  setFabricationCharges: (v: string) => void;

  installationCharges: string;
  setInstallationCharges: (v: string) => void;

  wastagePercent: string;
  setWastagePercent: (v: string) => void;
}) => {
  useEffect(() => {
    if (panelModels.length && !panelModels.find((p) => p.name === selectedPanelModel)) {
      setSelectedPanelModel(panelModels[0].name);
    }
  }, [panelModels, selectedPanelModel, setSelectedPanelModel]);

  const handleCalculate = () => {
    if (!frontLegHeight || !numberOfPanels || !selectedPanelModel) {
      alert("Please fill in all fields.");
      return;
    }

    const selectedModel = panelModels.find((m) => m.name === selectedPanelModel);
    if (!selectedModel) {
      alert("Selected panel model not found.");
      return;
    }

    const longSide = Math.max(Number(selectedModel.width), Number(selectedModel.height));
    const shortSide = Math.min(Number(selectedModel.width), Number(selectedModel.height));

    const panelLen = isVertical ? longSide : shortSide; // along the rod
    const panelWid = isVertical ? shortSide : longSide; // across the structure

    const maxPanelsPerRod = calculatePanelsPerRod(panelLen);
    if (maxPanelsPerRod <= 0) {
      alert("Panel length too large to fit on a 164-inch rod with gap.");
      return;
    }

    const totalPanels = parseInt(numberOfPanels, 10);
    const front = parseFloat(frontLegHeight);

    const structures = distributePanelsBalanced(totalPanels, maxPanelsPerRod, panelLen, panelWid, GAP);
    const rods = calculateRodsForProject(structures, front, panelLen);

    onCalculate({ maxPanelsPerRod, structures, rods });
  };

  return (
    <div className={`${cardClass} p-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Input Form</h2>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Front Leg Height (in inches)</label>
        <input type="number" value={frontLegHeight} onChange={(e) => setFrontLegHeight(e.target.value)} className={fieldClass} />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Number of Panels</label>
        <input type="number" value={numberOfPanels} onChange={(e) => setNumberOfPanels(e.target.value)} className={fieldClass} />
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 mb-6">
        <div className="text-gray-100 font-semibold mb-3">Roof details (optional)</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 mb-2">Roof length (in inches)</label>
            <input type="number" value={roofLength} onChange={(e) => setRoofLength(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Roof width (in inches)</label>
            <input type="number" value={roofWidth} onChange={(e) => setRoofWidth(e.target.value)} className={fieldClass} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 mb-2">Roof long-edge azimuth (degrees)</label>
            <input
              type="number"
              value={roofLenAzimuthDeg}
              onChange={(e) => setRoofLenAzimuthDeg(e.target.value)}
              className={fieldClass}
              placeholder="Example: 45, 315, 90, 0"
            />
          </div>

          <div className="sm:col-span-2 text-gray-400 text-sm">
            Panels should face South and be tilted 19° towards South. Rows assumed East–West.
          </div>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Panel Model</label>
        <select value={selectedPanelModel} onChange={(e) => setSelectedPanelModel(e.target.value)} className={fieldClass}>
          {panelModels.map((m) => {
            const longSide = Math.max(Number(m.width), Number(m.height));
            const shortSide = Math.min(Number(m.width), Number(m.height));
            return (
              <option key={m.id} value={m.name}>
                {m.name} - {longSide}x{shortSide} - {m.description}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-gray-300 mb-2">Orientation</label>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 h-14">
          <input type="checkbox" checked={isVertical} onChange={(e) => setIsVertical(e.target.checked)} />
          <span className="text-gray-300">Vertical</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4 mb-6">
        <div className="text-gray-100 font-semibold mb-3">Prices & charges</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-300 mb-2">Per rod price</label>
            <input type="number" value={rodPrice} onChange={(e) => setRodPrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Base plate price</label>
            <input type="number" value={basePlatePrice} onChange={(e) => setBasePlatePrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Anchor bolt price</label>
            <input type="number" value={anchorBoltPrice} onChange={(e) => setAnchorBoltPrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Angle finder price</label>
            <input type="number" value={angleFitterPrice} onChange={(e) => setAngleFitterPrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Normal bolts price</label>
            <input type="number" value={normalBoltPrice} onChange={(e) => setNormalBoltPrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">U-Clamp price</label>
            <input type="number" value={uClampPrice} onChange={(e) => setUClampPrice(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">U-Clamps per panel</label>
            <input type="number" value={uClampsPerPanel} onChange={(e) => setUClampsPerPanel(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Fabrication charges</label>
            <input type="number" value={fabricationCharges} onChange={(e) => setFabricationCharges(e.target.value)} className={fieldClass} />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Installation charges</label>
            <input type="number" value={installationCharges} onChange={(e) => setInstallationCharges(e.target.value)} className={fieldClass} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 mb-2">Wastage charges (%)</label>
            <input type="number" value={wastagePercent} onChange={(e) => setWastagePercent(e.target.value)} className={fieldClass} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCalculate}
        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition w-full"
      >
        Calculate
      </button>
    </div>
  );
};

/** ===== Cost summary ===== */
const CostSummary = ({ cost }: { cost: CostData | null }) => {
  if (!cost) {
    return (
      <div className={`${cardClass} p-6 mt-6`}>
        <h2 className="text-xl font-semibold mb-2 text-gray-100">Cost summary</h2>
        <div className="text-gray-400 text-sm">Calculate first to see cost.</div>
      </div>
    );
  }

  const qtyUClamps = (cost as any)?.qty?.uClamps ?? 0;
  const priceUClamp = (cost as any)?.price?.uClamp ?? 0;
  const itemUClamps = (cost as any)?.items?.uClamps ?? 0;

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Cost summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Subtotal (materials + hardware)</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money((cost as any).subtotal)}</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Wastage ({Number((cost as any).price?.wastagePct).toFixed(0)}%)</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money((cost as any).wastage)}</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Fabrication charges</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money(((cost as any).price?.service ?? 0) as number)}</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Installation charges</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money(((cost as any).price?.installation ?? 0) as number)}</div>
        </div>

        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-4">
          <div className="text-gray-300 text-xs">Grand total</div>
          <div className="text-emerald-200 font-semibold text-2xl">₹ {money((cost as any).total)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="text-gray-100 font-semibold mb-2">Breakdown</div>

        <div className="text-gray-300 text-sm space-y-1">
          <div>
            Rods (inches): {Number((cost as any).qty?.inchesUsed).toFixed(0)}" × ₹{money((cost as any).price?.rodPerInch)} / inch = ₹
            {money((cost as any).items?.rodsByInches)}
          </div>

          <div>
            Base plates: {(cost as any).qty?.basePlates} × ₹{money((cost as any).price?.basePlate)} = ₹{money((cost as any).items?.basePlates)}
          </div>

          <div>
            Anchor bolts: {(cost as any).qty?.anchorBolts} × ₹{money((cost as any).price?.anchorBolt)} = ₹{money((cost as any).items?.anchorBolts)}
          </div>

          <div>
            Angle finder: {(cost as any).qty?.angleFitters} × ₹{money((cost as any).price?.angleFitter)} = ₹{money((cost as any).items?.angleFitters)}
          </div>

          <div>
            Normal bolts: {(cost as any).qty?.normalBolts} × ₹{money((cost as any).price?.normalBolt)} = ₹{money((cost as any).items?.normalBolts)}
          </div>

          <div>
            U-Clamps: {qtyUClamps} × ₹{money(priceUClamp)} = ₹{money(itemUClamps)}
          </div>
        </div>
      </div>
    </div>
  );
};

/** ===== Home ===== */
export default function HomeClient() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");

  const [panelModels, setPanelModels] = useState<PanelRow[]>([]);
  const [results, setResults] = useState<any>(null);

  // Inputs
  const [frontLegHeight, setFrontLegHeight] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [selectedPanelModel, setSelectedPanelModel] = useState("");
  const [isVertical, setIsVertical] = useState(false);

  // Roof inputs (ONLY size + degrees)
  const [roofLength, setRoofLength] = useState("");
  const [roofWidth, setRoofWidth] = useState("");
  const [roofLenAzimuthDeg, setRoofLenAzimuthDeg] = useState("");

  // Prices (defaults)
  const [rodPrice, setRodPrice] = useState("1000");
  const [basePlatePrice, setBasePlatePrice] = useState("150");
  const [anchorBoltPrice, setAnchorBoltPrice] = useState("20");
  const [angleFitterPrice, setAngleFitterPrice] = useState("150");
  const [normalBoltPrice, setNormalBoltPrice] = useState("15");

  // NEW defaults from constant
  const [uClampPrice, setUClampPrice] = useState("45");
  const [uClampsPerPanel, setUClampsPerPanel] = useState(String(HARDWARE_PER_STRUCTURE.uClampsPerPanel));

  const [fabricationCharges, setFabricationCharges] = useState("1500");
  const [installationCharges, setInstallationCharges] = useState("700");
  const [wastagePercent, setWastagePercent] = useState("15");

  // Save-as-project
  const [projectName, setProjectName] = useState("");

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await seedDefaultPanelsIfEmpty();
        const models = await listPanels();
        setPanelModels(models);
        setSelectedPanelModel((prev) => prev || models[0]?.name || "");
        setIsReady(true);
      } catch (e: any) {
        alert(e?.message || "Failed to load panels from cloud.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        const p: any = await getProjectById(projectId);

        setProjectName(p.name || "");
        setFrontLegHeight(p.inputs?.frontLegHeight || "");
        setNumberOfPanels(p.inputs?.numberOfPanels || "");
        setSelectedPanelModel(p.inputs?.selectedPanelModel || "");
        setIsVertical(Boolean(p.inputs?.isVertical));

        const pricing = p.inputs?.pricing || {};
        setRodPrice(String(pricing.rodPrice ?? "1000"));
        setBasePlatePrice(String(pricing.basePlatePrice ?? "150"));
        setAnchorBoltPrice(String(pricing.anchorBoltPrice ?? "20"));
        setAngleFitterPrice(String(pricing.angleFitterPrice ?? "150"));
        setNormalBoltPrice(String(pricing.normalBoltPrice ?? "15"));

        // restore U-clamps
        setUClampPrice(String(pricing.uClampPrice ?? "45"));
        setUClampsPerPanel(String(pricing.uClampsPerPanel ?? String(HARDWARE_PER_STRUCTURE.uClampsPerPanel)));

        setFabricationCharges(String(pricing.fabricationCharges ?? pricing.serviceCharges ?? "1500"));
        setInstallationCharges(String(pricing.installationCharges ?? "700"));
        setWastagePercent(String(pricing.wastagePercent ?? "15"));

        setResults(p.results || null);
      } catch (e: any) {
        alert(e?.message || "Failed to load project from cloud.");
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (panelModels.length && selectedPanelModel && !panelModels.find((p) => p.name === selectedPanelModel)) {
      setSelectedPanelModel(panelModels[0]?.name || "");
    }
  }, [panelModels, selectedPanelModel]);

  const baseCost: CostData | null = useMemo(() => {
    return computeCost({
      results,
      rodPrice,
      basePlatePrice,
      anchorBoltPrice,
      angleFitterPrice,
      normalBoltPrice,
      serviceCharges: fabricationCharges,
      installationCharges,
      wastagePercent,
    } as any);
  }, [
    results,
    rodPrice,
    basePlatePrice,
    anchorBoltPrice,
    angleFitterPrice,
    normalBoltPrice,
    fabricationCharges,
    installationCharges,
    wastagePercent,
  ]);

  const cost: CostData | null = useMemo(() => {
    return extendCostWithUClamps(baseCost, results, uClampPrice, uClampsPerPanel);
  }, [baseCost, results, uClampPrice, uClampsPerPanel]);

  const currentRoofFit = useMemo(() => {
    if (!results) return null;
    if (!roofLength || !roofWidth || roofLenAzimuthDeg === "") return null;

    const model = panelModels.find((m) => m.name === selectedPanelModel);
    if (!model) return null;

    const longSide = Math.max(Number(model.width), Number(model.height));
    const shortSide = Math.min(Number(model.width), Number(model.height));

    const panelLen = isVertical ? longSide : shortSide;
    const panelWid = isVertical ? shortSide : longSide;

    const roofAz = Number(roofLenAzimuthDeg);
    if (!Number.isFinite(roofAz)) return null;

    return suggestRoofFit({
      structures: results.structures,
      panelLen,
      panelWid,
      roofLength: Number(roofLength),
      roofWidth: Number(roofWidth),
      roofLenAzimuthDeg: roofAz,
      gap: GAP,
    });
  }, [results, roofLength, roofWidth, roofLenAzimuthDeg, panelModels, selectedPanelModel, isVertical]);

  const roofOptimized = useMemo(() => {
    if (!results) return null;
    if (!roofLength || !roofWidth || roofLenAzimuthDeg === "") return null;

    const model = panelModels.find((m) => m.name === selectedPanelModel);
    if (!model) return null;

    const longSide = Math.max(Number(model.width), Number(model.height));
    const shortSide = Math.min(Number(model.width), Number(model.height));

    const panelLen = isVertical ? longSide : shortSide;
    const panelWid = isVertical ? shortSide : longSide;

    const roofAz = Number(roofLenAzimuthDeg);
    if (!Number.isFinite(roofAz)) return null;

    const { along: roofAlong } = projectedRoofSpans(Number(roofLength), Number(roofWidth), roofAz, FIXED_ROW_AZIMUTH_DEG);

    const maxByRoof = maxPanelsThatFitInAlong(roofAlong, panelLen, GAP);
    const maxPerStructure = Math.max(1, Math.min(results.maxPanelsPerRod, maxByRoof));

    const totalPanels = parseInt(numberOfPanels || "0", 10);
    if (!Number.isFinite(totalPanels) || totalPanels <= 0) return null;

    const structures = distributePanelsCapped(totalPanels, maxPerStructure);

    const fit = suggestRoofFit({
      structures,
      panelLen,
      panelWid,
      roofLength: Number(roofLength),
      roofWidth: Number(roofWidth),
      roofLenAzimuthDeg: roofAz,
      gap: GAP,
    });

    return { maxPerStructure, maxByRoof, structures, fit };
  }, [results, roofLength, roofWidth, roofLenAzimuthDeg, panelModels, selectedPanelModel, isVertical, numberOfPanels]);

  const onSaveProject = async () => {
    if (!projectName.trim()) {
      alert("Enter project name.");
      return;
    }
    if (!results) {
      alert("Calculate first.");
      return;
    }

    try {
      await createProject({
        name: projectName.trim(),
        inputs: {
          frontLegHeight,
          numberOfPanels,
          selectedPanelModel,
          isVertical,
          pricing: {
            rodPrice,
            basePlatePrice,
            anchorBoltPrice,
            angleFitterPrice,
            normalBoltPrice,
            uClampPrice,
            uClampsPerPanel,
            serviceCharges: fabricationCharges,
            fabricationCharges,
            installationCharges,
            wastagePercent,
          },
        },
        results,
      });

      alert("Project saved to cloud. Go to Projects to view/edit.");
      setProjectName("");
    } catch (e: any) {
      alert(e?.message || "Failed to save project.");
    }
  };

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen antialiased">
      <div className="p-6 max-w-3xl mx-auto">
        {!isReady ? (
          <div className={`${cardClass} p-6`}>
            <div className="text-gray-400">Loading panel models...</div>
          </div>
        ) : (
          <InputForm
            panelModels={panelModels}
            onCalculate={setResults}
            frontLegHeight={frontLegHeight}
            setFrontLegHeight={setFrontLegHeight}
            numberOfPanels={numberOfPanels}
            setNumberOfPanels={setNumberOfPanels}
            selectedPanelModel={selectedPanelModel}
            setSelectedPanelModel={setSelectedPanelModel}
            isVertical={isVertical}
            setIsVertical={setIsVertical}
            roofLength={roofLength}
            setRoofLength={setRoofLength}
            roofWidth={roofWidth}
            setRoofWidth={setRoofWidth}
            roofLenAzimuthDeg={roofLenAzimuthDeg}
            setRoofLenAzimuthDeg={setRoofLenAzimuthDeg}
            rodPrice={rodPrice}
            setRodPrice={setRodPrice}
            basePlatePrice={basePlatePrice}
            setBasePlatePrice={setBasePlatePrice}
            anchorBoltPrice={anchorBoltPrice}
            setAnchorBoltPrice={setAnchorBoltPrice}
            angleFitterPrice={angleFitterPrice}
            setAngleFitterPrice={setAngleFitterPrice}
            normalBoltPrice={normalBoltPrice}
            setNormalBoltPrice={setNormalBoltPrice}
            uClampPrice={uClampPrice}
            setUClampPrice={setUClampPrice}
            uClampsPerPanel={uClampsPerPanel}
            setUClampsPerPanel={setUClampsPerPanel}
            fabricationCharges={fabricationCharges}
            setFabricationCharges={setFabricationCharges}
            installationCharges={installationCharges}
            setInstallationCharges={setInstallationCharges}
            wastagePercent={wastagePercent}
            setWastagePercent={setWastagePercent}
          />
        )}

        <ResultsTable results={results} />

        <RoofFitCard
          currentFit={currentRoofFit}
          optimized={roofOptimized}
          roofLength={roofLength}
          roofWidth={roofWidth}
          roofLenAzimuthDeg={roofLenAzimuthDeg}
        />

        <RodCuttingSuggestions results={results} />

        {/* UPDATED: includes U-clamps */}
        <HardwareTotals
          results={results}
          basePlatePrice={basePlatePrice}
          anchorBoltPrice={anchorBoltPrice}
          angleFitterPrice={angleFitterPrice}
          normalBoltPrice={normalBoltPrice}
          uClampPrice={uClampPrice}
          uClampsPerPanel={uClampsPerPanel}
        />

        <CostSummary cost={cost} />

        <div className={`${cardClass} p-6 mt-6`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-gray-100">Save as project</h2>
            <Link
              href="/projects"
              className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
            >
              Projects
            </Link>
          </div>

          <div className="mt-4">
            <label className="block text-gray-300 mb-2">Project name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={fieldClass} />
          </div>

          <button
            type="button"
            onClick={onSaveProject}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition"
          >
            Save Project
          </button>
        </div>
      </div>

      <EstimationPdfJsPdf cost={cost} projectName={projectName} />
    </div>
  );
}
