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
};

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
 *
 * Example: total=4, max=4 -> tends to pick 2+2 instead of 4 (if 4 becomes too long vs width).
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

  // Tuning knobs:
  // Lower => more splitting allowed (more structures)
  // Higher => fewer structures (longer structures)
  const STRUCTURE_PENALTY = 0.35;

  // Penalize structures that are too long or too short compared to width.
  // 0 when perfect square-ish, grows as ratio drifts.
  const aspectPenalty = (k: number) => {
    const L = structureFootprintLen(k, panelLen, gap);
    const W = Math.max(1e-6, panelWid);
    const ratio = L / W;
    return Math.abs(Math.log(ratio));
  };

  // dp[n] = best score to split n panels
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

  // Reconstruct solution
  const sizes: number[] = [];
  let n = N;
  while (n > 0) {
    const k = pick[n] || 1;
    sizes.push(k);
    n -= k;
  }

  // Compress into [{panels, count}]
  sizes.sort((a, b) => b - a);
  const out: { panels: number; count: number }[] = [];
  for (const k of sizes) {
    const last = out[out.length - 1];
    if (last && last.panels === k) last.count += 1;
    else out.push({ panels: k, count: 1 });
  }
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
  const triangleHeight = (totalHypotenuse * 2 / 3) * Math.sin((tiltAngle * Math.PI) / 180);
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

/** ===== UI helpers ===== */
const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/** ===== Cutting plan (compact UI) ===== */
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

    if (!placed) {
      rods.push({ cuts: [piece], used: piece.len });
    }
  }

  return rods.map((r) => ({
    ...r,
    waste: Number((rodLen - r.used).toFixed(2)),
  }));
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

