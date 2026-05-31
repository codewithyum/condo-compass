import type { OsmTags, ResidentialStatus } from "./types";

const NAME_KEYWORDS = [
  "residence",
  "residences",
  "condo",
  "condos",
  "apartment",
  "apartments",
  "tower",
  "place",
  "house",
  "lofts",
  "manor",
  "court",
];

/**
 * Transparent, signal-based scoring for whether an OSM building is residential.
 * Positive signals add points, negative signals subtract. The threshold logic
 * keeps uncertain buildings flagged as "Possible" instead of pretending to be
 * perfectly accurate.
 */
export function scoreResidential(tags: OsmTags): number {
  let score = 0;
  const building = (tags.building ?? "").toLowerCase();
  const name = (tags.name ?? "").toLowerCase();

  // Positive building types
  if (building === "apartments") score += 5;
  if (building === "residential") score += 5;
  if (building === "house") score += 4;
  if (building === "detached") score += 4;
  if (building === "terrace" || building === "dormitory") score += 3;

  // Levels
  const levels = Number(tags["building:levels"]);
  if (!Number.isNaN(levels)) {
    if (levels >= 5) score += 3;
    else if (levels >= 2) score += 1;
  }

  // Address tags
  if (tags["addr:housenumber"] || tags["addr:street"]) score += 2;

  // Name signals
  if (tags.name) score += 1;
  if (NAME_KEYWORDS.some((kw) => name.includes(kw))) score += 3;

  // Negative signals
  if (building === "commercial") score -= 5;
  if (building === "retail") score -= 5;
  if (building === "industrial") score -= 6;
  if (building === "warehouse") score -= 4;
  if (tags.tourism === "hotel") score -= 6;
  if (tags.amenity === "school") score -= 6;
  if (tags.amenity === "hospital") score -= 6;
  if (tags.amenity === "place_of_worship") score -= 4;
  if (tags.office) score -= 5;
  if (tags.shop) score -= 5;

  return score;
}

export function statusFromScore(score: number): ResidentialStatus {
  if (score >= 5) return "Likely residential";
  if (score >= 2) return "Possible residential building";
  return "Unlikely residential";
}
