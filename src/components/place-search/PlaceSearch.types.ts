export type LatLng = {lat: number; lng: number};
export type PlaceSource = "saved" | "directory" | "map";
export type Place = {label: string; lat: number; lng: number; source: PlaceSource; id?: string; tags?: Record<string, string>; category?: string};
export type PlaceSearchState = {query: string; results: Place[]; selected: Place | null; locating: boolean};
