// app/lib/costing.ts
export const ROD_LENGTH = 164;

export const HARDWARE_PER_STRUCTURE = {
  basePlates: 4,
  anchorBolts: 16,
  angleAttachers: 4,
  nuts: 24, // normal bolts
};

export type CostData = {
  qty: {
    inchesUsed: number;
    structures: number;
    basePlates: number;
    anchorBolts: number;
    angleFitters: number;
    normalBolts: number;
  };
  price: {
    rodPerInch: number;
    basePlate: number;
    anchorBolt: number;
    angleFitter: number;
    normalBolt: number;

    /**
     * Kept as `service` for backward compatibility with existing UI & saved projects.
     * In your UI this is shown as "Fabrication charges".
     */
    service: number;

    /** Installation charges (fixed) */
    installation: number;

    wastagePct: number;
  };
  items: {
    rodsByInches: number;
    basePlates: number;
    anchorBolts: number;
    angleFitters: number;
    normalBolts: number;
  };
  subtotal: number;
  wastage: number;
  total: number;
};

const toNum = (v: string, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function computeCost(params: {
  results: any;
  rodPrice: string;
  basePlatePrice: string;
  anchorBoltPrice: string;
  angleFitterPrice: string;
  normalBoltPrice: string;

  /** In UI: Fabrication charges (kept param name for backward compatibility) */
  serviceCharges: string;

  /** NEW: Installation charges */
  installationCharges: string;

  wastagePercent: string;
}): CostData | null {
  const {
    results,
    rodPrice,
    basePlatePrice,
    anchorBoltPrice,
    angleFitterPrice,
    normalBoltPrice,
    serviceCharges,
    installationCharges,
    wastagePercent,
  } = params;

  const inchesStr = results?.rods?.totals?.totalInchesRequired;
  const hasStructures = Array.isArray(results?.structures) && results.structures.length > 0;
  if (!inchesStr || !hasStructures) return null;

  const inchesUsed = Number(inchesStr) || 0;
  const structures = results.structures.reduce((sum: number, s: any) => sum + (Number(s.count) || 0), 0);

  const qty = {
    inchesUsed,
    structures,
    basePlates: structures * HARDWARE_PER_STRUCTURE.basePlates,
    anchorBolts: structures * HARDWARE_PER_STRUCTURE.anchorBolts,
    angleFitters: structures * HARDWARE_PER_STRUCTURE.angleAttachers,
    normalBolts: structures * HARDWARE_PER_STRUCTURE.nuts,
  };

  const perRod = toNum(rodPrice, 1000);
  const rodPerInch = perRod / ROD_LENGTH;

  const price = {
    rodPerInch,
    basePlate: toNum(basePlatePrice, 150),
    anchorBolt: toNum(anchorBoltPrice, 20),
    angleFitter: toNum(angleFitterPrice, 150),
    normalBolt: toNum(normalBoltPrice, 15),

    // In UI: Fabrication charges
    service: toNum(serviceCharges, 1500),

    // NEW
    installation: toNum(installationCharges, 0),

    wastagePct: toNum(wastagePercent, 15),
  };

  const items = {
    rodsByInches: qty.inchesUsed * price.rodPerInch,
    basePlates: qty.basePlates * price.basePlate,
    anchorBolts: qty.anchorBolts * price.anchorBolt,
    angleFitters: qty.angleFitters * price.angleFitter,
    normalBolts: qty.normalBolts * price.normalBolt,
  };

  const subtotal = items.rodsByInches + items.basePlates + items.anchorBolts + items.angleFitters + items.normalBolts;
  const wastage = (subtotal * price.wastagePct) / 100;

  // Installation is a fixed add-on similar to fabrication.
  const total = subtotal + wastage + price.service + price.installation;

  return { qty, price, items, subtotal, wastage, total };
}
