import { useEffect, useRef, useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { autocompleteLocation } from "@/lib/scanner/scanner.functions";
import { cn } from "@/lib/utils";
import type { PlaceSuggestion, ReviewSort } from "@/lib/types";

interface Props {
  loading: boolean;
  onSearch: (
    input: string,
    sort: ReviewSort,
    coords?: { lat: number; lng: number; displayName?: string } | null,
  ) => void;
}

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export function SearchBar({ loading, onSearch }: Props) {
  const fetchSuggestions = useServerFn(autocompleteLocation);

  const [input, setInput] = useState("");
  const [sort, setSort] = useState<ReviewSort>("most_relevant");

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Coordinates from an explicitly selected suggestion (null = free-text).
  const [selected, setSelected] = useState<PlaceSuggestion | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  // Debounced suggestion fetching.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const query = input.trim();

    // Don't fetch when the input still matches the chosen suggestion.
    if (selected && query === selected.label) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (query.length < MIN_CHARS) {
      setSuggestions([]);
      setFetching(false);
      setOpen(false);
      return;
    }

    setFetching(true);
    setOpen(true);
    const reqId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetchSuggestions({ data: { query } });
        if (reqId !== requestIdRef.current) return; // stale response
        setSuggestions(res.suggestions);
        setActiveIndex(-1);
      } catch {
        if (reqId === requestIdRef.current) setSuggestions([]);
      } finally {
        if (reqId === requestIdRef.current) setFetching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, selected, fetchSuggestions]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(s: PlaceSuggestion) {
    setSelected(s);
    setInput(s.label);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSearch(s.label, sort, {
      lat: s.lat,
      lng: s.lng,
      displayName: s.description,
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    // Use selected suggestion coords if the input still matches it,
    // otherwise fall back to free-text search.
    const coords =
      selected && input.trim() === selected.label
        ? { lat: selected.lat, lng: selected.lng, displayName: selected.description }
        : null;
    onSearch(input, sort, coords);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        choose(suggestions[activeIndex]);
      }
    }
  }

  const showDropdown = open && input.trim().length >= MIN_CHARS;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      <div ref={containerRef} className="relative flex-1">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setSelected(null);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder="Address, subway station, or building name…"
          className="h-11 pl-9"
          aria-label="Search location"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls="location-suggestions"
          autoComplete="off"
        />

        {showDropdown && (
          <ul
            id="location-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.375rem)] z-50 max-h-80 overflow-auto rounded-md border bg-popover p-1 shadow-md"
          >
            {fetching && (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </li>
            )}

            {!fetching && suggestions.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                No results found
              </li>
            )}

            {!fetching &&
              suggestions.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // prevent input blur before click handler
                      e.preventDefault();
                      choose(s);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors",
                      i === activeIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {s.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden whitespace-nowrap rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground sm:inline">
          Radius: 1 km
        </span>

        <Select value={sort} onValueChange={(v) => setSort(v as ReviewSort)}>
          <SelectTrigger className="h-11 w-[160px]" aria-label="Review sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="most_relevant">Most relevant</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>

        <Button type="submit" disabled={loading} className="h-11 px-5">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Search</span>
        </Button>
      </div>
    </form>
  );
}
