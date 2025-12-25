"use client";

import React, { useState } from "react";

const ROD_LENGTH = 164;
const GAP = 5;
const TILT_ANGLE = 19;

/** 1) Max panels per 164" rod (your same logic) */
const calculatePanelsPerRod = (panelLen, rodLength = ROD_LENGTH, gap = GAP) => {
  let maxPanels = 0;
  while (maxPanels * panelLen + (maxPanels - 1) * gap <= rodLength) {
    maxPanels++;
  }
  return maxPanels - 1;
};

/** 2) Smart distribution: 6 => 2x3, 5 => 1x3+1x2, 4 => 1x3+1x1 */
const smartDistributePanels = (totalPanels, maxPanelsPerRod) => {
  const fullStructures = Math.floor(totalPanels / maxPanelsPerRod);
  const remainingPanels = totalPanels % maxPanelsPerRod;

  if (remainingPanels === 0) {
    return [{ panels: maxPanelsPerRod, count: fullStructures }];
  }

  return [
    { panels: maxPanelsPerRod, count: fullStructures },
    { panels: remainingPanels, count: 1 },
  ].filter((s) => s.count > 0);
};

/**
 * 3) Legs per structure type (KEEPING YOUR FORMULA)
 * - totalHypotenuse = (panelLen + gap) * panelsPerStructure
 * - triangleHeight = totalHypotenuse * sin(19deg)
 * - rear = front + triangleHeight
 *
 * Here: totalHypotenuse is ALSO used as the GI sloping rod length (User Story 5).
 */
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
    hypotenuseRodLength: totalHypotenuse.toFixed(2), // IMPORTANT: GI hyp rod length
  };
};

/** 4) User Story 5: total GI rods for mixed structures (NO pythagoras; your hyp = totalHypotenuse) */
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
    const hypoRodsCount = 2 * s.count; // 2 hyp GI rods per structure

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

const ResultsTable = ({ results }) => {
  if (!results) return null;

  const { maxPanelsPerRod, structures, rods } = results;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Results</h2>

      <div
        className={`p-4 rounded mb-6 ${
          rods.isUniform
            ? "bg-green-900/30 border-l-4 border-green-400"
            : "bg-yellow-900/30 border-l-4 border-yellow-400"
        }`}
      >
        <h3 className="font-semibold mb-2">
          {rods.isUniform ? "✅ Uniform Structures" : "⚠️ Mixed Structures"}
        </h3>
        <p className="text-lg">
          {structures.map((s, i) => `${s.count} × ${s.panels}-panel${i < structures.length - 1 ? " + " : ""}`).join("")}
        </p>
      </div>

      <table className="w-full text-gray-100 mb-6">
        <thead>
          <tr>
            <th className="border-b border-gray-600 p-2 text-left">Metric</th>
            <th className="border-b border-gray-600 p-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-gray-600 p-2">Max Panels per Rod</td>
            <td className="border-b border-gray-600 p-2">{maxPanelsPerRod}</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Structure Distribution</td>
            <td className="border-b border-gray-600 p-2">
              {structures.map((s) => `${s.count}x${s.panels}`).join(" + ")}
            </td>
          </tr>

          {/* Per-structure-type breakdown (needed for 4/5 panels) */}
          {rods.breakdown.map((b, idx) => (
            <React.Fragment key={`${b.panels}-${idx}`}>
              <tr className="bg-gray-900/40">
                <td className="border-b border-gray-600 p-2 font-semibold" colSpan="2">
                  {b.count} × {b.panels}-panel structure
                </td>
              </tr>
              <tr>
                <td className="border-b border-gray-600 p-2">Front legs</td>
                <td className="border-b border-gray-600 p-2">
                  {b.frontLegsCount} × {b.legs.frontLegHeight}"
                </td>
              </tr>
              <tr>
                <td className="border-b border-gray-600 p-2">Rear legs</td>
                <td className="border-b border-gray-600 p-2">
                  {b.rearLegsCount} × {b.legs.rearLegHeight}"
                </td>
              </tr>
              <tr className="bg-blue-900/20">
                <td className="border-b border-gray-600 p-2 font-semibold">Hypotenuse rods (GI)</td>
                <td className="border-b border-gray-600 p-2 font-semibold">
                  {b.hypoRodsCount} × {b.legs.hypotenuseRodLength}"
                </td>
              </tr>
            </React.Fragment>
          ))}

          <tr className="bg-green-900/50">
            <td className="border-b border-gray-600 p-2 font-bold text-xl">TOTAL GI Rods (164")</td>
            <td className="border-b border-gray-600 p-2 font-bold text-xl text-green-300">
              {rods.totals.totalRodsNeeded}
            </td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Total Material Length</td>
            <td className="border-b border-gray-600 p-2">{rods.totals.totalInchesRequired} inches</td>
          </tr>
        </tbody>
      </table>

      <div className="bg-yellow-900/50 border border-yellow-500 p-4 rounded">
        <h3 className="font-semibold mb-2 text-yellow-100">Fabrication Summary</h3>
        <ul className="text-sm space-y-1">
          <li>
            • <strong>Total Front Legs:</strong> {rods.totals.totalFrontLegs} pieces
          </li>
          <li>
            • <strong>Total Rear Legs:</strong> {rods.totals.totalRearLegs} pieces
          </li>
          <li>
            • <strong>Total Hypotenuse Rods:</strong> {rods.totals.totalHypoRods} pieces
          </li>
          <li className="bg-green-900/50 p-2 rounded font-bold text-green-300 mt-2">
            ORDER: {rods.totals.totalRodsNeeded} full GI rods (164" each)
          </li>
        </ul>
      </div>
    </div>
  );
};

const Navbar = ({ onAddPanelClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-800 text-gray-100 p-4 flex items-center justify-between">
      <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-gray-100 focus:outline-none">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      {isMenuOpen && (
        <div className="absolute top-16 left-0 bg-gray-900 w-64 p-4 shadow-lg">
          <button
            onClick={onAddPanelClick}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition w-full"
          >
            Add Panel Model
          </button>
        </div>
      )}

      <h1 className="text-xl font-bold">Solar Structure Cost Calculator</h1>
    </nav>
  );
};

