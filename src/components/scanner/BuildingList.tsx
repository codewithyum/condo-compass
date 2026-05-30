import { Building2, Loader2, SearchX } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { BuildingResult, ListSortKey } from "@/lib/types";
import type { ScanPhase } from "./useScanner";
import { BuildingCard } from "./BuildingCard";

interface Props {
  results: BuildingResult[];
  phase: ScanPhase;
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sortKey: ListSortKey;
  onSortKey: (k: ListSortKey) => void;
  showNoReviews: boolean;
  onToggleNoReviews: (v: boolean) => void;
  showUncertain: boolean;
  onToggleUncertain: (v: boolean) => void;
}

const SORT_LABELS: Record<ListSortKey, string> = {
  recommendation: "Recommendation score",
  rating: "Google rating",
  reviewCount: "Review count",
  distance: "Distance",
  confidence: "Confidence level",
};

export function BuildingList({
  results,
  phase,
  total,
  selectedId,
  onSelect,
  sortKey,
  onSortKey,
  showNoReviews,
  onToggleNoReviews,
  showUncertain,
  onToggleUncertain,
}: Props) {
  const visible = results.filter((r) => {
    if (!showNoReviews && !r.hasReviews) return false;
    if (
      !showUncertain &&
      (r.residentialStatus === "Possible residential building" ||
        r.residentialStatus === "Possible mixed-use residential building")
    ) {
      return false;
    }
    return true;
  });

  const enriching = phase === "enriching";
  const isEmpty =
    (phase === "done" || phase === "error") && results.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>
            {visible.length} building{visible.length === 1 ? "" : "s"}
            {enriching && total > 0 && ` · scanning ${results.length}/${total}`}
          </span>
        </div>
        <Select value={sortKey} onValueChange={(v) => onSortKey(v as ListSortKey)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as ListSortKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <Label
          htmlFor="show-no-reviews"
          className="text-xs text-muted-foreground"
        >
          Show buildings with no reviews
        </Label>
        <Switch
          id="show-no-reviews"
          checked={showNoReviews}
          onCheckedChange={onToggleNoReviews}
        />
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {visible.map((b) => (
          <BuildingCard
            key={b.id}
            building={b}
            selected={b.id === selectedId}
            onSelect={() => onSelect(b.id)}
          />
        ))}

        {enriching && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching reviews…
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <SearchX className="h-8 w-8" />
            <p className="text-sm">
              No likely residential buildings found within 1 km.
            </p>
          </div>
        )}

        {phase === "idle" && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <Building2 className="h-8 w-8" />
            <p className="text-sm">
              Search a location to scan nearby residential buildings.
            </p>
          </div>
        )}

        {!showNoReviews &&
          results.length > 0 &&
          visible.length === 0 &&
          !enriching && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No buildings with public reviews. Toggle above to show all.
            </div>
          )}
      </div>
    </div>
  );
}
