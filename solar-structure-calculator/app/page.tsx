"use client";

import React, { useState } from "react";

const calculatePanelsPerRod = (panelHeight, rodLength = 164, gap = 5) => {
  let maxPanels = 0;
  while (maxPanels * panelHeight + (maxPanels - 1) * gap <= rodLength) {
    maxPanels++;
  }
  return maxPanels - 1;
};

const calculateStructures = (totalPanels, maxPanelsPerRod) => {
  return Math.ceil(totalPanels / maxPanelsPerRod);
};

const calculateLegs = (totalStructures, totalPanels, frontLegHeight, panelHeight, tiltAngle = 19, gap = 5) => {
  const totalFrontLegs = totalStructures * 2; // Each panel has 2 front legs
  const totalRearLegs = totalStructures * 2; // Each panel has 2 rear legs

  // Total triangle height for all panels
  const totalHypotenuse = (panelHeight + gap) * totalPanels / totalStructures;

  const triangleHeight = totalHypotenuse * Math.sin((tiltAngle * Math.PI) / 180);

  // Rear leg height is the front leg height plus the total triangle height
  const rearLegHeight = frontLegHeight + triangleHeight;

  return {
    totalFrontLegs,
    totalRearLegs,
    frontLegHeight,
    rearLegHeight: rearLegHeight.toFixed(2), // Round to 2 decimal places
  };
};

const ResultsTable = ({ results }) => {
  if (!results) return null;

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-100">Results</h2>
      <table className="w-full text-gray-100">
        <thead>
          <tr>
            <th className="border-b border-gray-600 p-2 text-left">Metric</th>
            <th className="border-b border-gray-600 p-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border-b border-gray-600 p-2">Max Panels per Rod</td>
            <td className="border-b border-gray-600 p-2">{results.maxPanelsPerRod}</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Total Structures Needed</td>
            <td className="border-b border-gray-600 p-2">{results.totalStructures}</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Number of Front Legs</td>
            <td className="border-b border-gray-600 p-2">{results.legs.totalFrontLegs}</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Length of Front Legs</td>
            <td className="border-b border-gray-600 p-2">{results.legs.frontLegHeight} inches</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Number of Rear Legs</td>
            <td className="border-b border-gray-600 p-2">{results.legs.totalRearLegs}</td>
          </tr>
          <tr>
            <td className="border-b border-gray-600 p-2">Length of Rear Legs</td>
            <td className="border-b border-gray-600 p-2">{results.legs.rearLegHeight} inches</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const Navbar = ({ onAddPanelClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-gray-800 text-gray-100 p-4 flex items-center justify-between">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="text-gray-100 focus:outline-none"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          ></path>
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
    if (!newModelName || !newModelWidth || !newModelHeight || !newModelDescription) {
      alert("Please fill in all fields.");
      return;
    }

    const newModel = {
      name: newModelName,
      width: parseFloat(newModelWidth),
      height: parseFloat(newModelHeight),
      description: newModelDescription,
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
            placeholder="Description"
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
    const panelHeight = isVertical ? selectedModel.height : selectedModel.width;
    const maxPanelsPerRod = calculatePanelsPerRod(panelHeight);
    const totalStructures = calculateStructures(parseInt(numberOfPanels, 10), maxPanelsPerRod);

    // Pass the correct totalPanels value to calculateLegs
    const legs = calculateLegs(
      totalStructures,
      parseInt(numberOfPanels, 10), // Use the total number of panels directly
      parseFloat(frontLegHeight),
      panelHeight
    );

    onCalculate({
      maxPanelsPerRod,
      totalStructures,
      legs,
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
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md transition"
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

  const handleCalculate = (data) => {
    setResults(data);
  };

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen">
      <Navbar onAddPanelClick={() => setIsDrawerOpen(true)} />
      <div className="p-6">
        <InputForm panelModels={panelModels} onCalculate={handleCalculate} />
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
