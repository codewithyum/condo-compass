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
  // Mixed-use / high-rise condo brand-style keywords
  "district",
  "stratus",
  "altus",
  "cirrus",
  "skyline",
];

/**
 * Detects whether a building carries residential-like signals using ONLY the
 * lightweight OSM tags we already fetch (no extra Overpass cost). Used to keep
 * mixed-use condos (which often also have shop/office/retail tags) from being
 * hard-excluded.
 */
export function hasResidentialSignals(tags: OsmTags): boolean {
  const building = (tags.building ?? "").toLowerCase();
  const name = (tags.name ?? "").toLowerCase();
  const levels = Number(tags["building:levels"]);

  if (building === "apartments" || building === "residential") return true;
  if (building === "house" || building === "detached" || building === "terrace")
    return true;
  if ((tags["building:use"] ?? "").toLowerCase() === "residential") return true;
  if ((tags.residential ?? "").toLowerCase() === "apartments") return true;
  if (tags["building:flats"] || tags["building:units"] || tags["addr:flats"])
    return true;
  if (!Number.isNaN(levels) && levels >= 4) return true;
  if (NAME_KEYWORDS.some((kw) => name.includes(kw))) return true;
  if (tags["addr:housenumber"] || tags["addr:street"]) return true;

  return false;
}

/** Detects commercial / non-residential signals on the building. */
export function hasCommercialSignals(tags: OsmTags): boolean {
  const building = (tags.building ?? "").toLowerCase();
  return Boolean(
    tags.shop ||
      tags.office ||
      building === "commercial" ||
      building === "retail",
  );
}

/**
 * Transparent, signal-based scoring for whether an OSM building is residential.
 * Mixed-use friendly: commercial signals (shop/office/retail/commercial) are
 * only penalised when there are no residential-like signals on the building.
 */
export function scoreResidential(tags: OsmTags): number {
  let score = 0;
  const building = (tags.building ?? "").toLowerCase();
  const name = (tags.name ?? "").toLowerCase();
  const residentialSignals = hasResidentialSignals(tags);

  // Positive building types
  if (building === "apartments") score += 5;
  if (building === "residential") score += 5;
  if (building === "house") score += 4;
  if (building === "detached") score += 4;
  if (building === "terrace" || building === "dormitory") score += 3;

  // Explicit residential / unit tags (common on mixed-use condos)
  if ((tags["building:use"] ?? "").toLowerCase() === "residential") score += 4;
  if ((tags.residential ?? "").toLowerCase() === "apartments") score += 4;
  if (tags["building:flats"] || tags["building:units"] || tags["addr:flats"])
    score += 4;

  // Levels — tall buildings are very often residential / mixed-use towers
  const levels = Number(tags["building:levels"]);
  if (!Number.isNaN(levels)) {
    if (levels >= 8) score += 4;
    else if (levels >= 5) score += 3;
    else if (levels >= 2) score += 1;
  }

  // Address tags
  if (tags["addr:housenumber"] || tags["addr:street"]) score += 2;

  // Name signals
  if (tags.name) score += 1;
  if (NAME_KEYWORDS.some((kw) => name.includes(kw))) score += 3;

  // Commercial building types: only penalise when there are NO residential
  // signals, so mixed-use towers stay in the running.
  if (building === "commercial" || building === "retail") {
    score += residentialSignals ? 0 : -5;
  }

  // shop / office: light touch when residential signals exist (mixed-use),
  // heavier penalty otherwise.
  if (tags.shop) score += residentialSignals ? -1 : -5;
  if (tags.office) score += residentialSignals ? -1 : -5;

  // Hard non-residential signals (still penalised even with weak signals)
  if (building === "industrial") score -= 6;
  if (building === "warehouse") score -= 4;
  if (tags.tourism === "hotel") score -= 6;
  if (tags.amenity === "school") score -= 6;
  if (tags.amenity === "hospital") score -= 6;
  if (tags.amenity === "place_of_worship") score -= 4;

  return score;
}

export function statusFromScore(score: number, tags?: OsmTags): ResidentialStatus {
  const mixedUse =
    tags != null && hasResidentialSignals(tags) && hasCommercialSignals(tags);

  if (score >= 5) {
    return mixedUse ? "Possible mixed-use residential building" : "Likely residential";
  }
  if (score >= 2) {
    return mixedUse
      ? "Possible mixed-use residential building"
      : "Possible residential building";
  }
  return "Unlikely residential";
}
