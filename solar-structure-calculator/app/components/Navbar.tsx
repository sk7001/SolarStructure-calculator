"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const DrawerMenu = ({ onClose }: { onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
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
            href="/"
            onClick={onClose}
            className="block rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors p-4"
          >
            <div className="text-gray-100 font-semibold">Calculator</div>
            <div className="text-gray-400 text-sm mt-1">Main cost calculator</div>
          </Link>

          <Link
            href="/projects"
            onClick={onClose}
            className="block rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors p-4"
          >
            <div className="text-gray-100 font-semibold">Projects</div>
            <div className="text-gray-400 text-sm mt-1">Saved projects</div>
          </Link>

          <Link
            href="/panels"
            onClick={onClose}
            className="block rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors p-4"
          >
            <div className="text-gray-100 font-semibold">List of Panels</div>
            <div className="text-gray-400 text-sm mt-1">View / add / manage panel models</div>
          </Link>

          <Link
            href="/pieces"
            onClick={onClose}
            className="block rounded-xl border border-gray-800 bg-gray-900 hover:bg-gray-800 transition-colors p-4"
          >
            <div className="text-gray-100 font-semibold">Old Inventory (Usable Pieces)</div>
            <div className="text-gray-400 text-sm mt-1">Save and view leftover usable pieces</div>
          </Link>
        </div>
      </aside>
    </div>
  );
};

export default function Navbar() {
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
}
