import { MessageSquare, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildingResult } from "@/lib/types";
import {
  ConfidenceBadge,
  RatingStars,
  ResidentialBadge,
  ScorePill,
  StatusBadge,
} from "./badges";

interface Props {
  building: BuildingResult;
  selected: boolean;
  onSelect: () => void;
}

export function BuildingCard({ building, selected, onSelect }: Props) {
  const title = building.name ?? building.address ?? "Unnamed building";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-all hover:border-primary/40",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-tight">{title}</h3>
          {building.name && building.address && (
            <p className="truncate text-xs text-muted-foreground">
              {building.address}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center">
          <ScorePill score={building.recommendationScore} />
          <span className="mt-0.5 text-[10px] text-muted-foreground">score</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ResidentialBadge status={building.residentialStatus} />
        <ConfidenceBadge level={building.confidenceLevel} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <RatingStars
          rating={building.googleRating}
          count={building.googleReviewCount}
        />
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          {building.redditMentions.length} Reddit
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {building.distanceMeters} m
        </span>
      </div>

      <ul className="mt-3 space-y-0.5 text-xs text-muted-foreground">
        {building.summary.map((line, i) => (
          <li key={i} className="line-clamp-1">
            {line}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <StatusBadge building={building} />
      </div>
    </button>
  );
}
