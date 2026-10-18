export type LatLng = {lat: number; lng: number};
export type PlaceSource = "saved" | "directory" | "map" | "shop";
export type Place = {label: string; lat: number; lng: number; source: PlaceSource; id?: string; tags?: Record<string, string>; category?: string; ratingAvg?: number; ratingCount?: number; distanceMeters?: number; distance?: number; declined?: boolean; openNow?: boolean | null};
export type PlaceSearchState = {query: string; results: Place[]; selected: Place | null; locating: boolean};
export type ShopSearchFilters = {minRating?: number; sortBy?: "distance" | "rating"; ticketId?: string};
