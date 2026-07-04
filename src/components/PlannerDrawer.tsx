import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import {
  DAYS,
  MAX_MEALS_PER_DAY,
  PLANNER_ADD_TYPE as ADD_TYPE,
  PLANNER_MOVE_TYPE as MOVE_TYPE,
  usePlanner,
  type RecipeData,
} from './usePlanner';

interface Props {
  recipes: RecipeData[];
  basePath: string;
}

const DRAWER_W = 340;
const TAB_W = 32;

const EYEBROW: React.CSSProperties = {
  fontFamily: "'EB Garamond', Georgia, serif",
  fontWeight: 600,
  fontSize: 'var(--text-eyebrow)',
  textTransform: 'uppercase',
  letterSpacing: '0.24em',
  color: 'var(--color-oxblood)',
  margin: 0,
};

export function PlannerDrawer({ recipes, basePath }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'manual' | 'drag'>('manual');
  const [armedDay, setArmedDay] = useState<string | null>(null);
  const [dragOverTab, setDragOverTab] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dayNote, setDayNote] = useState<{ day: string; msg: string } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { meals, mealCount, selectRecipe, removeMeal, moveMeal } = usePlanner();
  const plannerHref = `${basePath}/meal-planner`;

  const isFull = (day: string) => (meals[day]?.length ?? 0) >= MAX_MEALS_PER_DAY;

  function flashNote(day: string, msg: string) {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setDayNote({ day, msg });
    noteTimer.current = setTimeout(() => setDayNote(null), 2500);
  }

  // Push page content when drawer opens; mobile never pushes
  useEffect(() => {
    if (window.innerWidth >= 768) {
      document.body.style.paddingRight = drawerOpen ? `${DRAWER_W}px` : '0px';
    }
  }, [drawerOpen]);

  // Broadcast armed day so collection grids can show crosshair + click target
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('planner:arm', { detail: { day: armedDay } }));
  }, [armedDay]);

  // Listen for recipe picks from any collection grid
  useEffect(() => {
    function handler(e: Event) {
      const { recipeId } = (e as CustomEvent<{ recipeId: string }>).detail;
      if (!armedDay) return;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      const ok = selectRecipe(armedDay, recipe);
      if (!ok) flashNote(armedDay, 'day is full'); // quiet no-op, auto-disarm
      setArmedDay(null);
    }
    window.addEventListener('planner:pick', handler);
    return () => window.removeEventListener('planner:pick', handler);
  }, [armedDay, recipes, selectRecipe]);

  // Clear drag highlights if drag is cancelled outside a drop target
  useEffect(() => {
    const handler = () => { setDragOverTab(false); setDragOverDay(null); };
    document.addEventListener('dragend', handler);
    return () => document.removeEventListener('dragend', handler);
  }, []);

  function toggleDrawer() {
    if (drawerOpen) {
      setDrawerOpen(false);
      setArmedDay(null);
      setDragOverTab(false);
    } else {
      setDrawerOpen(true);
      setDrawerMode('manual');
    }
  }

  function armDay(day: string) {
    if (!drawerOpen) {
      setDrawerOpen(true);
      setDrawerMode('manual');
    }
    setArmedDay(armedDay === day ? null : day);
  }

  function handleDragOverDrawer(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!drawerOpen) {
      setDragOverTab(true);
      setDrawerOpen(true);
      setDrawerMode('drag');
    }
  }

  function handleDragLeaveDrawer(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverTab(false);
    }
  }

  function handleDragOverDay(e: React.DragEvent, day: string) {
    // Full day = blocked: no preventDefault → no-drop cursor, no highlight
    if (isFull(day)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MOVE_TYPE) ? 'move' : 'copy';
    setDragOverDay(day);
  }

  function handleDragLeaveDay(e: React.DragEvent) {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverDay(null);
    }
  }

  function handleDropOnDay(e: React.DragEvent, day: string) {
    e.preventDefault();
    const moveRaw = e.dataTransfer.getData(MOVE_TYPE);
    if (moveRaw) {
      try {
        const { fromDay, mealId } = JSON.parse(moveRaw);
        moveMeal(fromDay, mealId, day); // same-day / full = no-op in the hook
      } catch {}
    } else {
      const addRaw = e.dataTransfer.getData(ADD_TYPE);
      if (addRaw) {
        try {
          const { recipeId } = JSON.parse(addRaw);
          const recipe = recipes.find((r) => r.id === recipeId);
          if (recipe) selectRecipe(day, recipe);
        } catch {}
      }
    }
    setDragOverDay(null);
    setDragOverTab(false);
    if (drawerMode === 'drag') setDrawerOpen(false);
  }

  function handleChipDragStart(e: React.DragEvent, day: string, mealId: string) {
    e.dataTransfer.setData(MOVE_TYPE, JSON.stringify({ kind: 'move', fromDay: day, mealId }));
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <>
      <style>{`
        .pd-drawer {
          position: fixed;
          right: 0;
          top: 0;
          height: 100vh;
          z-index: 40;
          width: ${TAB_W}px;
          overflow: hidden;
          transition: width 180ms ease;
          border-left: 2px solid var(--color-oxblood);
          background: var(--color-paper);
        }
        .pd-drawer.open { width: ${DRAWER_W}px; }
        .pd-drawer-inner {
          width: ${DRAWER_W}px;
          height: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .pd-tab {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: ${TAB_W}px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-lg) 0;
          background: none;
          border: none;
          cursor: pointer;
          z-index: 2;
        }
        .pd-tab:hover { background: rgba(41,47,23,0.025); }
        .pd-panel {
          position: absolute;
          left: ${TAB_W}px; right: 0; top: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transition: opacity 120ms ease 60ms;
          overflow: hidden;
        }
        .pd-drawer.open .pd-panel {
          opacity: 1;
          pointer-events: auto;
        }
        .pd-panel-scroll {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-lg) var(--space-md) var(--space-md) var(--space-sm);
        }
        .pd-day-row {
          display: flex;
          align-items: flex-start;
          gap: var(--space-xs);
          padding: var(--space-sm) 0;
          border-bottom: 1px solid var(--color-hairline);
          transition: background 0.12s;
        }
        .pd-day-row.drag-over {
          background: rgba(126,38,37,0.06);
          outline: 1px solid rgba(126,38,37,0.3);
        }
        .pd-day-row.armed { background: rgba(126,38,37,0.04); }
        .pd-mark       { width: 14px; height: 2px; background: var(--color-oxblood); border-radius: 1px; }
        .pd-mark-empty { width: 14px; height: 2px; background: var(--color-hairline); border-radius: 1px; }
        .pd-btn-pinned {
          padding: var(--space-sm) var(--space-md);
          border-top: 1px solid var(--color-hairline);
          background: var(--color-paper);
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .pd-drawer { display: none; }
        }
      `}</style>

      <div
        className={`pd-drawer${drawerOpen ? ' open' : ''}`}
        onDragOver={handleDragOverDrawer}
        onDragLeave={handleDragLeaveDrawer}
        onDrop={(e) => e.preventDefault()}
      >
        <div className="pd-drawer-inner">

          {/* Tab spine — always TAB_W wide, visible in both states */}
          <button
            className="pd-tab"
            onClick={toggleDrawer}
            aria-label={drawerOpen ? 'Close meal planner' : 'Open meal planner'}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              {DAYS.map((day) => (
                <div key={day} className={(meals[day]?.length ?? 0) > 0 ? 'pd-mark' : 'pd-mark-empty'} title={day} />
              ))}
            </div>

            <span style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: "'EB Garamond', Georgia, serif",
              fontWeight: 600,
              fontSize: 'var(--text-eyebrow)',
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--color-ink-muted)',
              userSelect: 'none',
            }}>
              Meal planner
            </span>

            <span style={{ color: 'var(--color-ink-muted)', display: 'flex' }}>
              {drawerOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </span>
          </button>

          {/* Panel — fades in alongside the width animation */}
          <div className="pd-panel">
            <div className="pd-panel-scroll">

              <div style={{ marginBottom: 'var(--space-md)', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-hairline)' }}>
                <p style={{ ...EYEBROW, marginBottom: 'var(--space-2xs)' }}>Plan</p>
                <h2 style={{
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontWeight: 500,
                  fontSize: 'var(--text-card)',
                  color: 'var(--color-ink)',
                  margin: 0,
                  lineHeight: 1.1,
                }}>
                  This week
                </h2>
              </div>

              {DAYS.map((day) => {
                const dayMeals = meals[day] ?? [];
                const isArmed = armedDay === day;
                const isDragTarget = dragOverDay === day;

                return (
                  <div
                    key={day}
                    className={`pd-day-row${isDragTarget ? ' drag-over' : ''}${isArmed ? ' armed' : ''}`}
                    onDragOver={(e) => handleDragOverDay(e, day)}
                    onDragLeave={handleDragLeaveDay}
                    onDrop={(e) => handleDropOnDay(e, day)}
                  >
                    <span style={{
                      width: '28px',
                      flexShrink: 0,
                      marginTop: '3px',
                      fontFamily: "'EB Garamond', Georgia, serif",
                      fontSize: 'var(--text-eyebrow)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                    }}>
                      {day.slice(0, 3)}
                    </span>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {dayMeals.map((meal) => (
                        <div
                          key={meal.id}
                          draggable
                          onDragStart={(e) => handleChipDragStart(e, day, meal.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'grab' }}
                        >
                          {meal.image && (
                            <img
                              src={`${basePath}${meal.image}`}
                              alt={meal.title}
                              style={{ width: '22px', height: '22px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 }}
                            />
                          )}
                          <span style={{
                            flex: 1,
                            fontFamily: "'EB Garamond', Georgia, serif",
                            fontSize: 'var(--text-eyebrow)',
                            color: 'var(--color-ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {meal.title}
                          </span>
                          <button
                            onClick={() => removeMeal(day, meal.id)}
                            title={`Remove ${meal.title}`}
                            style={{
                              background: 'none', border: 'none',
                              color: 'var(--color-ink-muted)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '18px', height: '18px',
                              padding: 0, flexShrink: 0,
                              opacity: 0.5,
                            }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {(dayMeals.length === 0 || isArmed) && (
                        <span style={{
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: 'var(--text-eyebrow)',
                          color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                          fontStyle: 'italic',
                          opacity: 0.75,
                        }}>
                          {isArmed ? 'click a card…' : '—'}
                        </span>
                      )}
                      {dayNote?.day === day && (
                        <span style={{
                          fontFamily: "'EB Garamond', Georgia, serif",
                          fontSize: 'var(--text-eyebrow)',
                          color: 'var(--color-ink-muted)',
                          fontStyle: 'italic',
                        }}>
                          {dayNote.msg}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        onClick={() => armDay(day)}
                        title={`Add recipe to ${day}`}
                        style={{
                          background: 'none',
                          border: isArmed ? '1px solid var(--color-oxblood)' : '1px solid var(--color-hairline)',
                          color: isArmed ? 'var(--color-oxblood)' : 'var(--color-ink-muted)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '20px', height: '20px',
                          padding: 0,
                        }}
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pd-btn-pinned">
              <a
                href={mealCount > 0 ? plannerHref : undefined}
                onClick={mealCount === 0 ? (e) => e.preventDefault() : undefined}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '9px var(--space-md)',
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontSize: 'var(--text-meta)',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  backgroundColor: mealCount > 0 ? 'var(--color-oxblood)' : 'transparent',
                  color: mealCount > 0 ? 'var(--color-paper)' : 'var(--color-ink-muted)',
                  border: mealCount > 0 ? 'none' : '1px solid var(--color-hairline)',
                  cursor: mealCount > 0 ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.15s',
                }}
              >
                {mealCount > 0
                  ? `Make shopping list · ${mealCount} meal${mealCount !== 1 ? 's' : ''}`
                  : 'Make shopping list'
                }
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
