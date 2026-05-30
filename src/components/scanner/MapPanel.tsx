import { Suspense, lazy, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { BuildingResult, GeocodeResult } from "@/lib/types";

const ScannerMap = lazy(() => import("./ScannerMap"));

interface Props {
  location: GeocodeResult | null;
  results: BuildingResult[];
  selectedId: string | null;
  showNoReviews: boolean;
  showUncertain: boolean;
  onSelect: (id: string) => void;
}

function MapFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

/** Renders Leaflet only on the client to avoid SSR window errors. */
export function MapPanel(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <MapFallback />;
  return (
    <Suspense fallback={<MapFallback />}>
      <ScannerMap {...props} />
    </Suspense>
  );
}
