import { createServerFn } from "@tanstack/react-start";
import {
  autocompletePlaces,
  enrichBuilding,
  fetchOsmBuildings,
  filterResidentialBuildings,
  geocode,
} from "./scanner.server";
import type { OsmBuilding, ReviewSort } from "../types";

const RADIUS_METERS = 1000;
const MAX_BUILDINGS = 24;

/** Autocomplete suggestions for the search input (debounced on client). */
export const autocompleteLocation = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    const query = (data?.query ?? "").trim();
    if (query.length > 200) throw new Error("Query is too long.");
    return { query };
  })
  .handler(async ({ data }) => {
    if (data.query.length < 3) return { suggestions: [] };
    const suggestions = await autocompletePlaces(data.query);
    return { suggestions };
  });

/** Steps 4-6: geocode input, fetch OSM buildings, keep residential ones. */
export const scanLocation = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      input: string;
      lat?: number;
      lng?: number;
      displayName?: string;
    }) => {
      const input = (data?.input ?? "").trim();
      if (!input) throw new Error("Please enter a location to search.");
      if (input.length > 200) throw new Error("Location is too long.");
      const hasCoords =
        typeof data.lat === "number" &&
        Number.isFinite(data.lat) &&
        typeof data.lng === "number" &&
        Number.isFinite(data.lng);
      return {
        input,
        lat: hasCoords ? data.lat : undefined,
        lng: hasCoords ? data.lng : undefined,
        displayName:
          typeof data.displayName === "string"
            ? data.displayName.slice(0, 300)
            : undefined,
      };
    },
  )
  .handler(async ({ data }) => {
    // Use coordinates from a selected suggestion when available; otherwise
    // fall back to geocoding the typed text.
    const location =
      data.lat != null && data.lng != null
        ? {
            lat: data.lat,
            lng: data.lng,
            displayName: data.displayName ?? data.input,
          }
        : await geocode(data.input);
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
