import { scoreResidential, statusFromScore } from "../residential";
import type {
  BuildingResult,
  ConfidenceLevel,
  GeocodeResult,
  GoogleReview,
  OsmBuilding,
  OsmTags,
  PlaceSuggestion,
  RedditMention,
  ReviewSort,
} from "../types";

const USER_AGENT = "CondoReputationScanner/1.0 (Lovable MVP)";

/* ------------------------------------------------------------------ */
/* Geocoding — uses free OSM Nominatim (no key required)              */
/* ------------------------------------------------------------------ */

export async function geocode(input: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
    input,
  )}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    if (!data.length) throw new Error("No matching location found");
    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to geocode location",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Autocomplete suggestions                                           */
/*                                                                    */
/* Uses free OSM Nominatim search (no key required). Structured so a  */
/* keyed provider (Google Places Autocomplete, Mapbox, etc.) can be   */
/* swapped in later behind this same server-side function.            */
/* ------------------------------------------------------------------ */

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  address?: Record<string, string>;
}

function suggestionLabel(r: NominatimResult): string {
  if (r.name) return r.name;
  const a = r.address ?? {};
  return (
    a.building ||
    a.house_name ||
    a.road ||
    a.neighbourhood ||
    a.suburb ||
    a.station ||
    a.city ||
    r.display_name.split(",")[0] ||
    "Location"
  );
}

