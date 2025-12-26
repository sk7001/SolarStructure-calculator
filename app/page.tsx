"use client";

import React, { Suspense } from "react";
import HomeClient from "./HomeClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading...</div>}>
      <HomeClient />
    </Suspense>
  );
}
