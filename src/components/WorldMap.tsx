import { useState, useEffect, useMemo, useRef } from 'react';
import type { CuisineItem } from '../utils/cuisines';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Sphere,
  Graticule,
} from 'react-simple-maps';
import * as topojson from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { geoCentroid } from 'd3-geo';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// World-atlas country name → cuisine slug (leaf or region)
const WORLD_ATLAS_COUNTRY_TO_SLUG: Record<string, string> = {
  // Northern Europe
  'Norway': 'norwegian',
  'Sweden': 'northern-europe',
  'Denmark': 'northern-europe',
  'Finland': 'northern-europe',
  'Iceland': 'northern-europe',

  // Central Europe
  'Germany': 'central-europe',
  'Austria': 'central-europe',
  'Switzerland': 'central-europe',
  'Hungary': 'hungarian',
  'Czech Republic': 'central-europe',
  'Slovakia': 'central-europe',
  'Poland': 'central-europe',

  // Mediterranean
  'Italy': 'italian',
  'Spain': 'spanish',
  'France': 'french',
  'Greece': 'greek',
  'Portugal': 'mediterranean',
  'Malta': 'mediterranean',
  'Cyprus': 'mediterranean',

  // Balkan
  'Croatia': 'balkan',
  'Serbia': 'balkan',
  'Bosnia and Herzegovina': 'balkan',
  'Montenegro': 'balkan',
  'Albania': 'balkan',
  'North Macedonia': 'balkan',
  'Slovenia': 'balkan',
  'Bulgaria': 'balkan',
  'Romania': 'balkan',

  // Eastern Europe
  'Ukraine': 'eastern-europe',
  'Belarus': 'eastern-europe',
  'Russia': 'eastern-europe',
  'Moldova': 'eastern-europe',
  'Lithuania': 'eastern-europe',
  'Latvia': 'eastern-europe',
  'Estonia': 'eastern-europe',

  // Middle East
  'Lebanon': 'middle-east',
  'Turkey': 'middle-east',
  'Syria': 'middle-east',
  'Jordan': 'middle-east',
  'Israel': 'middle-east',
  'Palestine': 'middle-east',
  'Iran': 'middle-east',
  'Iraq': 'middle-east',
  'Saudi Arabia': 'middle-east',
  'Yemen': 'middle-east',
  'Kuwait': 'middle-east',
  'Qatar': 'middle-east',
  'Bahrain': 'middle-east',
  'United Arab Emirates': 'middle-east',
  'Oman': 'middle-east',

  // North Africa
  'Egypt': 'north-africa',
  'Libya': 'north-africa',
  'Tunisia': 'north-africa',
  'Algeria': 'north-africa',
  'Morocco': 'north-africa',
  'Sudan': 'north-africa',

  // Sub-Saharan Africa
  'Nigeria': 'sub-saharan-africa',
  'Ethiopia': 'sub-saharan-africa',
  'Kenya': 'sub-saharan-africa',
  'South Africa': 'sub-saharan-africa',
  'Ghana': 'sub-saharan-africa',
  'Tanzania': 'sub-saharan-africa',

  // South Asia
  'India': 'south-asia',
  'Pakistan': 'south-asia',
  'Bangladesh': 'south-asia',
  'Sri Lanka': 'south-asia',
  'Nepal': 'south-asia',

  // East Asia
  'China': 'chinese',
  'Japan': 'japanese',
  'South Korea': 'east-asia',
  'North Korea': 'east-asia',
  'Mongolia': 'east-asia',
  'Taiwan': 'taiwanese',

  // Southeast Asia
  'Thailand': 'southeast-asia',
  'Vietnam': 'southeast-asia',
  'Indonesia': 'southeast-asia',
  'Malaysia': 'southeast-asia',
  'Philippines': 'southeast-asia',
  'Myanmar': 'southeast-asia',
  'Cambodia': 'southeast-asia',
  'Laos': 'southeast-asia',
  'Singapore': 'southeast-asia',

  // North America
  'United States of America': 'north-america',
  'Canada': 'north-america',

  // Central America
  'Mexico': 'mexican',
  'Guatemala': 'central-america',
  'Honduras': 'central-america',
  'El Salvador': 'central-america',
  'Nicaragua': 'central-america',
  'Costa Rica': 'central-america',
  'Panama': 'central-america',
  'Cuba': 'central-america',

  // South America
  'Brazil': 'south-america',
  'Argentina': 'argentinian',
  'Colombia': 'south-america',
  'Chile': 'south-america',
  'Peru': 'south-america',
  'Venezuela': 'south-america',
  'Ecuador': 'south-america',
  'Bolivia': 'south-america',
  'Paraguay': 'south-america',
  'Uruguay': 'south-america',

  // Oceania
  'Australia': 'oceania',
  'New Zealand': 'oceania',
};

