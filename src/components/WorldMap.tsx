import { useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map world-atlas country names → our cuisine slugs
const COUNTRY_TO_CUISINE: Record<string, string> = {
  // Europe
  Italy: 'italian',
  France: 'french',
  Spain: 'spanish',
  Germany: 'german',
  Denmark: 'danish',
  Norway: 'scandinavian',
  Sweden: 'scandinavian',
  Finland: 'scandinavian',
  Iceland: 'scandinavian',
  'United Kingdom': 'british',
  Greece: 'other',

  // Asia
  China: 'chinese',
  Japan: 'japanese',
  Thailand: 'thai',
  India: 'indian',
  Vietnam: 'vietnamese',
  'South Korea': 'korean',

  // Americas
  Mexico: 'mexican',
  'United States of America': 'american',

  // Middle East (all map to same cuisine)
  Lebanon: 'middle-eastern',
  Turkey: 'middle-eastern',
  Syria: 'middle-eastern',
  Jordan: 'middle-eastern',
  Israel: 'middle-eastern',
  Palestine: 'middle-eastern',
  Iran: 'middle-eastern',
  Iraq: 'middle-eastern',
  'Saudi Arabia': 'middle-eastern',
  Yemen: 'middle-eastern',
  Kuwait: 'middle-eastern',
  Qatar: 'middle-eastern',
  Bahrain: 'middle-eastern',
  'United Arab Emirates': 'middle-eastern',
  Oman: 'middle-eastern',
  Egypt: 'middle-eastern',
};

// Human-readable labels for tooltip
const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian',
  french: 'French',
  spanish: 'Spanish',
  german: 'German',
  danish: 'Danish',
  scandinavian: 'Scandinavian',
  british: 'British',
  chinese: 'Chinese',
  japanese: 'Japanese',
  thai: 'Thai',
  indian: 'Indian',
  vietnamese: 'Vietnamese',
  korean: 'Korean',
  mexican: 'Mexican',
  american: 'American',
  'middle-eastern': 'Middle Eastern',
  other: 'Other',
};

interface Props {
  availableCuisines: string[];
  basePath: string;
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  slug: string;
}

export function WorldMap({ availableCuisines, basePath }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const availableSet = new Set(availableCuisines);

  const getCuisineSlug = (name: string) => COUNTRY_TO_CUISINE[name];

  const handleMouseEnter = (geo: any, event: React.MouseEvent) => {
    const slug = getCuisineSlug(geo.properties.name);
    if (!slug) return;
    setHoveredCountry(geo.properties.name);
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      label: CUISINE_LABELS[slug] ?? slug,
      slug,
    });
  };

  const handleMouseMove = (geo: any, event: React.MouseEvent) => {
    const slug = getCuisineSlug(geo.properties.name);
    if (!slug || !tooltip) return;
    setTooltip((t) => t && { ...t, x: event.clientX, y: event.clientY });
  };

  const handleMouseLeave = () => {
    setHoveredCountry(null);
    setTooltip(null);
  };

  const handleClick = (geo: any) => {
    const slug = getCuisineSlug(geo.properties.name);
    if (!slug) return;
    window.location.href = `${basePath}/cuisines/${slug}`;
  };

  return (
    <div className="relative w-full" style={{ height: '70vh', backgroundColor: 'var(--color-paper)' }}>
      {/* Heading overlay */}
      <div className="absolute top-6 left-0 right-0 text-center z-10 px-6 pointer-events-none">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--color-ink-muted)' }}>
          Discover
        </p>
        <h1 className="text-4xl md:text-5xl" style={{ color: 'var(--color-ink)', fontFamily: "'EB Garamond', Georgia, serif" }}>
          Explore the world through food
        </h1>
        <p className="mt-2 text-base" style={{ color: 'var(--color-ink-muted)' }}>
          Click a country to see recipes from that cuisine
        </p>
      </div>

      {/* Map */}
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [15, 20] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup
          center={[0, 0]}
          zoom={1}
          minZoom={1}
          maxZoom={8}
          translateExtent={[[-800, -500], [800, 500]]}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const slug = getCuisineSlug(geo.properties.name);
                const hasRecipe = slug && availableSet.has(slug);
                const hasCuisine = !!slug;
                const isHovered = hoveredCountry === geo.properties.name;

                let fill = '#E8E4D4';
                if (hasCuisine && hasRecipe) fill = '#B8B89A';
                if (hasCuisine && !hasRecipe) fill = 'var(--color-stone)';
                if (isHovered && hasCuisine) fill = 'var(--color-olive)';

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(e: any) => handleMouseEnter(geo, e)}
                    onMouseMove={(e: any) => handleMouseMove(geo, e)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => handleClick(geo)}
                    style={{
                      default: {
                        fill,
                        stroke: 'var(--color-paper)',
                        strokeWidth: 0.5,
                        outline: 'none',
                        transition: 'fill 0.2s ease',
                        cursor: hasCuisine ? 'pointer' : 'default',
                      },
                      hover: {
                        fill: hasCuisine ? 'var(--color-olive)' : '#E8E4D4',
                        stroke: 'var(--color-paper)',
                        strokeWidth: 0.5,
                        outline: 'none',
                        cursor: hasCuisine ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill: hasCuisine ? 'var(--color-oxblood)' : '#E8E4D4',
                        stroke: 'var(--color-paper)',
                        strokeWidth: 0.5,
                        outline: 'none',
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Legend */}
      <div
        className="absolute bottom-4 left-6 flex items-center gap-4 text-xs"
        style={{ color: 'var(--color-ink-muted)' }}
      >
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: '#B8B89A' }} />
          Has recipes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--color-stone)' }} />
          Cuisine with no recipes yet
        </span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div
            className="px-3 py-1.5 rounded-lg text-sm shadow-md"
            style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)' }}
          >
            {tooltip.label}
            {availableSet.has(tooltip.slug) && (
              <span className="ml-2 opacity-60 text-xs">→ view recipes</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