export async function autocompletePlaces(
  query: string,
): Promise<PlaceSuggestion[]> {
  // Real provider hook: if a Google key exists later, branch here.
  // For now Nominatim provides real, key-less suggestions.
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2` +
    `&limit=6&addressdetails=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`Autocomplete responded ${res.status}`);
    const data = (await res.json()) as NominatimResult[];
    return data.map((r) => ({
      id: String(r.place_id),
      label: suggestionLabel(r),
      description: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
  } catch {
    // Fail soft — autocomplete is non-critical; user can still free-text search.
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* OSM buildings — uses free Overpass API (no key required)          */
/* ------------------------------------------------------------------ */

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function buildAddress(tags: OsmTags): string | null {
  const num = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const city = tags["addr:city"];
  const parts = [
    [num, street].filter(Boolean).join(" "),
    city,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
}

export async function fetchOsmBuildings(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<OsmBuilding[]> {
  const query = `
    [out:json][timeout:25];
    (
      way["building"](around:${radiusMeters},${lat},${lng});
      relation["building"](around:${radiusMeters},${lat},${lng});
    );
    out tags center;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
  const data = (await res.json()) as { elements: OverpassElement[] };

  const buildings: OsmBuilding[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const blat = el.lat ?? el.center?.lat;
    const blng = el.lon ?? el.center?.lon;
    if (blat == null || blng == null) continue;

    const score = scoreResidential(tags);
    buildings.push({
      id: `${el.type}/${el.id}`,
      osmId: `${el.type}/${el.id}`,
      name: tags.name ?? null,
      address: buildAddress(tags),
      lat: blat,
      lng: blng,
      tags,
      residentialScore: score,
      residentialStatus: statusFromScore(score, tags),
      distanceMeters: haversine(lat, lng, blat, blng),
    });
  }
  return buildings;
}

/**
 * Keep only buildings that are at least "possible" residential, sorted by
 * confidence then distance.
 */
export function filterResidentialBuildings(
  buildings: OsmBuilding[],
): OsmBuilding[] {
  return buildings
    .filter((b) => b.residentialStatus !== "Unlikely residential")
    .sort(
      (a, b) =>
        b.residentialScore - a.residentialScore ||
        a.distanceMeters - b.distanceMeters,
    );
}

/* ------------------------------------------------------------------ */
/* Deterministic mock helpers                                         */
/* ------------------------------------------------------------------ */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const POSITIVE_REVIEWS = [
  "Quiet building with responsive management and great amenities.",
  "Love the location, walkable to everything and well maintained.",
  "Spacious units and friendly neighbours. Would recommend.",
  "Solid value, clean common areas and good security.",
];
const MIXED_REVIEWS = [
  "Decent place but the elevators can be slow at peak hours.",
  "Nice units, though street noise is noticeable on lower floors.",
  "Good building overall, parking is a bit tight.",
];
const NEGATIVE_REVIEWS = [
  "Strata fees keep rising and repairs take forever.",
  "Thin walls and occasional plumbing issues.",
];

/* ------------------------------------------------------------------ */
/* Google Places (legacy Place Details) — real if key present        */
/* ------------------------------------------------------------------ */

interface GoogleData {
  googlePlaceId: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleReviews: GoogleReview[];
  googleMapsUrl: string | null;
  usedMock: boolean;
}

function mockGoogle(building: OsmBuilding, sort: ReviewSort): GoogleData {
  const seed = hash(building.id + "google");
  // ~30% of buildings have no Google presence
  if (seed % 10 < 3) {
    return {
      googlePlaceId: null,
      googleRating: null,
      googleReviewCount: null,
      googleReviews: [],
      googleMapsUrl: null,
      usedMock: true,
    };
  }
  const rating = Number((3 + (seed % 21) / 10).toFixed(1)); // 3.0 - 5.0
  const count = 5 + (seed % 240);
  const pool =
    rating >= 4.3
      ? POSITIVE_REVIEWS
      : rating >= 3.6
        ? [...POSITIVE_REVIEWS, ...MIXED_REVIEWS]
        : [...MIXED_REVIEWS, ...NEGATIVE_REVIEWS];
  const n = 3 + (seed % 3); // 3-5 reviews
  const reviews: GoogleReview[] = Array.from({ length: n }).map((_, i) => {
    const r = pool[(seed + i) % pool.length];
    return {
      author: `Resident ${String.fromCharCode(65 + ((seed + i) % 26))}.`,
      rating: Math.max(1, Math.min(5, Math.round(rating + (i % 2 === 0 ? 0 : -1)))),
      text: r,
      relativeTime:
        sort === "newest"
          ? `${1 + (i % 4)} week${i ? "s" : ""} ago`
          : `${1 + (i % 11)} month${i ? "s" : ""} ago`,
    };
  });
  if (sort === "newest") reviews.reverse();
  const label = building.name ?? building.address ?? "building";
  return {
    googlePlaceId: `mock_${seed.toString(36)}`,
    googleRating: rating,
    googleReviewCount: count,
    googleReviews: reviews,
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      label,
    )}&query_place_id=mock_${seed.toString(36)}`,
    usedMock: true,
  };
}

export async function fetchGoogleData(
  building: OsmBuilding,
  sort: ReviewSort,
): Promise<GoogleData> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return mockGoogle(building, sort);

  try {
    // 1) Find Place from text (legacy)
    const queryText = [building.name, building.address]
      .filter(Boolean)
      .join(" ");
    const findUrl =
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
      `?input=${encodeURIComponent(queryText)}&inputtype=textquery` +
      `&locationbias=point:${building.lat},${building.lng}` +
      `&fields=place_id&key=${key}`;
    const findRes = await fetch(findUrl);
    const findJson = (await findRes.json()) as {
      candidates?: Array<{ place_id: string }>;
    };
    const placeId = findJson.candidates?.[0]?.place_id;
    if (!placeId) {
      return {
        googlePlaceId: null,
        googleRating: null,
        googleReviewCount: null,
        googleReviews: [],
        googleMapsUrl: null,
        usedMock: false,
      };
    }

    // 2) Place Details (legacy) — supports reviews_sort
    const detUrl =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}&reviews_sort=${sort}` +
      `&fields=name,formatted_address,geometry,rating,user_ratings_total,reviews,url` +
      `&key=${key}`;
    const detRes = await fetch(detUrl);
    const det = (await detRes.json()) as {
      result?: {
        rating?: number;
        user_ratings_total?: number;
        url?: string;
        reviews?: Array<{
          author_name: string;
          rating: number;
          text: string;
          relative_time_description: string;
        }>;
      };
    };
    const r = det.result;
    return {
      googlePlaceId: placeId,
      googleRating: r?.rating ?? null,
      googleReviewCount: r?.user_ratings_total ?? null,
      googleReviews: (r?.reviews ?? []).slice(0, 5).map((rv) => ({
        author: rv.author_name,
        rating: rv.rating,
        text: rv.text,
        relativeTime: rv.relative_time_description,
      })),
      googleMapsUrl: r?.url ?? null,
      usedMock: false,
    };
  } catch {
    // Fall back to mock so the UI stays functional
    return mockGoogle(building, sort);
  }
}

/* ------------------------------------------------------------------ */
/* Reddit mentions — real if credentials present                      */
/* ------------------------------------------------------------------ */

function mockReddit(building: OsmBuilding): {
  mentions: RedditMention[];
  usedMock: boolean;
} {
  const label = building.name ?? building.address;
  if (!label) return { mentions: [], usedMock: true };
  const seed = hash(building.id + "reddit");
  if (seed % 10 < 4) return { mentions: [], usedMock: true }; // ~40% none
  const n = 1 + (seed % 3);
  const mentions: RedditMention[] = Array.from({ length: n }).map((_, i) => {
    const s = (seed + i) % 3;
    const sentiment =
      s === 0 ? "positive" : s === 1 ? "neutral" : "negative";
    return {
      title: `Anyone live at ${label}?`,
      snippet:
        sentiment === "positive"
          ? "Lived here 2 years, management is great and quiet."
          : sentiment === "negative"
            ? "Had issues with strata, would think twice."
            : "It's fine for the price, nothing special.",
      subreddit: ["vancouver", "askvan", "VancouverRealEstate"][i % 3],
      url: "https://www.reddit.com/r/vancouver/",
      sentiment,
      score: 5 + ((seed + i) % 80),
    };
  });
  return { mentions, usedMock: true };
}

export async function fetchRedditMentions(building: OsmBuilding): Promise<{
  mentions: RedditMention[];
  usedMock: boolean;
}> {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  const label = building.name ?? building.address;
  if (!id || !secret || !label) return mockReddit(building);

  try {
    const tokenRes = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: "grant_type=client_credentials",
      },
    );
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return mockReddit(building);

    const searchRes = await fetch(
      `https://oauth.reddit.com/search?limit=5&sort=relevance&q=${encodeURIComponent(
        `"${label}"`,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "User-Agent": USER_AGENT,
        },
      },
    );
    const json = (await searchRes.json()) as {
      data?: {
        children?: Array<{
          data: {
            title: string;
            selftext: string;
            subreddit: string;
            permalink: string;
            score: number;
          };
        }>;
      };
    };
    const mentions: RedditMention[] = (json.data?.children ?? []).map((c) => {
      const text = `${c.data.title} ${c.data.selftext}`.toLowerCase();
      const sentiment = inferSentiment(text);
      return {
        title: c.data.title,
        snippet: c.data.selftext.slice(0, 160) || c.data.title,
        subreddit: c.data.subreddit,
        url: `https://www.reddit.com${c.data.permalink}`,
        sentiment,
        score: c.data.score,
      };
    });
    return { mentions, usedMock: false };
  } catch {
    return mockReddit(building);
  }
}