/** ===== Hardware totals (qty + cost) ===== */
const HardwareTotals = ({
  results,
  basePlatePrice,
  anchorBoltPrice,
  angleFitterPrice,
  normalBoltPrice,
}: {
  results: any;
  basePlatePrice: string;
  anchorBoltPrice: string;
  angleFitterPrice: string;
  normalBoltPrice: string;
}) => {
  const totalStructures = useMemo(() => {
    if (!results?.structures?.length) return 0;
    return results.structures.reduce((sum: number, s: any) => sum + (Number(s.count) || 0), 0);
  }, [results]);

  const toNum = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const totals = useMemo(() => {
    const qty = {
      structures: totalStructures,
      basePlates: totalStructures * HARDWARE_PER_STRUCTURE.basePlates,
      anchorBolts: totalStructures * HARDWARE_PER_STRUCTURE.anchorBolts,
      angleAttachers: totalStructures * HARDWARE_PER_STRUCTURE.angleAttachers,
      nuts: totalStructures * HARDWARE_PER_STRUCTURE.nuts,
    };

    const price = {
      basePlate: toNum(basePlatePrice, 150),
      anchorBolt: toNum(anchorBoltPrice, 20),
      angleFitter: toNum(angleFitterPrice, 150),
      normalBolt: toNum(normalBoltPrice, 15),
    };

    const cost = {
      basePlates: qty.basePlates * price.basePlate,
      anchorBolts: qty.anchorBolts * price.anchorBolt,
      angleAttachers: qty.angleAttachers * price.angleFitter,
      nuts: qty.nuts * price.normalBolt,
    };

    return { qty, cost };
  }, [totalStructures, basePlatePrice, anchorBoltPrice, angleFitterPrice, normalBoltPrice]);

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            <td className="border-b border-gray-800 p-2">
              {structures.map((s: any) => `${s.count}x${s.panels}`).join(" + ")}
            </td>
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
            <td className="border-b border-gray-800 p-2 font-bold text-lg text-green-300">
              {rods.totals.totalRodsNeeded}
            </td>
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

/** ===== Form (Prices ABOVE Calculate) ===== */
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
  serviceCharges,
  setServiceCharges,
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

  serviceCharges: string;
  setServiceCharges: (v: string) => void;

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

    // along the rod
    const panelLen = isVertical ? longSide : shortSide;
    // across the structure
    const panelWid = isVertical ? shortSide : longSide;

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
        <input
          type="number"
          value={frontLegHeight}
          onChange={(e) => setFrontLegHeight(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Number of Panels</label>
        <input
          type="number"
          value={numberOfPanels}
          onChange={(e) => setNumberOfPanels(e.target.value)}
          className={fieldClass}
        />
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
            <input
              type="number"
              value={basePlatePrice}
              onChange={(e) => setBasePlatePrice(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Anchor bolt price</label>
            <input
              type="number"
              value={anchorBoltPrice}
              onChange={(e) => setAnchorBoltPrice(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Angle fitter price</label>
            <input
              type="number"
              value={angleFitterPrice}
              onChange={(e) => setAngleFitterPrice(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Normal bolts price</label>
            <input
              type="number"
              value={normalBoltPrice}
              onChange={(e) => setNormalBoltPrice(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Service charges</label>
            <input
              type="number"
              value={serviceCharges}
              onChange={(e) => setServiceCharges(e.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-300 mb-2">Wastage charges (%)</label>
            <input
              type="number"
              value={wastagePercent}
              onChange={(e) => setWastagePercent(e.target.value)}
              className={fieldClass}
            />
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

/** ===== Cost summary (uses computed cost) ===== */
const CostSummary = ({ cost }: { cost: CostData | null }) => {
  if (!cost) {
    return (
      <div className={`${cardClass} p-6 mt-6`}>
        <h2 className="text-xl font-semibold mb-2 text-gray-100">Cost summary</h2>
        <div className="text-gray-400 text-sm">Calculate first to see cost.</div>
      </div>
    );
  }

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Cost summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Subtotal (materials + hardware)</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money(cost.subtotal)}</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Wastage ({Number(cost.price.wastagePct).toFixed(0)}%)</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money(cost.wastage)}</div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
          <div className="text-gray-400 text-xs">Service charges</div>
          <div className="text-gray-100 font-semibold text-2xl">₹ {money(cost.price.service)}</div>
        </div>

        <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-4">
          <div className="text-gray-300 text-xs">Grand total</div>
          <div className="text-emerald-200 font-semibold text-2xl">₹ {money(cost.total)}</div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/40 p-4">
        <div className="text-gray-100 font-semibold mb-2">Breakdown</div>
        <div className="text-gray-300 text-sm space-y-1">
          <div>
            Rods (inches): {Number(cost.qty.inchesUsed).toFixed(0)}" × ₹{money(cost.price.rodPerInch)} / inch = ₹
            {money(cost.items.rodsByInches)}
          </div>
          <div>
            Base plates: {cost.qty.basePlates} × ₹{money(cost.price.basePlate)} = ₹{money(cost.items.basePlates)}
          </div>
          <div>
            Anchor bolts: {cost.qty.anchorBolts} × ₹{money(cost.price.anchorBolt)} = ₹{money(cost.items.anchorBolts)}
          </div>
          <div>
            Angle fitters: {cost.qty.angleFitters} × ₹{money(cost.price.angleFitter)} = ₹{money(cost.items.angleFitters)}
          </div>
          <div>
            Normal bolts: {cost.qty.normalBolts} × ₹{money(cost.price.normalBolt)} = ₹{money(cost.items.normalBolts)}
          </div>
        </div>
      </div>
    </div>
  );
};

/** ===== Home (SUPABASE) ===== */
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

  // Prices (defaults)
  const [rodPrice, setRodPrice] = useState("1000");
  const [basePlatePrice, setBasePlatePrice] = useState("150");
  const [anchorBoltPrice, setAnchorBoltPrice] = useState("20");
  const [angleFitterPrice, setAngleFitterPrice] = useState("150");
  const [normalBoltPrice, setNormalBoltPrice] = useState("15");
  const [serviceCharges, setServiceCharges] = useState("1500");
  const [wastagePercent, setWastagePercent] = useState("15");

  // Save-as-project
  const [projectName, setProjectName] = useState("");

  // Hydration fix
  const [isReady, setIsReady] = useState(false);

  // Load panels from cloud
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

  // Load project from cloud: /?projectId=...
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

        // restore pricing (fallback to defaults)
        const pricing = p.inputs?.pricing || {};
        setRodPrice(String(pricing.rodPrice ?? "1000"));
        setBasePlatePrice(String(pricing.basePlatePrice ?? "150"));
        setAnchorBoltPrice(String(pricing.anchorBoltPrice ?? "20"));
        setAngleFitterPrice(String(pricing.angleFitterPrice ?? "150"));
        setNormalBoltPrice(String(pricing.normalBoltPrice ?? "15"));
        setServiceCharges(String(pricing.serviceCharges ?? "1500"));
        setWastagePercent(String(pricing.wastagePercent ?? "15"));

        setResults(p.results || null);
      } catch (e: any) {
        alert(e?.message || "Failed to load project from cloud.");
      }
    })();
  }, [projectId]);

  // If panel model was deleted, fallback
  useEffect(() => {
    if (panelModels.length && selectedPanelModel && !panelModels.find((p) => p.name === selectedPanelModel)) {
      setSelectedPanelModel(panelModels[0]?.name || "");
    }
  }, [panelModels, selectedPanelModel]);

  // Compute cost ONCE (used by both summary + PDF)
  const cost: CostData | null = useMemo(() => {
    return computeCost({
      results,
      rodPrice,
      basePlatePrice,
      anchorBoltPrice,
      angleFitterPrice,
      normalBoltPrice,
      serviceCharges,
      wastagePercent,
    });
  }, [
    results,
    rodPrice,
    basePlatePrice,
    anchorBoltPrice,
    angleFitterPrice,
    normalBoltPrice,
    serviceCharges,
    wastagePercent,
  ]);

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
            serviceCharges,
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
            serviceCharges={serviceCharges}
            setServiceCharges={setServiceCharges}
            wastagePercent={wastagePercent}
            setWastagePercent={setWastagePercent}
          />
        )}

        <ResultsTable results={results} />
        <RodCuttingSuggestions results={results} />

        <HardwareTotals
          results={results}
          basePlatePrice={basePlatePrice}
          anchorBoltPrice={anchorBoltPrice}
          angleFitterPrice={angleFitterPrice}
          normalBoltPrice={normalBoltPrice}
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