interface Props {
  availableCuisines: string[];
  cuisinesData: CuisineItem[];
  basePath: string;
}

interface Position {
  zoom: number;
  coordinates: [number, number];
}

export function WorldMap({ availableCuisines, cuisinesData, basePath }: Props) {
  // Mode: country or region (region is default)
  const [mode, setMode] = useState<'country' | 'region'>('region');
  const [position, setPosition] = useState<Position>({ zoom: 1, coordinates: [15, 25] });
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);

  // Keep a ref in sync so animateFlight can read latest position without stale closure
  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; }, [position]);

  const availableSet = useMemo(() => new Set(availableCuisines), [availableCuisines]);

  // Fetch topology once on mount (needed for region merge)
  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then(setTopology);
  }, []);

  // Compute per-region merged shapes from topology
  const regionShapes = useMemo(() => {
    if (!topology || mode !== 'region') return null;

    const countries = (topojson.feature(topology, (topology as any).objects.countries) as any);

    // Group feature *geometries* (from the topology objects array) by region slug
    const regionMap = new Map<string, any[]>();

    countries.features.forEach((feature: any) => {
      const countryName = feature.properties?.name;
      const leafSlug = WORLD_ATLAS_COUNTRY_TO_SLUG[countryName];
      if (!leafSlug) return;

      // Resolve to region: if leaf has a parent cuisine, use parent; else leaf IS the region
      const entry = cuisinesData.find((c) => c.slug === leafSlug);
      const regionSlug = entry?.parent ?? leafSlug;

      if (!regionMap.has(regionSlug)) regionMap.set(regionSlug, []);
      regionMap.get(regionSlug)!.push(feature.id);
    });

    // Merge arcs per region using topology geometry objects
    const result: Array<{
      slug: string;
      label: string;
      shape: any;
      hasRecipes: boolean;
      centroid: [number, number];
    }> = [];

    regionMap.forEach((featureIds, regionSlug) => {
      const regionEntry = cuisinesData.find((c) => c.slug === regionSlug);
      const idSet = new Set(featureIds.map(String));

      // Filter the original topology geometry objects by matching id
      const countryGeoms = ((topology as any).objects.countries as any).geometries.filter(
        (g: any) => idSet.has(String(g.id))
      );

      if (countryGeoms.length === 0) return;

      const merged = topojson.mergeArcs(topology as any, countryGeoms);

      // Check if this region has recipes (direct slug or any child leaf)
      const hasRecipes = availableCuisines.some((s) => {
        if (s === regionSlug) return true;
        const e = cuisinesData.find((c) => c.slug === s);
        return e?.parent === regionSlug;
      });

      // Geographic centroid for flight animation
      const centroid = geoCentroid({ type: 'Feature', geometry: merged, properties: {} }) as [number, number];

      result.push({
        slug: regionSlug,
        label: regionEntry?.label ?? regionSlug,
        shape: merged,
        hasRecipes,
        centroid,
      });
    });

    return result;
  }, [topology, mode, cuisinesData, availableCuisines]);

  // Build GeoJSON FeatureCollection for region mode
  const regionGeoJSON = useMemo(() => {
    if (!regionShapes) return null;
    return {
      type: 'FeatureCollection' as const,
      features: regionShapes.map((r) => ({
        type: 'Feature' as const,
        properties: { slug: r.slug, label: r.label, hasRecipes: r.hasRecipes, centroid: r.centroid },
        geometry: r.shape,
      })),
    };
  }, [regionShapes]);

  // Animate the ZoomableGroup camera toward a target, then call onDone
  function animateFlight(
    targetCoords: [number, number],
    targetZoom: number,
    duration: number,
    onUpdate: (coords: [number, number], zoom: number) => void,
    onDone: () => void
  ) {
    const start = performance.now();
    const fromCoords = positionRef.current.coordinates;
    const fromZoom = positionRef.current.zoom;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const coords: [number, number] = [
        fromCoords[0] + (targetCoords[0] - fromCoords[0]) * eased,
        fromCoords[1] + (targetCoords[1] - fromCoords[1]) * eased,
      ];
      const zoom = fromZoom + (targetZoom - fromZoom) * eased;
      onUpdate(coords, zoom);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        onDone();
      }
    }
    requestAnimationFrame(tick);
  }

  // Navigate to a cuisine page, with a camera flight animation first
  function handleNavigate(slug: string, centroid: [number, number]) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = `${basePath}/cuisines/${slug}`;

    if (prefersReducedMotion) {
      window.location.href = target;
      return;
    }

    animateFlight(
      centroid,
      3.5,
      500,
      (coords, zoom) => setPosition({ coordinates: coords, zoom }),
      () => { window.location.href = target; }
    );
  }

  // Fill for a given slug/hasRecipes flag
  const getFill = (slug: string | undefined, hasRecipes: boolean, isHovered: boolean) => {
    if (isHovered) return 'var(--color-olive)';
    if (!slug) return 'var(--color-map-land)';
    if (hasRecipes) return 'var(--color-map-active)';
    return 'var(--color-map-land)';
  };

  // Shared Geography style builder
  const geoStyle = (fill: string, clickable: boolean) => ({
    default: {
      fill,
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
      outline: 'none',
      transition: 'fill 0.2s ease',
      cursor: clickable ? 'pointer' : 'default',
    },
    hover: {
      fill: clickable ? 'var(--color-olive)' : 'var(--color-map-land)',
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
      outline: 'none',
      cursor: clickable ? 'pointer' : 'default',
    },
    pressed: {
      fill: clickable ? 'var(--color-oxblood)' : 'var(--color-map-land)',
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
      outline: 'none',
    },
  });

  return (
    <div
      className="worldmap-container"
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(520px, 86vh, 1040px)',
        backgroundColor: 'var(--color-paper)',
      }}
    >
      {/* Mobile override via inline media query workaround: handled by CSS class below */}
      <style>{`
        @media (max-width: 767px) {
          .worldmap-container { height: 60vh !important; }
        }
      `}</style>

      {/* Map canvas */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 170, center: [15, 25] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          filterZoomEvent={(evt: any) => {
            // Plain wheel scroll (no modifier): pass through to page
            if (evt.type === 'wheel' && !evt.ctrlKey && !evt.metaKey) return false;
            return true;
          }}
          minZoom={1}
          maxZoom={8}
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={({ zoom, coordinates }: { zoom: number; coordinates: [number, number] }) => {
            setPosition({ zoom, coordinates });
          }}
        >
          {/* Atlas texture */}
          <Sphere id="sphere" fill="none" stroke="var(--color-hairline)" strokeWidth={0.3} />
          <Graticule stroke="var(--color-hairline)" strokeWidth={0.15} />

          {/* Country mode */}
          {mode === 'country' && (
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = geo.properties?.name;
                  const slug = WORLD_ATLAS_COUNTRY_TO_SLUG[name];
                  const hasRecipes = slug ? availableSet.has(slug) : false;
                  const isHovered = hoveredSlug === name;
                  const fill = getFill(slug, hasRecipes, isHovered);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => {
                        if (!slug) return;
                        // Resolve display label from cuisinesData
                        const entry = cuisinesData.find((c) => c.slug === slug);
                        setHoveredSlug(name);
                        setHoveredLabel(entry?.label ?? slug);
                      }}
                      onMouseLeave={() => {
                        setHoveredSlug(null);
                        setHoveredLabel(null);
                      }}
                      onClick={() => {
                        if (!slug) return;
                        const centroid = geoCentroid(geo) as [number, number];
                        handleNavigate(slug, centroid);
                      }}
                      style={geoStyle(fill, !!slug)}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Region mode */}
          {mode === 'region' && regionGeoJSON && (
            <Geographies geography={regionGeoJSON}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const { slug, label, hasRecipes, centroid } = geo.properties as {
                    slug: string;
                    label: string;
                    hasRecipes: boolean;
                    centroid: [number, number];
                  };
                  const isHovered = hoveredSlug === slug;
                  const fill = getFill(slug, hasRecipes, isHovered);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => {
                        setHoveredSlug(slug);
                        setHoveredLabel(label);
                      }}
                      onMouseLeave={() => {
                        setHoveredSlug(null);
                        setHoveredLabel(null);
                      }}
                      onClick={() => {
                        handleNavigate(slug, centroid);
                      }}
                      style={geoStyle(fill, true)}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Region mode loading state: show plain countries while topology loads */}
          {mode === 'region' && !regionGeoJSON && (
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={geoStyle('var(--color-map-land)', false)}
                  />
                ))
              }
            </Geographies>
          )}
        </ZoomableGroup>
      </ComposableMap>

      {/* ── Anchored caption + mode toggle (bottom-left) ─────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 'var(--space-xl)',
          left: 'var(--space-xl)',
          pointerEvents: 'none',
        }}
      >
        {/* Toggle — re-enable pointer events for buttons only */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-xs)',
            marginBottom: 'var(--space-sm)',
            pointerEvents: 'auto',
          }}
        >
          <button
            onClick={() => setMode('country')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'var(--text-eyebrow)',
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              color: mode === 'country' ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
            }}
          >
            Country
          </button>
          <span style={{ color: 'var(--color-ink-muted)', fontSize: 'var(--text-eyebrow)' }}>·</span>
          <button
            onClick={() => setMode('region')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'var(--text-eyebrow)',
              textTransform: 'uppercase',
              letterSpacing: '0.22em',
              color: mode === 'region' ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
            }}
          >
            Region
          </button>
        </div>

        {/* Oxblood tick */}
        <div
          style={{
            width: 48,
            height: 2,
            backgroundColor: 'var(--color-oxblood)',
            marginBottom: 'var(--space-xs)',
          }}
        />

        {/* Crossfading label */}
        <p
          style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: 'var(--text-body)',
            color: 'var(--color-ink)',
            margin: 0,
            transition: 'opacity 0.15s ease',
            opacity: hoveredLabel ? 1 : 0,
            minHeight: '1.5em',
          }}
        >
          {hoveredLabel ?? ''}
        </p>
      </div>

      {/* ── Hint text (bottom-right, above buttons) ──────────── */}
      <p
        style={{
          position: 'absolute',
          right: 'var(--space-md)',
          bottom: 'calc(var(--space-md) + 64px)',
          fontSize: 'var(--text-eyebrow)',
          fontStyle: 'italic',
          fontFamily: 'var(--font-family-serif)',
          color: 'var(--color-ink-muted)',
          pointerEvents: 'none',
          margin: 0,
        }}
      >
        ⌘ + scroll to zoom
      </p>

      {/* ── +/− zoom buttons (bottom-right) ──────────────────── */}
      <div
        style={{
          position: 'absolute',
          right: 'var(--space-md)',
          bottom: 'var(--space-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {(['+', '−'] as const).map((sym) => (
          <button
            key={sym}
            onClick={() =>
              setPosition((p) => ({
                ...p,
                zoom:
                  sym === '+'
                    ? Math.min(8, p.zoom * 1.5)
                    : Math.max(1, p.zoom / 1.5),
              }))
            }
            style={{
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.1rem',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: 0,
              lineHeight: 1,
            }}
          >
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
