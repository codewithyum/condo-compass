import { createServerFn } from "@tanstack/react-start";
import {
  enrichBuilding,
  fetchOsmBuildings,
  filterResidentialBuildings,
  geocode,
} from "./scanner.server";
import type { OsmBuilding, ReviewSort } from "../types";

const RADIUS_METERS = 1000;
const MAX_BUILDINGS = 24;

/** Steps 4-6: geocode input, fetch OSM buildings, keep residential ones. */
export const scanLocation = createServerFn({ method: "POST" })
  .inputValidator((data: { input: string }) => {
    const input = (data?.input ?? "").trim();
    if (!input) throw new Error("Please enter a location to search.");
    if (input.length > 200) throw new Error("Location is too long.");
    return { input };
  })
  .handler(async ({ data }) => {
    const location = await geocode(data.input);
    const all = await fetchOsmBuildings(
      location.lat,
      location.lng,
      RADIUS_METERS,
    );
    const residential = filterResidentialBuildings(all).slice(0, MAX_BUILDINGS);
    return {
      location,
      radiusMeters: RADIUS_METERS,
      totalBuildings: all.length,
      buildings: residential,
    };
  });

/** Steps 7-14 for a single building, enabling progressive/partial results. */
export const enrichBuildingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { building: OsmBuilding; sort: ReviewSort }) => {
      if (!data?.building?.id) throw new Error("Invalid building payload.");
      const sort: ReviewSort =
        data.sort === "newest" ? "newest" : "most_relevant";
      return { building: data.building, sort };
    },
  )
  .handler(async ({ data }) => {
    return enrichBuilding(data.building, data.sort);
  });
