"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadPanels } from "./lib/panelsStorage";

const ROD_LENGTH = 164;
const GAP = 5;
const TILT_ANGLE = 19;

// Hardware per structure (as you requested)
const HARDWARE_PER_STRUCTURE = {
  basePlates: 4,
  anchorBolts: 16,
  angleAttachers: 4,
  nuts: 24,
};

/** ===== Calculations (UNCHANGED) ===== */

const calculatePanelsPerRod = (panelLen, rodLength = ROD_LENGTH, gap = GAP) => {
  let maxPanels = 0;
  while (maxPanels * panelLen + (maxPanels - 1) * gap <= rodLength) {
    maxPanels++;
  }
  return maxPanels - 1;
};

const smartDistributePanels = (totalPanels, maxPanelsPerRod) => {
  const fullStructures = Math.floor(totalPanels / maxPanelsPerRod);
  const remainingPanels = totalPanels % maxPanelsPerRod;

  if (remainingPanels === 0) return [{ panels: maxPanelsPerRod, count: fullStructures }];

  return [
    { panels: maxPanelsPerRod, count: fullStructures },
    { panels: remainingPanels, count: 1 },
  ].filter((s) => s.count > 0);
};

const calculateLegsPerStructure = (
  frontLegHeight,
  panelsPerStructure,
  panelLen,
  tiltAngle = TILT_ANGLE,
  gap = GAP
) => {
  const totalHypotenuse = (panelLen + gap) * panelsPerStructure;
  const triangleHeight = totalHypotenuse * Math.sin((tiltAngle * Math.PI) / 180);
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

const calculateRodsForProject = (structures, frontLegHeight, panelLen, rodLength = ROD_LENGTH) => {
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

/** ===== Cutting plan (compact UI) ===== */

const buildCutPlanFFD = (pieces, rodLen, kerf) => {
  const sorted = [...pieces].sort((a, b) => b.len - a.len);
  const rods = [];

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

const summarizePatterns = (rods) => {
  const map = new Map();

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

const RodCuttingSuggestions = ({ results }) => {
  const kerfNum = 0.125;

  const cutData = useMemo(() => {
    if (!results?.rods?.breakdown?.length) return null;

    const pieces = [];
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

/** ===== Hardware totals ===== */

const HardwareTotals = ({ results }) => {
  const totalStructures = useMemo(() => {
    if (!results?.structures?.length) return 0;
    return results.structures.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
  }, [results]);

  const totals = useMemo(() => {
    return {
      structures: totalStructures,
      basePlates: totalStructures * HARDWARE_PER_STRUCTURE.basePlates,
      anchorBolts: totalStructures * HARDWARE_PER_STRUCTURE.anchorBolts,
      angleAttachers: totalStructures * HARDWARE_PER_STRUCTURE.angleAttachers,
      nuts: totalStructures * HARDWARE_PER_STRUCTURE.nuts,
    };
  }, [totalStructures]);

  return (
    <div className={`${cardClass} p-6 mt-6`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Hardware totals</h2>

      {totalStructures === 0 ? (
        <div className="text-gray-400 text-sm">Calculate first to see hardware totals.</div>
      ) : (
        <>
          <div className="text-gray-300 text-sm mb-4">
            Total structures: <span className="text-gray-100 font-semibold">{totals.structures}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Base plates</div>
              <div className="text-gray-100 font-semibold text-2xl">{totals.basePlates}</div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Anchor bolts</div>
              <div className="text-gray-100 font-semibold text-2xl">{totals.anchorBolts}</div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Angle attachers</div>
              <div className="text-gray-100 font-semibold text-2xl">{totals.angleAttachers}</div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
              <div className="text-gray-400 text-xs">Nuts</div>
              <div className="text-gray-100 font-semibold text-2xl">{totals.nuts}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/** ===== Drawer + Navbar ===== */

const DrawerMenu = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950">
      <div onClick={onClose} className="fixed inset-0 z-40 bg-gray-950" />

      <aside className="fixed left-0 top-0 z-50 h-full w-80 bg-gray-950 border-r border-gray-800 shadow-2xl">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-gray-100 font-semibold text-lg">Menu</div>
            <div className="text-gray-400 text-xs">Solar Structure</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-100 bg-gray-800 hover:bg-gray-700 transition-colors px-3 py-2 rounded-lg"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Link
            href="/panels"
            onClick={onClose}
            className="block rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors p-4"
          >
            <div className="text-gray-100 font-semibold">List of Panels</div>
            <div className="text-gray-400 text-sm mt-1">View / add / manage panel models</div>
          </Link>
        </div>
      </aside>
    </div>
  );
};

const Navbar = () => {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-gray-950 text-gray-100 p-4 flex items-center justify-between sticky top-0 z-30 border-b border-gray-800">
      <button
        onClick={() => setOpen(true)}
        className="text-gray-100 focus:outline-none rounded-lg hover:bg-gray-800 transition-colors p-2"
        aria-label="Open menu"
        type="button"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="text-lg sm:text-xl font-bold tracking-wide">Solar Structure Cost Calculator</h1>
      <div className="w-10" />

      {open && <DrawerMenu onClose={() => setOpen(false)} />}
    </nav>
  );
};

const ResultsTable = ({ results }) => {
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
        <div className="font-semibold mb-1">{rods.isUniform ? "✅ Uniform Structures" : "⚠️ Mixed Structures"}</div>
        <div className="text-gray-200">
          {structures
            .map((s, i) => `${s.count} × ${s.panels}-panel${i < structures.length - 1 ? " + " : ""}`)
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
              {structures.map((s) => `${s.count}x${s.panels}`).join(" + ")}
            </td>
          </tr>

          {rods.breakdown.map((b, idx) => (
            <React.Fragment key={`${b.panels}-${idx}`}>
              <tr className="bg-gray-950/40">
                <td className="border-b border-gray-800 p-2 font-semibold" colSpan="2">
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

const InputForm = ({ panelModels, onCalculate }) => {
  const [frontLegHeight, setFrontLegHeight] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [selectedPanelModel, setSelectedPanelModel] = useState(panelModels[0]?.name || "");
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    if (panelModels.length && !panelModels.find((p) => p.name === selectedPanelModel)) {
      setSelectedPanelModel(panelModels[0].name);
    }
  }, [panelModels, selectedPanelModel]);

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

    // FIX: Always compute long side / short side first
    const longSide = Math.max(Number(selectedModel.width), Number(selectedModel.height));
    const shortSide = Math.min(Number(selectedModel.width), Number(selectedModel.height));

    // Horizontal (landscape) => long side along rod
    // Vertical (portrait) => short side along rod
    const panelLen = isVertical ? longSide : shortSide;

    const maxPanelsPerRod = calculatePanelsPerRod(panelLen);
    if (maxPanelsPerRod <= 0) {
      alert("Panel length too large to fit on a 164-inch rod with gap.");
      return;
    }

    const totalPanels = parseInt(numberOfPanels, 10);
    const front = parseFloat(frontLegHeight);

    const structures = smartDistributePanels(totalPanels, maxPanelsPerRod);
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
          {panelModels.map((m, idx) => {
            const longSide = Math.max(Number(m.width), Number(m.height));
            const shortSide = Math.min(Number(m.width), Number(m.height));

            return (
              <option key={`${m.name}-${idx}`} value={m.name}>
                {m.name} - {longSide}x{shortSide} - {m.description}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mb-8">
        <label className="block text-gray-300 mb-2">Orientation</label>
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 h-14">
          <input type="checkbox" checked={isVertical} onChange={(e) => setIsVertical(e.target.checked)} />
          <span className="text-gray-300">Vertical</span>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        className="mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-3 rounded-lg shadow-md transition w-full"
      >
        Calculate
      </button>
    </div>
  );
};

export default function Home() {
  const [panelModels, setPanelModels] = useState([]);
  const [results, setResults] = useState(null);

  useEffect(() => {
    setPanelModels(loadPanels());
  }, []);

  useEffect(() => {
    const onFocus = () => setPanelModels(loadPanels());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const models = panelModels.length ? panelModels : loadPanels();

  return (
    <div className="bg-gray-950 text-gray-100 min-h-screen antialiased">
      <Navbar />
      <div className="p-6 max-w-3xl mx-auto">
        <InputForm panelModels={models} onCalculate={setResults} />
        <ResultsTable results={results} />
        <RodCuttingSuggestions results={results} />
        <HardwareTotals results={results} />
      </div>
    </div>
  );
}
