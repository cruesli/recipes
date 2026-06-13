import { useState } from 'react';
import { Heart, Sun, Sparkles, Clock, Globe, Users } from 'lucide-react';

export interface DiscoverRecipe {
  id: string;
  title: string;
  cuisine: string;
  image: string | null;
  tags: string[];
  totalTimeMinutes: number | null;
  servings: number | null;
}

interface Props {
  recipes: DiscoverRecipe[];
  basePath: string;
}

type Mood = 'Cosy' | 'Light' | 'Impress' | 'Quick' | 'Adventurous' | 'Guests';

const MOODS: Array<{ id: Mood; label: string; icon: React.ReactNode }> = [
  { id: 'Cosy',        label: 'Cosy',          icon: <Heart size={18} /> },
  { id: 'Light',       label: 'Light',          icon: <Sun size={18} /> },
  { id: 'Impress',     label: 'Impress',        icon: <Sparkles size={18} /> },
  { id: 'Quick',       label: 'Quick',          icon: <Clock size={18} /> },
  { id: 'Adventurous', label: 'Adventurous',    icon: <Globe size={18} /> },
  { id: 'Guests',      label: 'For guests',     icon: <Users size={18} /> },
];

function matchMood(recipe: DiscoverRecipe, mood: Mood): boolean {
  const tags = recipe.tags.map((t) => t.toLowerCase());
  const mins = recipe.totalTimeMinutes;
  const servings = recipe.servings ?? 0;
  switch (mood) {
    case 'Cosy':        return tags.some((t) => ['family', 'freezer-friendly', 'hearty', 'comfort'].includes(t));
    case 'Light':       return tags.some((t) => ['healthy', 'light', 'summer', 'salad'].includes(t));
    case 'Impress':     return tags.some((t) => ['impress', 'dinner party', 'gourmet'].includes(t));
    case 'Quick':       return mins !== null && mins <= 45;
    case 'Adventurous': return !['italian', 'french', 'american', 'british'].includes(recipe.cuisine.toLowerCase());
    case 'Guests':      return servings >= 4;
    default:            return false;
  }
}

function extractSpotlightIngredients(recipes: DiscoverRecipe[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of recipes) {
    // Recipe ingredients are passed as tags here via the cuisine;
    // they're not in this subset. We surface cuisine names as "ingredients to explore".
    // Actual ingredient spotlight will come from the full ingredient list —
    // for now surfaces unique cuisines as exploration topics.
    const label = r.cuisine.charAt(0).toUpperCase() + r.cuisine.slice(1) + ' cuisine';
    if (!seen.has(label)) { seen.add(label); result.push(label); }
  }
  return result;
}