function inferSentiment(text: string): RedditMention["sentiment"] {
  const pos = ["great", "love", "quiet", "recommend", "clean", "good"];
  const neg = ["avoid", "bad", "noise", "issue", "problem", "terrible", "leak"];
  const p = pos.filter((w) => text.includes(w)).length;
  const n = neg.filter((w) => text.includes(w)).length;
  if (p > n) return "positive";
  if (n > p) return "negative";
  return "neutral";
}

/* ------------------------------------------------------------------ */
/* Review-content summary (text-based, not metadata)                  */
/*                                                                    */
/* Analyses the actual text of Google reviews and Reddit mentions to  */
/* surface recurring resident-facing themes. Structured so a real LLM */
/* summariser can be swapped in later (see summariseWithLlm hook):    */
/* it would receive the same `texts` array and be instructed to       */
/* summarise review *content*, never API result status/metadata.      */
/* ------------------------------------------------------------------ */

type Sentiment = "positive" | "neutral" | "negative";

interface ReviewText {
  text: string;
  sentiment: Sentiment;
}

interface Theme {
  key: string;
  /** Phrasing used when the theme shows up positively */
  positive: string;
  /** Phrasing used when the theme shows up negatively */
  negative: string;
  keywords: string[];
  /** Words that flip the meaning of an otherwise-neutral keyword */
  negativeCues?: string[];
}

