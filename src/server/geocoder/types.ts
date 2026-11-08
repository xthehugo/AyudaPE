/**
 * @file src/server/geocoder/types.ts
 * @description Contratos e interfaces intercambiables para geocodificación y búsqueda de lugares.
 */

export interface GeocodedPlace {
  place_id: string;
  display_name: string;
  name: string;
  lat: number;
  lng: number;
  category?: string;
  type?: string;
  is_residential?: boolean;
  attribution: string;
}

export interface GeocoderSearchOptions {
  limit?: number;
  bounds?: {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
  };
  proximityLat?: number;
  proximityLng?: number;
}

export interface GeocoderProvider {
  search(query: string, options?: GeocoderSearchOptions): Promise<GeocodedPlace[]>;
  reverse(lat: number, lng: number): Promise<GeocodedPlace | null>;
}
