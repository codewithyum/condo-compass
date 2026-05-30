import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  enrichBuildingFn,
  scanLocation,
} from "@/lib/scanner/scanner.functions";
import type {
  BuildingResult,
  GeocodeResult,
  ListSortKey,
  ReviewSort,
} from "@/lib/types";

export type ScanPhase =
  | "idle"
  | "geocoding"
  | "fetching"
  | "enriching"
  | "done"
  | "error";

const CONCURRENCY = 4;

export function useScanner() {
  const runScan = useServerFn(scanLocation);
  const runEnrich = useServerFn(enrichBuildingFn);

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<GeocodeResult | null>(null);
  const [results, setResults] = useState<BuildingResult[]>([]);
  const [total, setTotal] = useState(0);
  const [scannedTotalBuildings, setScannedTotalBuildings] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usedMock, setUsedMock] = useState(false);

  const search = useCallback(
    async (input: string, sort: ReviewSort) => {
      setError(null);
      setResults([]);
      setSelectedId(null);
      setLocation(null);
      setUsedMock(false);
      setPhase("geocoding");
      try {
        setPhase("fetching");
        const scan = await runScan({ data: { input } });
        setLocation(scan.location);
        setScannedTotalBuildings(scan.totalBuildings);
        setTotal(scan.buildings.length);

        if (scan.buildings.length === 0) {
          setPhase("done");
          return;
        }

        setPhase("enriching");
        const queue = [...scan.buildings];
        let anyMock = false;

        async function worker() {
          while (queue.length) {
            const b = queue.shift();
            if (!b) break;
            try {
              const enriched = await runEnrich({
                data: { building: b, sort },
              });
              if (enriched.usedMockData) anyMock = true;
              setResults((prev) =>
                [...prev, enriched].sort(
                  (a, c) => a.distanceMeters - c.distanceMeters,
                ),
              );
            } catch {
              /* skip a failed building, keep going */
            }
          }
        }

        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker),
        );
        setUsedMock(anyMock);
        setPhase("done");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
        setPhase("error");
      }
    },
    [runScan, runEnrich],
  );

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId],
  );

  return {
    phase,
    error,
    location,
    results,
    total,
    scannedTotalBuildings,
    selectedId,
    selected,
    usedMock,
    setSelectedId,
    search,
  };
}

export function sortResults(
  results: BuildingResult[],
  key: ListSortKey,
): BuildingResult[] {
  const confidenceRank = { High: 3, Medium: 2, Low: 1 } as const;
  const copy = [...results];
  switch (key) {
    case "recommendation":
      return copy.sort(
        (a, b) => (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1),
      );
    case "rating":
      return copy.sort(
        (a, b) => (b.googleRating ?? -1) - (a.googleRating ?? -1),
      );
    case "reviewCount":
      return copy.sort(
        (a, b) => (b.googleReviewCount ?? -1) - (a.googleReviewCount ?? -1),
      );
    case "distance":
      return copy.sort((a, b) => a.distanceMeters - b.distanceMeters);
    case "confidence":
      return copy.sort(
        (a, b) =>
          confidenceRank[b.confidenceLevel] - confidenceRank[a.confidenceLevel],
      );
    default:
      return copy;
  }
}
