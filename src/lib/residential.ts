import type { OsmTags, ResidentialStatus } from "./types";

/**
 * Names commonly used by condo / apartment towers (incl. well-known
 * Burnaby/Vancouver developments like Solo District, Stratus, Altus, Cirrus).
 */
const NAME_KEYWORDS = [
  "residence",
  "residences",
  "condo",
  "condos",
  "apartment",
  "apartments",
  "tower",
  "towers",
  "place",
  "house",
  "lofts",
  "manor",
  "court",
  "stratus",
  "altus",
  "cirrus",
  "solo district",
];

export interface ResidentialClassification {
  score: number;
  status: ResidentialStatus;
}

function lower(v: string | undefined): string {
  return (v ?? "").toLowerCase();
}

/**
 * Whether the tags carry any residential signal. Used both for status
 * derivation and to decide whether a `building:part` is worth merging into
 * its parent building.
 */
export function hasResidentialSignal(tags: OsmTags): boolean {
  const building = lower(tags.building);
  const part = lower(tags["building:part"]);
  const residential = lower(tags.residential);
  const name = lower(tags.name);
  const levels = Number(tags["building:levels"]);
  const highRise = !Number.isNaN(levels) && levels >= 8;

  return (
    building === "apartments" ||
    building === "residential" ||
    building === "house" ||
    building === "detached" ||
    building === "terrace" ||
    building === "dormitory" ||
    part === "apartments" ||
    part === "residential" ||
    residential === "apartments" ||
    Boolean(tags["building:flats"]) ||
    Boolean(tags["building:units"]) ||
    NAME_KEYWORDS.some((kw) => name.includes(kw)) ||
    ((building === "yes" || building === "") && highRise)
  );
}

/** Whether the tags carry a commercial / retail / office signal. */
export function hasCommercialSignal(tags: OsmTags): boolean {
  const building = lower(tags.building);
  return (
    Boolean(tags.shop) ||
    Boolean(tags.office) ||
    building === "commercial" ||
    building === "retail" ||
    Boolean(tags.amenity)
  );
}

/**
 * Transparent, signal-based scoring for whether an OSM building is residential.
 *
 * Mixed-use condo towers frequently carry retail/office/parking tags on their
 * lower floors, so commercial tags are treated as *soft* negatives and never
 * hard-exclude a building that also shows residential signals.
 */
export function classifyResidential(tags: OsmTags): ResidentialClassification {
  let score = 0;
  const building = lower(tags.building);
  const part = lower(tags["building:part"]);
  const residential = lower(tags.residential);
  const name = lower(tags.name);

  const levels = Number(tags["building:levels"]);
  const hasLevels = !Number.isNaN(levels);
  const highRise = hasLevels && levels >= 8;

  const hasName = Boolean(tags.name);
  const hasAddress = Boolean(tags["addr:housenumber"] || tags["addr:street"]);
  const nameMatch = NAME_KEYWORDS.some((kw) => name.includes(kw));
  const hasUnits = Boolean(tags["building:flats"] || tags["building:units"]);

  /* ---- Positive signals ---- */
  if (building === "apartments") score += 60;
  if (building === "residential") score += 55;
  if (part === "apartments") score += 50;
  if (part === "residential") score += 50;
  if (residential === "apartments") score += 50;
  if (building === "house" || building === "detached") score += 40;
  if (building === "terrace" || building === "dormitory") score += 30;
  if (highRise) score += 35;
  else if (hasLevels && levels >= 5) score += 15;
  if (hasAddress) score += 25;
  if (hasName) score += 25;
  if (nameMatch) score += 25;
  if (hasUnits) score += 20;

  const residentialSignal = hasResidentialSignal(tags);
  const commercialSignal = hasCommercialSignal(tags);
  const isCommercialBuilding = building === "commercial" || building === "retail";

  /* ---- Hard negative signals ---- */
  if (tags.tourism === "hotel") score -= 50;
  if (tags.amenity === "school") score -= 50;
  if (tags.amenity === "hospital") score -= 50;
  if (building === "industrial") score -= 40;
  if (building === "warehouse") score -= 40;

  /* ---- Soft negatives (never hard-exclude mixed-use condos) ---- */
  // commercial/retail only counts against a building with no residential or
  // high-rise signal.
  if (isCommercialBuilding && !residentialSignal && !highRise) score -= 25;
  // shop=* / office=* are common on condo podiums — small penalty only.
  if (tags.shop || tags.office) score -= 15;

  return {
    score,
    status: deriveStatus(score, residentialSignal, commercialSignal),
  };
}

function deriveStatus(
  score: number,
  residentialSignal: boolean,
  commercialSignal: boolean,
): ResidentialStatus {
  // Both residential AND commercial signals → mixed-use (keep it, don't drop).
  if (residentialSignal && commercialSignal) {
    return "Possible mixed-use residential building";
  }
  if (score >= 55) return "Likely residential";
  if (score >= 25) return "Possible residential building";
  return "Unlikely residential";
}

/* ---- Backwards-compatible helpers ---- */

export function scoreResidential(tags: OsmTags): number {
  return classifyResidential(tags).score;
}

export function statusFromScore(score: number): ResidentialStatus {
  if (score >= 55) return "Likely residential";
  if (score >= 25) return "Possible residential building";
  return "Unlikely residential";
}
