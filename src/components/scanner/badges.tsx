import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BuildingResult,
  ConfidenceLevel,
  ResidentialStatus,
} from "@/lib/types";

export function ScorePill({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  const tone =
    score == null
      ? "bg-muted text-muted-foreground"
      : score >= 75
        ? "bg-success text-success-foreground"
        : score >= 55
          ? "bg-warning text-warning-foreground"
          : "bg-destructive text-destructive-foreground";
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums",
        tone,
        className,
      )}
    >
      {score == null ? "—" : score}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const tone =
    level === "High"
      ? "bg-success/15 text-success"
      : level === "Medium"
        ? "bg-warning/20 text-warning-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {level} confidence
    </span>
  );
}

export function ResidentialBadge({ status }: { status: ResidentialStatus }) {
  const tone =
    status === "Likely residential"
      ? "bg-info/15 text-info"
      : "bg-muted text-muted-foreground";
  const label =
    status === "Likely residential" ? "Likely residential" : "Possible residential";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function RatingStars({
  rating,
  count,
}: {
  rating: number | null;
  count: number | null;
}) {
  if (rating == null) {
    return (
      <span className="text-xs text-muted-foreground">No Google rating</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium">
      <Star className="h-4 w-4 fill-rating text-rating" />
      {rating.toFixed(1)}
      {count != null && (
        <span className="text-xs font-normal text-muted-foreground">
          ({count})
        </span>
      )}
    </span>
  );
}

export function StatusBadge({ building }: { building: BuildingResult }) {
  return building.hasReviews ? (
    <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
      Reviews found
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      No public reviews found
    </span>
  );
}