const THEMES: Theme[] = [
  {
    key: "location",
    positive: "the convenient location and walkability",
    negative: "the location or surroundings",
    keywords: ["location", "walk", "walkable", "transit", "skytrain", "subway", "convenient", "close to", "downtown", "shops", "restaurants", "central"],
  },
  {
    key: "maintenance",
    positive: "how well the building is maintained",
    negative: "maintenance quality and slow repairs",
    keywords: ["maintenance", "maintained", "repair", "repairs", "upkeep", "fixed", "broken", "run down", "rundown", "plumbing", "leak"],
    negativeCues: ["slow", "forever", "broken", "issue", "issues", "leak", "run down", "rundown", "wait", "never"],
  },
  {
    key: "noise",
    positive: "how quiet the building is",
    negative: "noise levels and thin walls",
    keywords: ["noise", "noisy", "quiet", "loud", "thin wall", "thin walls", "soundproof"],
    negativeCues: ["noise", "noisy", "loud", "thin"],
  },
  {
    key: "management",
    positive: "responsive management and helpful staff",
    negative: "management responsiveness and strata handling",
    keywords: ["management", "manager", "strata", "landlord", "responsive", "staff", "concierge", "board"],
    negativeCues: ["unresponsive", "slow", "rising", "rise", "ignore", "ignored", "forever", "issue", "issues", "twice"],
  },
  {
    key: "amenities",
    positive: "the amenities on offer",
    negative: "limited or poorly kept amenities",
    keywords: ["amenities", "amenity", "gym", "pool", "lounge", "rooftop"],
  },
  {
    key: "elevator",
    positive: "reliable elevators",
    negative: "slow or unreliable elevators",
    keywords: ["elevator", "elevators", "lift"],
    negativeCues: ["slow", "wait", "broken", "out of service", "peak"],
  },
  {
    key: "safety",
    positive: "a sense of safety and good security",
    negative: "safety and security concerns",
    keywords: ["safe", "safety", "security", "secure", "crime", "break-in", "break in", "unsafe"],
    negativeCues: ["unsafe", "crime", "break-in", "break in"],
  },
  {
    key: "cleanliness",
    positive: "clean, well-kept common areas",
    negative: "cleanliness of common areas",
    keywords: ["clean", "cleanliness", "dirty", "filthy", "tidy", "garbage", "trash"],
    negativeCues: ["dirty", "filthy", "garbage", "trash"],
  },
  {
    key: "parking",
    positive: "convenient parking",
    negative: "tight or limited parking",
    keywords: ["parking", "garage", "stall"],
    negativeCues: ["tight", "limited", "no parking", "hard"],
  },
  {
    key: "value",
    positive: "good value for the price",
    negative: "rising fees and value for money",
    keywords: ["value", "price", "fees", "strata fees", "expensive", "affordable", "worth", "rent"],
    negativeCues: ["rising", "rise", "expensive", "high", "keep rising"],
  },
];

/** Collect every usable review text with a coarse sentiment. */
function collectReviewTexts(
  google: GoogleData,
  reddit: RedditMention[],
): ReviewText[] {
  const texts: ReviewText[] = [];
  for (const rv of google.googleReviews) {
    const t = rv.text?.trim();
    if (!t) continue;
    const sentiment: Sentiment =
      rv.rating >= 4 ? "positive" : rv.rating <= 2 ? "negative" : "neutral";
    texts.push({ text: t, sentiment });
  }
  for (const m of reddit) {
    const t = (m.snippet || m.title)?.trim();
    if (!t) continue;
    texts.push({ text: t, sentiment: m.sentiment });
  }
  return texts;
}

/**
 * Produce a 3-line summary of what reviewers actually say. Returns null when
 * there is not enough review text to say anything meaningful.
 */
