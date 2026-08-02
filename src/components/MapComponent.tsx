'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { destinations, Destination, difficultyMeta } from '@/data/destinations';
import { generateCustomStyle, routeGeometryFor, INITIAL_VIEW } from '@/lib/mapStyle';
import { useLanguage } from '@/lib/i18n';

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_free_key_at_maptiler_com';

// DNT trail tiles must come from our own origin — cdn.dnt.org's CORS whitelist
// only covers ut.no/localhost (TASK.md id 27). Absolute URL because MapLibre
// resolves tile templates outside the document's base. Only called from
// effects, where window is available.
const dntProxyTilesUrl = () => `${window.location.origin}/api/dnt-tiles/{z}/{x}/{y}`;

export interface MapRef {
  flyTo: (dest: Destination) => void;
}

interface MapComponentProps {
  selectedDestination?: Destination | null;
  mapStyle?: string;
  adminMode?: boolean;
  onRouteSegmentSelect?: (segments: number[][][]) => void;
  adminSelectedSegments?: number[][][]; // Array of line strings
}

const MapComponent = forwardRef<MapRef, MapComponentProps>((props, ref) => {
  const { selectedDestination, mapStyle = 'outdoor-v2', adminMode = false, onRouteSegmentSelect, adminSelectedSegments = [] } = props;
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const { t, language } = useLanguage();
  const currentStyleRef = useRef(mapStyle);
  const [mapLoaded, setMapLoaded] = useState(false); // New state to track map readiness
  // Bumped every time a style finishes loading (including after setStyle),
  // so effects re-apply runtime state the new style starts without.
  const [styleEpoch, setStyleEpoch] = useState(0);

  const adminModeRef = useRef(adminMode);
  const onRouteSegmentSelectRef = useRef(onRouteSegmentSelect);

  useEffect(() => {
    adminModeRef.current = adminMode;
    onRouteSegmentSelectRef.current = onRouteSegmentSelect;
  }, [adminMode, onRouteSegmentSelect]);

  useImperativeHandle(ref, () => ({
    flyTo: (dest: Destination) => {
      if (!map.current) return;
      map.current.flyTo({
        center: [dest.lng, dest.lat],
        zoom: 14,
        pitch: 60,
        bearing: -20,
        essential: true,
        speed: 1.2
      });
    }
  }));

  // CRITICAL: Initialize the map instance
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: generateCustomStyle(mapStyle, MAPTILER_KEY, dntProxyTilesUrl()) as maplibregl.StyleSpecification,
      ...INITIAL_VIEW,
      // No maxBounds — camera moves freely around the diorama
    });

    mapInstance.on('load', () => {
      setMapLoaded(true);
    });

    // Fires for the initial style and again after every setStyle.
    mapInstance.on('style.load', () => {
      setStyleEpoch(epoch => epoch + 1);
    });

    // Admin mode: click DNT trails to select segments
    mapInstance.on('click', 'dnt-paths-hit', (e) => {
      if (!adminModeRef.current || !onRouteSegmentSelectRef.current) return;
      const features = mapInstance.queryRenderedFeatures(e.point, { layers: ['dnt-paths-hit'] });
      if (features.length > 0) {
        const segments = features
          .filter(f => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
          .map(f => {
            if (f.geometry.type === 'MultiLineString') {
              return (f.geometry as GeoJSON.MultiLineString).coordinates;
            }
            return [(f.geometry as GeoJSON.LineString).coordinates];
          })
          .flat();
        if (segments.length > 0) {
          onRouteSegmentSelectRef.current(segments);
        }
      }
    });

    // Change cursor on DNT trail hover in admin mode
    mapInstance.on('mouseenter', 'dnt-paths-hit', () => {
      if (adminModeRef.current) mapInstance.getCanvas().style.cursor = 'crosshair';
    });
    mapInstance.on('mouseleave', 'dnt-paths-hit', () => {
      mapInstance.getCanvas().style.cursor = '';
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
      map.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle map style changes
  useEffect(() => {
    if (!map.current) return;

    if (currentStyleRef.current !== mapStyle) {
      currentStyleRef.current = mapStyle;
      map.current.setStyle(generateCustomStyle(mapStyle, MAPTILER_KEY, dntProxyTilesUrl()) as maplibregl.StyleSpecification);
    }
  }, [mapStyle]);

  // Update admin selected segments layer
  useEffect(() => {
    if (!map.current || !mapLoaded) return; // Depend on mapLoaded
    const mapInstance = map.current;

    // Visually thicken paths in admin mode
    if (mapInstance.getLayer('dnt-paths-line')) {
      mapInstance.setPaintProperty('dnt-paths-line', 'line-width', adminMode ? 6 : 2.5);
      mapInstance.setPaintProperty('dnt-paths-line', 'line-color', adminMode ? '#ff00ff' : '#e31d1d');
    }

    const source = mapInstance.getSource('admin-route') as maplibregl.GeoJSONSource;
    if (source && adminMode) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'MultiLineString',
          coordinates: adminSelectedSegments
        }
      });
      mapInstance.setLayoutProperty('admin-route-line', 'visibility', 'visible');
    } else if (source) {
      mapInstance.setLayoutProperty('admin-route-line', 'visibility', 'none');
    }
  }, [adminSelectedSegments, adminMode, mapLoaded, styleEpoch]); // styleEpoch re-applies after setStyle

  // Update route visibility when selectedDestination changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return; // Depend on mapLoaded

    const mapInstance = map.current;

    // Highlight the selected route if it exists
    const source = mapInstance.getSource('selected-route') as maplibregl.GeoJSONSource;
    if (!source) return;

    const geometry = selectedDestination ? routeGeometryFor(selectedDestination) : null;
    if (geometry) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry
      });
      mapInstance.setLayoutProperty('selected-route-line', 'visibility', 'visible');
    } else {
      mapInstance.setLayoutProperty('selected-route-line', 'visibility', 'none');
    }
  }, [selectedDestination, mapLoaded, styleEpoch]); // styleEpoch re-applies after setStyle

  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return; // Depend on mapLoaded
    const mapInstance = map.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    destinations.forEach((dest) => {
      const meta = difficultyMeta[dest.difficulty];

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
          <div style="color: #333; font-family: sans-serif; padding: 5px; max-width: 250px;">
            <h3 style="margin: 0; font-size: 16px;">${dest.name}</h3>
            <div style="margin: 8px 0; padding: 4px 8px; background: ${meta.color}; color: #fff; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block;">
              ${t(meta.label)}
            </div>
            <p style="margin: 4px 0; font-size: 13px;">Elevation: <strong>${dest.elevation} moh</strong></p>

            <div style="margin: 10px 0; font-size: 12px; border-top: 1px solid #eee; padding-top: 8px;">
              <strong>${language === 'nb' ? 'Om turen:' : 'About:'}</strong>
              <p style="margin: 4px 0; color: #555;">${t(dest.description)}</p>
            </div>

            <div style="margin: 10px 0; font-size: 12px;">
              <strong>${language === 'nb' ? 'Adkomst:' : 'Access:'}</strong>
              <p style="margin: 4px 0; color: #555;">${t(dest.howToGetThere)}</p>
            </div>

            <p style="margin: 8px 0 0 0; font-size: 11px; font-style: italic; color: #777;">${t(meta.suitability)}</p>
            ${dest.parking ? `<p style="margin-top: 10px; font-size: 12px; border-top: 1px solid #eee; padding-top: 8px; color: #007bff;">🅿️ Start: ${dest.parking.name}</p>` : ''}
          </div>
      `);

      const marker = new maplibregl.Marker({ color: meta.color })
        .setLngLat([dest.lng, dest.lat])
        .setPopup(popup)
        .addTo(mapInstance);

      markersRef.current.push(marker);

      // Parking marker if available
      if (dest.parking) {
        const el = document.createElement('div');
        el.className = 'parking-marker';
        el.innerHTML = '🅿️';
        el.style.fontSize = '20px';
        el.style.cursor = 'pointer';

        const parkingMarker = new maplibregl.Marker(el)
          .setLngLat([dest.parking.lng, dest.parking.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(`
              <div style="color: #333; font-family: sans-serif; padding: 5px;">
                <h3 style="margin: 0; font-size: 14px;">${language === 'nb' ? 'Parkering' : 'Parking'}: ${dest.parking.name}</h3>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${language === 'nb' ? 'Startpunkt for' : 'Starting point for'} ${dest.name}</p>
              </div>
            `)
          )
          .addTo(mapInstance);

        markersRef.current.push(parkingMarker);
      }
    });

    // Cleanup function strictly for the unmount of the *component*, handled by the empty dependency array
    return () => {
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];
    };

  }, [language, t, mapLoaded]); // Add mapLoaded to dependencies

  return (
    <div style={{ width: '100%', height: '100vh' }} ref={mapContainer} />
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent;
