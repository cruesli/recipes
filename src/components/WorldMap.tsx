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
import { navigate } from 'astro:transitions/client';
import countryRegionsData from '../content/meta/country-regions.json';
import { featureKey, slugForFeature as resolveSlug } from '../lib/regionGeometry.mjs';

// Topology feature → cuisine slug (leaf or region) or null (inert land)
const COUNTRY_REGIONS: Record<string, { name: string; region: string | null }> =
  countryRegionsData.countries;

const slugForFeature = (geo: any): string | null => resolveSlug(COUNTRY_REGIONS, geo);

interface Props {
  recipeCuisines: string[];
  cuisinesData: CuisineItem[];
  basePath: string;
}

interface Position {
  zoom: number;
  coordinates: [number, number];
}

// Consume-once map state snapshot (written at click, restored on return)
const SNAPSHOT_KEY = 'map:snapshot';

interface MapSnapshot {
  coordinates: [number, number];
  zoom: number;
  mode: 'country' | 'region';
  slug: string; // unused until Phase 10 T4
}

function readSnapshot(): MapSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SNAPSHOT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function WorldMap({ recipeCuisines, cuisinesData, basePath }: Props) {
  const geoUrl = `${basePath}/geo/countries-110m.json`;

  // Read + delete any snapshot once, before state init (client:only, so no SSR)
  const snapshotRef = useRef<MapSnapshot | null | undefined>(undefined);
  if (snapshotRef.current === undefined) snapshotRef.current = readSnapshot();
  const snapshot = snapshotRef.current;

  // Mode: country or region (region is default)
  const [mode, setMode] = useState<'country' | 'region'>(snapshot?.mode ?? 'region');
  const [position, setPosition] = useState<Position>(
    snapshot
      ? { zoom: snapshot.zoom, coordinates: snapshot.coordinates }
      : { zoom: 1, coordinates: [15, 25] }
  );
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);

  // Keep a ref in sync so the click snapshot reads the latest position without stale closure
  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; }, [position]);

  // De-duped set for hasRecipes checks; per-slug counts for aria-labels
  const availableSet = useMemo(() => new Set(recipeCuisines), [recipeCuisines]);

  // Leaf cuisine slugs — country-mode aliveness is strict leaf-only
  const leafSet = useMemo(
    () => new Set(cuisinesData.filter((c) => c.parent != null).map((c) => c.slug)),
    [cuisinesData]
  );
  const recipeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    recipeCuisines.forEach(s => { counts[s] = (counts[s] ?? 0) + 1; });
    return counts;
  }, [recipeCuisines]);

  // Aggregate recipe count for a region slug (direct + all child leaves)
  function getRegionCount(regionSlug: string): number {
    let n = recipeCounts[regionSlug] ?? 0;
    cuisinesData.forEach(c => { if (c.parent === regionSlug) n += recipeCounts[c.slug] ?? 0; });
    return n;
  }

  // bfcache back-navigation restores the page without remounting — consume the snapshot here
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const snap = readSnapshot();
      if (!snap) return;
      setMode(snap.mode);
      setPosition({ zoom: snap.zoom, coordinates: snap.coordinates });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // Fetch topology once on mount (needed for region merge)
  useEffect(() => {
    fetch(geoUrl)
      .then((r) => r.json())
      .then(setTopology);
  }, []);

  // topojson-client + react-simple-maps types are incomplete; any is intentional here
  // Compute per-region merged shapes from topology; inert (null-region) features stay individual
  const regionShapes = useMemo(() => {
    if (!topology || mode !== 'region') return null;

    const countries = (topojson.feature(topology, (topology as any).objects.countries) as any);

    // Group feature keys by region slug — all mapped features, recipes or not
    const regionMap = new Map<string, string[]>();
    const inert: any[] = [];

    countries.features.forEach((feature: any) => {
      const leafSlug = slugForFeature(feature);
      if (!leafSlug) {
        inert.push(feature);
        return;
      }

      // Resolve to region: if leaf has a parent cuisine, use parent; else leaf IS the region
      const entry = cuisinesData.find((c) => c.slug === leafSlug);
      const regionSlug = entry?.parent ?? leafSlug;

      if (!regionMap.has(regionSlug)) regionMap.set(regionSlug, []);
      regionMap.get(regionSlug)!.push(featureKey(feature));
    });

    // Merge arcs per region using topology geometry objects
    const regions: Array<{
      slug: string;
      label: string;
      shape: any;
      hasRecipes: boolean;
    }> = [];

    regionMap.forEach((featureKeys, regionSlug) => {
      const regionEntry = cuisinesData.find((c) => c.slug === regionSlug);
      const keySet = new Set(featureKeys);

      // Filter the original topology geometry objects by matching key
      const countryGeoms = ((topology as any).objects.countries as any).geometries.filter(
        (g: any) => keySet.has(featureKey(g))
      );

      if (countryGeoms.length === 0) return;

      const merged = topojson.merge(topology as any, countryGeoms);

      // Check if this region has recipes (direct slug or any child leaf)
      const hasRecipes = availableSet.has(regionSlug) ||
        cuisinesData.some((c) => c.parent === regionSlug && availableSet.has(c.slug));

      regions.push({
        slug: regionSlug,
        label: regionEntry?.label ?? regionSlug,
        shape: merged,
        hasRecipes,
      });
    });

    return { regions, inert };
  }, [topology, mode, cuisinesData, availableSet]);

  // Build GeoJSON FeatureCollection for region mode (merged regions + inert land)
  const regionGeoJSON = useMemo(() => {
    if (!regionShapes) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        ...regionShapes.regions.map((r) => ({
          type: 'Feature' as const,
          properties: { slug: r.slug, label: r.label, hasRecipes: r.hasRecipes },
          geometry: r.shape,
        })),
        ...regionShapes.inert.map((f: any) => ({
          type: 'Feature' as const,
          properties: { slug: null, label: null, hasRecipes: false },
          geometry: f.geometry,
        })),
      ],
    };
  }, [regionShapes]);

  // Overlay a fixed-position copy of the clicked shape; the view transition
  // morphs it into the cuisine header silhouette (same view-transition-name).
  // The overlay lives in the old page's body, so the router swap removes it.
  function spawnMorphOverlay(el: SVGPathElement) {
    const rect = el.getBoundingClientRect();
    const bbox = el.getBBox();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', el.getAttribute('d') ?? '');
    path.setAttribute('fill', 'var(--color-map-active)');
    svg.appendChild(path);
    Object.assign(svg.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: 'none',
      zIndex: '999',
      viewTransitionName: 'cuisine-shape',
    });
    document.body.appendChild(svg);
  }

  // Navigate to a cuisine page — the shape morph IS the flight
  function handleNavigate(slug: string, el?: SVGPathElement) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const target = `${basePath}/cuisines/${slug}`;

    // Snapshot the at-click framing before any motion starts
    const { coordinates, zoom } = positionRef.current;
    try {
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ coordinates, zoom, mode, slug }));
    } catch { /* private mode: skip restore */ }

    if (!prefersReducedMotion && el) spawnMorphOverlay(el);
    navigate(target);
  }

  // Fill: alive shapes are sage (olive on hover); everything dead is tan
  const getFill = (alive: boolean, isHovered: boolean) => {
    if (!alive) return 'var(--color-map-land)';
    return isHovered ? 'var(--color-olive)' : 'var(--color-map-active)';
  };

  // Shared Geography style builder — outline removed; CSS handles focus-visible ring
  const geoStyle = (fill: string, clickable: boolean) => ({
    default: {
      fill,
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
      transition: 'fill 0.2s ease',
      cursor: clickable ? 'pointer' : 'default',
    },
    hover: {
      fill: clickable ? 'var(--color-olive)' : 'var(--color-map-land)',
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
      cursor: clickable ? 'pointer' : 'default',
    },
    pressed: {
      fill: clickable ? 'var(--color-oxblood)' : 'var(--color-map-land)',
      stroke: 'var(--color-paper)',
      strokeWidth: 0.5,
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

          {/* Country mode — alive iff the country's own leaf cuisine has recipes */}
          {mode === 'country' && (
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = geo.properties?.name;
                  const slug = slugForFeature(geo);
                  const alive = slug !== null && leafSet.has(slug) && availableSet.has(slug);
                  const isHovered = hoveredSlug === name;
                  const fill = getFill(alive, isHovered);

                  // Dead land: decorative path only
                  if (!alive) {
                    return (
                      <Geography key={geo.rsmKey} geography={geo} style={geoStyle(fill, false)} />
                    );
                  }

                  const entry = cuisinesData.find((c) => c.slug === slug);
                  const labelText = entry?.label ?? slug;
                  const count = recipeCounts[slug] ?? 0;
                  const ariaLabel = `${labelText} cuisine, ${count} ${count === 1 ? 'recipe' : 'recipes'}`;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => {
                        setHoveredSlug(name);
                        setHoveredLabel(labelText);
                      }}
                      onMouseLeave={() => {
                        setHoveredSlug(null);
                        setHoveredLabel(null);
                      }}
                      onClick={(e: React.MouseEvent) => {
                        handleNavigate(slug, e.currentTarget as SVGPathElement);
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (e.key === ' ') e.preventDefault();
                          handleNavigate(slug, e.currentTarget as SVGPathElement);
                        }
                      }}
                      onFocus={() => {
                        setHoveredSlug(name);
                        setHoveredLabel(labelText);
                      }}
                      onBlur={() => {
                        setHoveredSlug(null);
                        setHoveredLabel(null);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={ariaLabel}
                      style={geoStyle(fill, true)}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Region mode — alive iff the region (or a child leaf) has recipes */}
          {mode === 'region' && regionGeoJSON && (
            <Geographies geography={regionGeoJSON}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const { slug, label, hasRecipes } = geo.properties as {
                    slug: string | null;
                    label: string | null;
                    hasRecipes: boolean;
                  };
                  const alive = slug !== null && hasRecipes;
                  const isHovered = hoveredSlug === slug;
                  const fill = getFill(alive, isHovered);

                  // Dead land (recipe-less region or inert feature): decorative path only
                  if (!alive || slug === null || label === null) {
                    return (
                      <Geography key={geo.rsmKey} geography={geo} style={geoStyle(fill, false)} />
                    );
                  }

                  const count = getRegionCount(slug);
                  const ariaLabel = `${label} region, ${count} ${count === 1 ? 'recipe' : 'recipes'}`;

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
                      onClick={(e: React.MouseEvent) => {
                        handleNavigate(slug, e.currentTarget as SVGPathElement);
                      }}
                      onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          if (e.key === ' ') e.preventDefault();
                          handleNavigate(slug, e.currentTarget as SVGPathElement);
                        }
                      }}
                      onFocus={() => {
                        setHoveredSlug(slug);
                        setHoveredLabel(label);
                      }}
                      onBlur={() => {
                        setHoveredSlug(null);
                        setHoveredLabel(null);
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={ariaLabel}
                      style={geoStyle(fill, true)}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {/* Region mode loading state: show plain countries while topology loads */}
          {mode === 'region' && !regionGeoJSON && (
            <Geographies geography={geoUrl}>
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
            aria-pressed={mode === 'country'}
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
            aria-pressed={mode === 'region'}
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

        {/* Crossfading label — live region for screen readers */}
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
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
            aria-label={sym === '+' ? 'Zoom in' : 'Zoom out'}
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