function summariseReviewContent(texts: ReviewText[]): string[] | null {
  const usable = texts.filter((t) => t.text.replace(/\s+/g, " ").length >= 15);
  if (usable.length < 2) return null;

  const pos: string[] = [];
  const neg: string[] = [];

  for (const theme of THEMES) {
    let posHits = 0;
    let negHits = 0;
    for (const { text, sentiment } of usable) {
      const lower = text.toLowerCase();
      if (!theme.keywords.some((k) => lower.includes(k))) continue;
      const hasNegCue = theme.negativeCues?.some((c) => lower.includes(c));
      if (sentiment === "negative" || hasNegCue) negHits += 1;
      else if (sentiment === "positive") posHits += 1;
      else negHits += 0; // neutral with no cue: ignore for sentiment
    }
    if (posHits === 0 && negHits === 0) continue;
    if (posHits >= negHits && posHits > 0) pos.push(theme.positive);
    else if (negHits > 0) neg.push(theme.negative);
  }

  const lines: string[] = [];
  if (pos.length) {
    lines.push(
      `Residents often highlight ${joinPhrases(pos.slice(0, 2))}.`,
    );
  }
  if (neg.length) {
    lines.push(
      `Some reviews raise concerns about ${joinPhrases(neg.slice(0, 2))}.`,
    );
  }

  // Overall line, grounded only in what the texts support.
  if (pos.length && neg.length) {
    lines.push(
      "Feedback is mixed overall, so check recent reviews before deciding.",
    );
  } else if (pos.length && !neg.length) {
    lines.push("Reviews skew positive, with few recurring complaints.");
  } else if (neg.length && !pos.length) {
    lines.push("Reviews lean negative, so research further before committing.");
  }

  // If no themes matched at all, fall back to sentiment balance from the texts.
  if (lines.length === 0) {
    const p = usable.filter((t) => t.sentiment === "positive").length;
    const n = usable.filter((t) => t.sentiment === "negative").length;
    if (p > n) lines.push("Most reviewers speak positively about living here.");
    else if (n > p)
      lines.push("Several reviewers express dissatisfaction about living here.");
    else lines.push("Reviewer opinions are split between positive and negative.");
  }

  return lines.slice(0, 3);
}

function joinPhrases(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const NOT_ENOUGH_CONTENT =
  "Not enough review content is available to generate a meaningful summary.";

/* ------------------------------------------------------------------ */
/* Summary, score & confidence                                       */
/* ------------------------------------------------------------------ */

export function buildSummary(
  building: OsmBuilding,
  google: GoogleData,
  reddit: RedditMention[],
): {
  summary: string[];
  recommendationScore: number | null;
  confidenceLevel: ConfidenceLevel;
  hasReviews: boolean;
} {
  const hasGoogle = google.googleRating != null;
  const hasReddit = reddit.length > 0;
  const hasReviews = hasGoogle || hasReddit;

  // Confidence from number & quality of sources
  let sourcePoints = 0;
  if (hasGoogle) sourcePoints += (google.googleReviewCount ?? 0) >= 30 ? 2 : 1;
  if (hasReddit) sourcePoints += reddit.length >= 2 ? 2 : 1;
  const confidenceLevel: ConfidenceLevel =
    sourcePoints >= 3 ? "High" : sourcePoints >= 1 ? "Medium" : "Low";

  if (!hasReviews) {
    return {
      summary: [NOT_ENOUGH_CONTENT],
      recommendationScore: null,
      confidenceLevel: "Low",
      hasReviews: false,
    };
  }

  // Transparent score 0-100 (metadata-driven — stays out of the summary text)
  let score = 50;
  if (hasGoogle) {
    score = Math.round(((google.googleRating ?? 3) / 5) * 100);
    const count = google.googleReviewCount ?? 0;
    if (count >= 100) score += 5;
    else if (count < 10) score -= 5;
  }
  const redditPos = reddit.filter((r) => r.sentiment === "positive").length;
  const redditNeg = reddit.filter((r) => r.sentiment === "negative").length;
  score += redditPos * 4 - redditNeg * 6;
  score = Math.max(0, Math.min(100, score));

  // Summary is built ONLY from review text content, never from metadata such
  // as rating, review count, or source availability.
  const texts = collectReviewTexts(google, reddit);
  const summary = summariseReviewContent(texts) ?? [NOT_ENOUGH_CONTENT];

  return {
    summary,
    recommendationScore: score,
    confidenceLevel,
    hasReviews: true,
  };
}


/* ------------------------------------------------------------------ */
/* Full enrichment for one building                                   */
/* ------------------------------------------------------------------ */

export async function enrichBuilding(
  building: OsmBuilding,
  sort: ReviewSort,
): Promise<BuildingResult> {
  const google = await fetchGoogleData(building, sort);
  const reddit = await fetchRedditMentions(building);
  const summary = buildSummary(building, google, reddit.mentions);

  return {
    ...building,
    googlePlaceId: google.googlePlaceId,
    googleRating: google.googleRating,
    googleReviewCount: google.googleReviewCount,
    googleReviews: google.googleReviews,
    googleMapsUrl: google.googleMapsUrl,
    googleReviewSort: sort,
    redditMentions: reddit.mentions,
    summary: summary.summary,
    recommendationScore: summary.recommendationScore,
    confidenceLevel: summary.confidenceLevel,
    hasReviews: summary.hasReviews,
    usedMockData: google.usedMock || reddit.usedMock,
  };
}