const PanelModelManager = ({ panelModels, setPanelModels, isDrawerOpen, setIsDrawerOpen }) => {
  const [newModelName, setNewModelName] = useState("");
  const [newModelWidth, setNewModelWidth] = useState("");
  const [newModelHeight, setNewModelHeight] = useState("");
  const [newModelDescription, setNewModelDescription] = useState("");

  const addPanelModel = () => {
    if (!newModelName || !newModelWidth || !newModelHeight) {
      alert("Please fill in all required fields.");
      return;
    }

    const newModel = {
      name: newModelName,
      width: parseFloat(newModelWidth),
      height: parseFloat(newModelHeight),
      description: newModelDescription || "Custom panel",
    };

    setPanelModels([...panelModels, newModel]);
    setNewModelName("");
    setNewModelWidth("");
    setNewModelHeight("");
    setNewModelDescription("");
    setIsDrawerOpen(false);
  };

  return (
    isDrawerOpen && (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-end">
        <div className="bg-gray-800 w-96 p-6 shadow-lg rounded-l-lg">
          <h2 className="text-2xl font-semibold mb-4 text-gray-100">Add New Panel Model</h2>

          <input
            type="text"
            placeholder="Model Name"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            placeholder="Width (in inches)"
            value={newModelWidth}
            onChange={(e) => setNewModelWidth(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="number"
            placeholder="Height (in inches)"
            value={newModelHeight}
            onChange={(e) => setNewModelHeight(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <textarea
            placeholder="Description (optional)"
            value={newModelDescription}
            onChange={(e) => setNewModelDescription(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex justify-end gap-4">
            <button
              onClick={addPanelModel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow-md transition"
            >
              Save
            </button>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow-md transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  );
};

const InputForm = ({ panelModels, onCalculate }) => {
  const [frontLegHeight, setFrontLegHeight] = useState("");
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [selectedPanelModel, setSelectedPanelModel] = useState(panelModels[0]?.name || "");
  const [isVertical, setIsVertical] = useState(false);

  const handleCalculate = () => {
    if (!frontLegHeight || !numberOfPanels || !selectedPanelModel) {
      alert("Please fill in all fields.");
      return;
    }

    const selectedModel = panelModels.find((model) => model.name === selectedPanelModel);

    // IMPORTANT: This is the panel dimension used for stacking calculation AND for your hyp formula.
    // If your real-world "3 panels fit" uses 45 along the 164" direction, keep this as width when not-vertical.
    const panelLen = isVertical ? selectedModel.height : selectedModel.width;

    const maxPanelsPerRod = calculatePanelsPerRod(panelLen);
    if (maxPanelsPerRod <= 0) {
      alert("Panel length is too big to fit on a 164-inch rod with gap.");
      return;
    }

    const totalPanels = parseInt(numberOfPanels, 10);
    const front = parseFloat(frontLegHeight);

    const structures = smartDistributePanels(totalPanels, maxPanelsPerRod);
    const rods = calculateRodsForProject(structures, front, panelLen);

    onCalculate({
      maxPanelsPerRod,
      structures,
      rods,
      frontLegHeight: front,
    });
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Input Form</h2>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Front Leg Height (in inches)</label>
        <input
          type="number"
          value={frontLegHeight}
          onChange={(e) => setFrontLegHeight(e.target.value)}
          className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Number of Panels</label>
        <input
          type="number"
          value={numberOfPanels}
          onChange={(e) => setNumberOfPanels(e.target.value)}
          className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Panel Model</label>
        <select
          value={selectedPanelModel}
          onChange={(e) => setSelectedPanelModel(e.target.value)}
          className="border border-gray-600 bg-gray-700 text-gray-100 rounded w-full p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {panelModels.map((model, index) => (
            <option key={index} value={model.name}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-gray-300 mb-2">Orientation</label>
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={isVertical}
            onChange={(e) => setIsVertical(e.target.checked)}
            className="mr-2"
          />
          <span className="text-gray-300">Vertical</span>
        </div>
      </div>

      <button
        onClick={handleCalculate}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition w-full"
      >
        Calculate
      </button>
    </div>
  );
};

export default function Home() {
  const [panelModels, setPanelModels] = useState([
    { name: "Panel 45x90", width: 45, height: 90, description: "Default panel model" },
  ]);
  const [results, setResults] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen">
      <Navbar onAddPanelClick={() => setIsDrawerOpen(true)} />
      <div className="p-6">
        <InputForm panelModels={panelModels} onCalculate={setResults} />
        <ResultsTable results={results} />
      </div>
      <PanelModelManager
        panelModels={panelModels}
        setPanelModels={setPanelModels}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
      />
    </div>
  );
}
