import { ExternalLink, MessageSquare, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { BuildingResult } from "@/lib/types";
import { ConfidenceBadge, RatingStars, ScorePill, StatusBadge } from "./badges";

interface Props {
  building: BuildingResult | null;
  onClose: () => void;
}

const SENTIMENT_TONE = {
  positive: "bg-success/15 text-success",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-destructive/15 text-destructive",
} as const;

export function BuildingDetail({ building, onClose }: Props) {
  return (
    <Sheet open={!!building} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {building && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-tight">
                {building.name ?? building.address ?? "Unnamed building"}
              </SheetTitle>
              {building.address && building.name && (
                <p className="text-sm text-muted-foreground">
                  {building.address}
                </p>
              )}
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
                <ScorePill score={building.recommendationScore} className="h-12 w-12 text-lg" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Recommendation score</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ConfidenceBadge level={building.confidenceLevel} />
                    <StatusBadge building={building} />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Summary
                </h4>
                <ul className="space-y-1 text-sm">
                  {building.summary.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Scores are an estimate based on available public data, not an
                absolute measure. Always do your own research.
              </p>

              <Separator />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Google reviews
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Sort:{" "}
                    {building.googleReviewSort === "newest"
                      ? "Newest"
                      : "Most relevant"}
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-3">
                  <RatingStars
                    rating={building.googleRating}
                    count={building.googleReviewCount}
                  />
                  {building.googleMapsUrl && (
                    <a
                      href={building.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {building.googleReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No public Google reviews found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {building.googleReviews.map((rv, i) => (
                      <div key={i} className="rounded-lg border p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium">{rv.author}</span>
                          <span className="inline-flex items-center gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-rating text-rating" />
                            {rv.rating}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{rv.text}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {rv.relativeTime}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Reddit mentions
                </h4>
                {building.redditMentions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No public Reddit mentions found.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {building.redditMentions.map((m, i) => (
                      <a
                        key={i}
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 truncate font-medium">
                            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{m.title}</span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                              SENTIMENT_TONE[m.sentiment],
                            )}
                          >
                            {m.sentiment}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{m.snippet}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          r/{m.subreddit} · {m.score} upvotes
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
