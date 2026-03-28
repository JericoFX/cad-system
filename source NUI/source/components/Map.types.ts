import * as L from 'leaflet';
import type { JSX } from 'solid-js';

export type MarkerType = 'dispatch' | 'unit' | 'vehicle' | 'custom';

export interface MapMarker {
  id: string;
  position: [number, number];
  type: MarkerType;
  icon?: string;
  label?: string;
  tooltip?: string;
  color?: string;
  onClick?: () => void;
  onDblClick?: () => void;
  onRightClick?: () => void;
  autoRemove?: number;
}

export interface MapProps extends JSX.HTMLAttributes<HTMLDivElement> {
  center?: [number, number];
  zoom?: number;
  height?: string;
  width?: string;
  markers?: MapMarker[];
  dosMode?: boolean;
  scanlines?: boolean;
  phosphorColor?: 'green' | 'amber' | 'white';
  filterMode?: 'phosphor' | 'soft' | 'none';
  mapUrl?: string;
  showControls?: boolean;
  onMarkerAdd?: (marker: MapMarker) => void;
  onMarkerRemove?: (id: string) => void;
  onMapClick?: (coords: [number, number]) => void;
  mapRef?: (ref: MapRef) => void;
}

export interface MapRef {
  addMarker: (marker: MapMarker) => void;
  removeMarker: (id: string) => void;
  setCenter: (coords: [number, number]) => void;
  setWaypoint: (coords: [number, number]) => void;
  getMapInstance: () => L.Map | null;
}
