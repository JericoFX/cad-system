import {
  Component,
  createEffect,
  createSignal,
  onCleanup,
  splitProps,
  createMemo,
} from 'solid-js';
import * as L from 'leaflet';
import { cn } from '../utils/cn';
import { MapProps, MapMarker, MapRef } from './Map.types';
import {
  GTACRS,
  GTA_MAP_URL,
  GTA_MAP_BOUNDS,
  GTA_MAP_CENTER,
  gtaToLatLng,
} from './map-crs';

export const Map: Component<MapProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'class',
    'center',
    'zoom',
    'height',
    'width',
    'markers',
    'dosMode',
    'scanlines',
    'phosphorColor',
    'filterMode',
    'mapUrl',
    'showControls',
    'onMarkerAdd',
    'onMarkerRemove',
    'onMapClick',
    'mapRef',
  ]);

  let mapContainer: HTMLDivElement | undefined;
  let mapInstance: L.Map | null = null;
  const leafletMarkers: Map<string, L.Marker> = new (globalThis as any).Map();

  const [isReady, setIsReady] = createSignal(false);

  const mapHeight = createMemo(() => local.height || '500px');
  const mapWidth = createMemo(() => local.width || '100%');
  const phosphorClass = createMemo(() => {
    if (!local.dosMode) return '';
    const color = local.phosphorColor || 'amber';
    const mode = local.filterMode || 'phosphor';
    return `tui-map-phosphor-${color} tui-map-filter-${mode}`;
  });

  const createMarkerIcon = (marker: MapMarker): L.DivIcon => {
    const color = marker.color || 'red-168';
    const icon =
      marker.icon ||
      (marker.type === 'unit' ? '👮' : marker.type === 'vehicle' ? '🚓' : '📍');

    return L.divIcon({
      className: `tui-map-marker tui-map-marker-${marker.type}`,
      html: `
        <div class="tui-map-marker-content ${color}">
          <span class="tui-map-marker-icon">${icon}</span>
          ${marker.label ? `<span class="tui-map-marker-label">${marker.label}</span>` : ''}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30],
    });
  };

  const addMarkerToMap = (marker: MapMarker) => {
    if (!mapInstance) return;

    if (leafletMarkers.has(marker.id)) {
      removeMarkerFromMap(marker.id);
    }

    const latLng = gtaToLatLng(marker.position[0], marker.position[1]);
    const leafletMarker = L.marker(latLng, {
      icon: createMarkerIcon(marker),
    }).addTo(mapInstance);

    if (marker.tooltip) {
      leafletMarker.bindTooltip(marker.tooltip, {
        direction: 'top',
        offset: [0, -10],
        className: 'tui-map-tooltip',
      });
    }

    leafletMarker.on('click', () => {
      marker.onClick?.();
    });

    leafletMarker.on('dblclick', (e: L.LeafletMouseEvent) => {
      e.originalEvent.stopPropagation();
      marker.onDblClick?.();
      console.log('DOble click');
    });

    leafletMarker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      marker.onRightClick?.();
    });

    leafletMarkers.set(marker.id, leafletMarker);
    local.onMarkerAdd?.(marker);

    if (marker.autoRemove && marker.autoRemove > 0) {
      setTimeout(() => {
        removeMarkerFromMap(marker.id);
      }, marker.autoRemove);
    }
  };

  const removeMarkerFromMap = (id: string) => {
    const marker = leafletMarkers.get(id);
    if (marker && mapInstance) {
      mapInstance.removeLayer(marker);
      leafletMarkers.delete(id);
      local.onMarkerRemove?.(id);
    }
  };

  createEffect(() => {
    if (!mapContainer || mapInstance) return;

    const center = local.center || GTA_MAP_CENTER;
    const zoom = local.zoom || 4;

    mapInstance = L.map(mapContainer, {
      crs: GTACRS,
      minZoom: 2,
      maxZoom: 6,
      zoom: zoom,
      preferCanvas: true,
      center: center,
      maxBoundsViscosity: 1.0,
      attributionControl: false,
      zoomControl: local.showControls !== false,
    } as L.MapOptions);

    L.imageOverlay(local.mapUrl || GTA_MAP_URL, GTA_MAP_BOUNDS).addTo(
      mapInstance,
    );

    mapInstance.on('click', (e: L.LeafletMouseEvent) => {
      local.onMapClick?.([e.latlng.lng, e.latlng.lat]);
    });

    setIsReady(true);
  });

  createEffect(() => {
    if (!isReady() || !local.markers) return;

    local.markers.forEach((marker) => {
      if (!leafletMarkers.has(marker.id)) {
        addMarkerToMap(marker);
      }
    });

    const currentIds = new Set(local.markers.map((m: MapMarker) => m.id));
    leafletMarkers.forEach((_marker: L.Marker, id: string) => {
      if (!currentIds.has(id)) {
        removeMarkerFromMap(id);
      }
    });
  });

  createEffect(() => {
    if (!mapInstance || !local.center) return;
    const latLng = gtaToLatLng(local.center[0], local.center[1]);
    mapInstance.setView(latLng, local.zoom || mapInstance.getZoom());
  });

  onCleanup(() => {
    leafletMarkers.forEach((marker: L.Marker) => {
      if (mapInstance) {
        mapInstance.removeLayer(marker);
      }
    });
    leafletMarkers.clear();

    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  const mapRef: MapRef = {
    addMarker: addMarkerToMap,
    removeMarker: removeMarkerFromMap,
    setCenter: (coords) => {
      if (mapInstance) {
        mapInstance.setView(gtaToLatLng(coords[0], coords[1]));
      }
    },
    setWaypoint: (coords) => {
      if (typeof window !== 'undefined' && (window as any).invokeNative) {
        (window as any).invokeNative('setWaypoint', coords[0], coords[1]);
      }
    },
    getMapInstance: () => mapInstance,
  };

  createEffect(() => {
    if (isReady() && local.mapRef) {
      local.mapRef(mapRef);
    }
  });

  return (
    <div
      class={cn(
        'tui-map-container',
        local.dosMode && 'tui-map-dos-mode',
        local.scanlines && 'tui-map-scanlines',
        phosphorClass(),
        local.class,
      )}
      style={{
        height: mapHeight(),
        width: mapWidth(),
        position: 'relative',
      }}
      {...rest}
    >
      <div
        ref={mapContainer}
        class='tui-map'
        style={{ height: '100%', width: '100%' }}
      />
      {local.dosMode && (
        <div class='tui-map-overlay'>
          <div class='tui-map-scanlines-overlay' />
          <div class='tui-map-curvature' />
        </div>
      )}
    </div>
  );
};

export default Map;