export function DiscoverPanel({ recipes, basePath }: Props) {
  const [activeMood, setActiveMood] = useState<Mood | null>(null);
  const [expanded, setExpanded] = useState<'mood' | 'ingredient' | null>(null);
  const [ingredientIdx, setIngredientIdx] = useState(0);

  const spotlight = extractSpotlightIngredients(recipes);
  const currentSpotlight = spotlight[ingredientIdx % Math.max(spotlight.length, 1)];

  const moodMatches = activeMood ? recipes.filter((r) => matchMood(r, activeMood)) : [];

  const leftWidth = expanded === 'mood' ? '65%' : expanded === 'ingredient' ? '35%' : '50%';
  const rightWidth = expanded === 'ingredient' ? '65%' : expanded === 'mood' ? '35%' : '50%';

  return (
    <div style={{ width: '100%', minHeight: '60vh', display: 'flex', backgroundColor: '#FAF9F5' }}>

      {/* Left: Mood */}
      <div
        style={{
          width: leftWidth,
          backgroundColor: '#F1ECDB',
          padding: '2.5rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.4s ease',
          overflow: 'hidden',
          cursor: expanded !== 'mood' ? 'pointer' : 'default',
        }}
        onClick={() => {
          if (expanded !== 'mood') {
            setExpanded('mood');
            if (!activeMood) setActiveMood('Cosy');
          }
        }}
      >
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(41,47,23,0.5)', marginBottom: '4px' }}>
          Mood
        </p>
        <h2 style={{ fontSize: '1.5rem', color: '#292F17', margin: '0 0 1.5rem' }}>
          What are you in the mood for?
        </h2>

        {/* Mood grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flex: 1 }}>
          {MOODS.map((mood) => {
            const isActive = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded('mood');
                  setActiveMood(mood.id);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '16px 8px',
                  borderRadius: '10px',
                  border: isActive ? '1px solid #7E2625' : '1px solid transparent',
                  backgroundColor: isActive ? 'rgba(126,38,37,0.08)' : 'transparent',
                  color: isActive ? '#7E2625' : '#292F17',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.15s',
                  minHeight: '70px',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(126,38,37,0.05)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                {mood.icon}
                <span>{mood.label}</span>
              </button>
            );
          })}
        </div>

        {/* Matching recipes */}
        {expanded === 'mood' && activeMood && (
          <div style={{ marginTop: '1.5rem' }}>
            {moodMatches.length > 0 ? (
              <>
                <p style={{ fontSize: '12px', color: 'rgba(41,47,23,0.5)', marginBottom: '10px' }}>
                  {moodMatches.length} {moodMatches.length === 1 ? 'recipe' : 'recipes'} match
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {moodMatches.slice(0, 4).map((r) => (
                    <a
                      key={r.id}
                      href={`${basePath}/recipes/${r.id}`}
                      style={{
                        display: 'block',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        aspectRatio: '3/2',
                        position: 'relative',
                        textDecoration: 'none',
                        backgroundColor: '#D4D0BF',
                      }}
                    >
                      {r.image && (
                        <img
                          src={`${basePath}${r.image}`}
                          alt={r.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      )}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px' }}>
                        <p style={{ color: 'white', fontSize: '11px', margin: 0, lineHeight: 1.3 }}>{r.title}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'rgba(41,47,23,0.5)', fontStyle: 'italic' }}>
                No recipes match this mood yet — add more!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right: Ingredient spotlight */}
      <div
        style={{
          width: rightWidth,
          padding: '2.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.4s ease',
          overflow: 'hidden',
          cursor: expanded !== 'ingredient' ? 'pointer' : 'default',
        }}
        onClick={() => { if (expanded !== 'ingredient') setExpanded('ingredient'); }}
      >
        <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(41,47,23,0.5)', marginBottom: '4px' }}>
          Explore
        </p>
        <h2 style={{ fontSize: '1.5rem', color: '#292F17', margin: '0 0 1.25rem' }}>
          What's in the collection?
        </h2>

        {/* Spotlight card */}
        <div
          style={{
            backgroundColor: '#F1ECDB',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#FAF9F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              🌍
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#292F17', margin: '0 0 2px' }}>{currentSpotlight}</p>
              <p style={{ fontSize: '12px', color: 'rgba(41,47,23,0.6)', margin: 0 }}>
                {recipes.filter((r) => (r.cuisine + ' cuisine') === currentSpotlight).length} recipes
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setIngredientIdx((i) => i + 1); }}
          style={{ fontSize: '12px', color: '#7E2625', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', alignSelf: 'flex-start', marginBottom: '1.5rem' }}
        >
          Show another cuisine →
        </button>

        {/* All recipes mini-list */}
        {expanded === 'ingredient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recipes.map((r) => (
              <a
                key={r.id}
                href={`${basePath}/recipes/${r.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textDecoration: 'none',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#F1ECDB',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#E8E4D4'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#F1ECDB'; }}
              >
                {r.image && (
                  <img
                    src={`${basePath}${r.image}`}
                    alt={r.title}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#292F17', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                  <p style={{ fontSize: '11px', color: 'rgba(41,47,23,0.5)', margin: 0, textTransform: 'capitalize' }}>{r.cuisine}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
