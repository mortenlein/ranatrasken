'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { destinations, Destination, difficultyMeta } from '@/data/destinations';
import routesData from '@/data/routes.json';
import { useLanguage } from '@/lib/i18n';

// Cast the imported JSON to a Record<string, GeoJSON.Feature>
const curatedRoutes = routesData as Record<string, GeoJSON.Feature>;

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY || 'get_your_free_key_at_maptiler_com';

// Define the bounding box for the "Rana Square" - This is the geographical extent of our active map content
const RANA_BOX_GEOGRAPHIC = {
  minLng: 13.2, maxLng: 15.5, // Approx bounding box for Rana
  minLat: 66.0, maxLat: 66.7
};

// Helper to generate the custom MapLibre style with all sources and layers
const generateCustomStyle = (baseMapStyleId: string, curatedRoutes: Record<string, GeoJSON.Feature>, destinations: Destination[]) => {
  const B = RANA_BOX_GEOGRAPHIC;

  // Define GeoJSON for the Rana polygon outline
  const ranaPolygonGeoJSON = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [B.minLng, B.minLat],
        [B.maxLng, B.minLat],
        [B.maxLng, B.maxLat],
        [B.minLng, B.maxLat],
        [B.minLng, B.minLat]
      ]]
    }
  };

  // World Mask — covers the whole earth EXCEPT the Rana box.
  // This acts as the dark void outside the map.
  const worldMaskGeoJSON = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        // Outer ring: World bounds
        [
          [-180, -90],
          [180, -90],
          [180, 90],
          [-180, 90],
          [-180, -90]
        ],
        // Inner ring (hole): Rana Box (opposite winding)
        [
          [B.minLng, B.minLat],
          [B.minLng, B.maxLat],
          [B.maxLng, B.maxLat],
          [B.maxLng, B.minLat],
          [B.minLng, B.minLat]
        ]
      ]
    }
  };

  // Get all routes for initial setup
  const allRoutesFeatures = destinations
    .map(d => {
      let geometry: GeoJSON.Geometry | null = null;
      if (curatedRoutes[d.id.toString()]) {
        geometry = curatedRoutes[d.id.toString()].geometry;
      } else if (d.parking) {
        geometry = {
          type: 'LineString',
          coordinates: [
            [d.parking!.lng, d.parking!.lat],
            [d.lng, d.lat]
          ]
        };
      }

      if (geometry) {
        return {
          type: 'Feature',
          properties: { id: d.id },
          geometry
        };
      }
      return null;
    })
    .filter(f => f !== null);

  return {
    version: 8,
    name: `Rana Custom Style (${baseMapStyleId})`,
    metadata: {
      'maputnik:renderer': 'mbgljs'
    },
    // Define all sources, with explicit bounds where needed
    sources: {
      'maptiler-raster': {
        type: 'raster',
        tiles: [`https://api.maptiler.com/maps/${baseMapStyleId}/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`],
        tileSize: 256,
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
        maxzoom: 18,
        minzoom: 0,
      },
      'terrain-rgb': {
        type: 'raster-dem',
        url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
        maxzoom: 15,
        minzoom: 0,
      },
      'dnt-paths': {
        type: 'vector',
        tiles: ['https://cdn.dnt.org/prod/ut-no/map/tiles/merged/v5/{z}/{x}/{y}.pbf'],
        minzoom: 4,
        maxzoom: 12, // DNT tiles only exist up to z=12
        bounds: [RANA_BOX_GEOGRAPHIC.minLng, RANA_BOX_GEOGRAPHIC.minLat, RANA_BOX_GEOGRAPHIC.maxLng, RANA_BOX_GEOGRAPHIC.maxLat],
      },
      'rana-square-polygon': { type: 'geojson', data: ranaPolygonGeoJSON },
      'world-mask': { type: 'geojson', data: worldMaskGeoJSON },
      'all-routes': { type: 'geojson', data: { type: 'FeatureCollection', features: allRoutesFeatures } },
      'selected-route': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } },
      'admin-route': { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: [] } } },
    },
    layers: [
      // 1. Background — this colors the "cliff" or sides of the cake slice!
      // Since the terrain drops to 0 at the bounds, the vertical drop shows the background.
      {
        id: 'map-background-earth',
        type: 'background',
        paint: { 'background-color': '#3e2723' } // Deep earth brown
      },

      // 2. Void Mask — covers everything outside the map at sea level.
      {
        id: 'world-void-mask',
        type: 'fill',
        source: 'world-mask',
        paint: {
          'fill-color': '#1a2332', // Dark space/void
          'fill-opacity': 1
        }
      },

      // 3. Terrain boundary outline — crisp edge at the top of the slab
      {
        id: 'cake-outline',
        type: 'line',
        source: 'rana-square-polygon',
        paint: {
          'line-color': '#3e2723',
          'line-width': 3
        }
      },

      // 3. Main MapTiler Raster Layer - sits on top of the 3D cake
      {
        id: 'maptiler-raster-layer',
        type: 'raster',
        source: 'maptiler-raster',
        paint: { 'raster-fade-duration': 100 }
      },
      // 4. DNT Official Footpaths
      {
        id: 'dnt-paths-glow',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 12, // Only show when zoomed in
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff0000', 'line-width': 4, 'line-opacity': 0.2 }
      },
      {
        id: 'dnt-paths-line',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 12,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#e31d1d', 'line-width': 2.5, 'line-dasharray': [1.5, 0.5] }
      },
      {
        id: 'dnt-paths-hit',
        type: 'line',
        source: 'dnt-paths',
        'source-layer': 'foot_routes',
        minzoom: 11, // Active slightly earlier for admin selection
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': 'transparent', 'line-width': 20, 'line-opacity': 0 }
      },
      // 5. Our GeoJSON layers for routes (all, selected, admin)
      {
        id: 'all-routes-line',
        type: 'line',
        source: 'all-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#888', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.5 }
      },
      {
        id: 'selected-route-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: { 'line-color': '#007bff', 'line-width': 5, 'line-opacity': 0.8 }
      },
      {
        id: 'admin-route-line',
        type: 'line',
        source: 'admin-route',
        layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
        paint: { 'line-color': '#ffeb3b', 'line-width': 6, 'line-opacity': 0.9 }
      },
    ]
  };
};

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
      style: generateCustomStyle(mapStyle, curatedRoutes, destinations) as maplibregl.StyleSpecification,
      center: [14.4, 66.32],
      zoom: 8.8,
      pitch: 60,
      bearing: -25,
      maxPitch: 85,
      // No maxBounds — camera moves freely around the diorama
    });

    mapInstance.on('load', () => {
      // Enable 3D terrain
      mapInstance.setTerrain({ source: 'terrain-rgb', exaggeration: 1.5 });

      setMapLoaded(true);
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
      map.current.setStyle(generateCustomStyle(mapStyle, curatedRoutes, destinations) as maplibregl.StyleSpecification);
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
  }, [adminSelectedSegments, adminMode, mapLoaded]); // Add mapLoaded to dependencies

  // Update route visibility when selectedDestination changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return; // Depend on mapLoaded

    const mapInstance = map.current;
    
    // Highlight the selected route if it exists
    if (selectedDestination) {
      const source = mapInstance.getSource('selected-route') as maplibregl.GeoJSONSource;
      if (source) {
        let geometry: GeoJSON.Geometry = { type: 'LineString', coordinates: [] };

        if (curatedRoutes[selectedDestination.id.toString()]) {
          geometry = curatedRoutes[selectedDestination.id.toString()].geometry;
        } else if (selectedDestination.parking) {
          geometry = {
            type: 'LineString',
            coordinates: [
              [selectedDestination.parking.lng, selectedDestination.parking.lat],
              [selectedDestination.lng, selectedDestination.lat]
            ]
          };
        }

        if ('coordinates' in geometry && geometry.coordinates.length > 0) {
          source.setData({
            type: 'Feature',
            properties: {},
            geometry
          });
          mapInstance.setLayoutProperty('selected-route-line', 'visibility', 'visible');
        } else {
          mapInstance.setLayoutProperty('selected-route-line', 'visibility', 'none');
        }
      }
    } else {
      const source = mapInstance.getSource('selected-route') as maplibregl.GeoJSONSource;
      if (source) {
        mapInstance.setLayoutProperty('selected-route-line', 'visibility', 'none');
      }
    }
  }, [selectedDestination, mapLoaded]); // Add mapLoaded to dependencies

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
