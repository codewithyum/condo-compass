export type ReviewSort = "most_relevant" | "newest";

export type ResidentialStatus =
  | "Likely residential"
  | "Possible residential building"
  | "Unlikely residential";

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface RedditMention {
  title: string;
  snippet: string;
  subreddit: string;
  url: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
}

export interface OsmTags {
  [key: string]: string | undefined;
}

export interface OsmBuilding {
  id: string;
  osmId: string;
  name: string | null;
  address: string | null;
  lat: number;
  lng: number;
  tags: OsmTags;
  residentialScore: number;
  residentialStatus: ResidentialStatus;
  distanceMeters: number;
}

export interface BuildingResult extends OsmBuilding {
  googlePlaceId: string | null;
  googleRating: number | null;
  googleReviewCount: number | null;
  googleReviews: GoogleReview[];
  googleMapsUrl: string | null;
  googleReviewSort: ReviewSort;
  redditMentions: RedditMention[];
  summary: string[];
  recommendationScore: number | null;
  confidenceLevel: ConfidenceLevel;
  hasReviews: boolean;
  usedMockData: boolean;
}

export type ListSortKey =
  | "recommendation"
  | "rating"
  | "reviewCount"
  | "distance"
  | "confidence";
