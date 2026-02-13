import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export const GTACRS: L.CRS = L.extend({}, L.CRS.Simple, {
  projection: L.Projection.LonLat,
  scale: function(zoom: number) {
    return Math.pow(2, zoom);
  },
  zoom: function(sc: number) {
    return Math.log(sc) / 0.6931471805599453;
  },
  distance: function(pos1: L.LatLng, pos2: L.LatLng) {
    const x_difference = pos2.lng - pos1.lng;
    const y_difference = pos2.lat - pos1.lat;
    return Math.sqrt(x_difference * x_difference + y_difference * y_difference);
  },
  transformation: new (L.Transformation as any)(0.02072, 117.3, -0.0205, 172.8),
  infinite: false
});

export function gtaToLatLng(x: number, y: number): L.LatLng {
  return new L.LatLng(y, x);
}

export function latLngToGta(latLng: L.LatLng): { x: number; y: number } {
  return {
    x: latLng.lng,
    y: latLng.lat
  };
}

export const GTA_MAP_URL = 'https://files.fivemerr.com/images/60c68fc9-1a7f-4e5a-800a-f760a74186ca.jpeg';

export const GTA_MAP_BOUNDS: L.LatLngBoundsExpression = [
  [-4000, -4000], // Southwest
  [4000, 4000]    // Northeast
];

export const GTA_MAP_CENTER: L.LatLngExpression = [0, -1024];
