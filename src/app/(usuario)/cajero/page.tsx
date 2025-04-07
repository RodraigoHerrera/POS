import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title:
    "Smash POS",
  description: "Esta es la vista de cajero.",
};

export default function cajero() {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6">
        <label className="col-span-12 text-center text-2xl font-bold text-gray-900 dark:text-white">
          Cajero
        </label>
    </div>
  );
}
