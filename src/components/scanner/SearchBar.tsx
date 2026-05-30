import { useState } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReviewSort } from "@/lib/types";

interface Props {
  loading: boolean;
  onSearch: (input: string, sort: ReviewSort) => void;
}

export function SearchBar({ loading, onSearch }: Props) {
  const [input, setInput] = useState("");
  const [sort, setSort] = useState<ReviewSort>("most_relevant");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(input, sort);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 lg:flex-row lg:items-center"
    >
      <div className="relative flex-1">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Address, subway station, or building name…"
          className="h-11 pl-9"
          aria-label="Search location"
        />
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
