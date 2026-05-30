import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, Building2, Info } from "lucide-react";
import { SearchBar } from "@/components/scanner/SearchBar";
import { BuildingList } from "@/components/scanner/BuildingList";
import { BuildingDetail } from "@/components/scanner/BuildingDetail";
import { MapPanel } from "@/components/scanner/MapPanel";
import { sortResults, useScanner } from "@/components/scanner/useScanner";
import type { ListSortKey } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Condo Reputation Scanner — Find well-reviewed buildings" },
      {
        name: "description",
        content:
          "Search any address or neighborhood to scan nearby residential buildings and see Google + Reddit reputation summaries with a recommendation score.",
      },
      { property: "og:title", content: "Condo Reputation Scanner" },
      {
        property: "og:description",
        content:
          "Scan residential buildings within 1km and view reputation summaries and recommendation scores.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const scanner = useScanner();
  const [sortKey, setSortKey] = useState<ListSortKey>("recommendation");
  const [showNoReviews, setShowNoReviews] = useState(true);
  const [showUncertain, setShowUncertain] = useState(true);

  const loading =
    scanner.phase === "geocoding" ||
    scanner.phase === "fetching" ||
    scanner.phase === "enriching";

  const sorted = useMemo(
    () => sortResults(scanner.results, sortKey),
    [scanner.results, sortKey],
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="z-10 border-b bg-card/80 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Condo Reputation Scanner</h1>
          {scanner.location && (
            <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">
              · {scanner.location.displayName}
            </span>
          )}
        </div>
        <div className="px-4 pb-3 pt-2">
          <SearchBar loading={loading} onSearch={scanner.search} />
        </div>

        {scanner.phase === "error" && scanner.error && (
          <div className="flex items-center gap-2 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {scanner.error}
          </div>
        )}
        {scanner.usedMock && scanner.phase === "done" && (
          <div className="flex items-center gap-2 border-t bg-info/10 px-4 py-2 text-xs text-info-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            Showing mock review data. Add Google &amp; Reddit API keys to connect
            live sources.
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 h-[50vh] shrink-0 border-t lg:order-1 lg:h-auto lg:w-[420px] lg:border-r lg:border-t-0">
          <BuildingList
            results={sorted}
            phase={scanner.phase}
            total={scanner.total}
            selectedId={scanner.selectedId}
            onSelect={scanner.setSelectedId}
            sortKey={sortKey}
            onSortKey={setSortKey}
            showNoReviews={showNoReviews}
            onToggleNoReviews={setShowNoReviews}
            showUncertain={showUncertain}
            onToggleUncertain={setShowUncertain}
          />
        </aside>

        <main className="order-1 h-[40vh] flex-1 lg:order-2 lg:h-auto">
          <MapPanel
            location={scanner.location}
            results={scanner.results}
            selectedId={scanner.selectedId}
            showNoReviews={showNoReviews}
            showUncertain={showUncertain}
            onSelect={scanner.setSelectedId}
          />
        </main>
      </div>

      <BuildingDetail
        building={scanner.selected}
        onClose={() => scanner.setSelectedId(null)}
      />
    </div>
  );
}
