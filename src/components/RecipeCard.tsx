import type React from 'react';

interface RecipeCardProps {
  href: string;
  imageSrc?: string | null;
  eyebrow?: string | null;
  title: string;
  meta?: (string | null | undefined)[];
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLAnchorElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function RecipeCard({ href, imageSrc, eyebrow, title, meta, draggable, onDragStart, onClick }: RecipeCardProps) {
  const metaStr = (meta ?? []).filter(Boolean).join(' · ');

  return (
    <a
      href={href}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`recipe-card${draggable ? ' cpi-drag-item' : ''}`}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'var(--color-ink)',
        paddingTop: 'var(--space-lg)',
        paddingBottom: 'var(--space-md)',
        userSelect: draggable ? 'none' : undefined,
      }}
    >
      {/* overflow:hidden clips the scale-on-hover within the fixed 220px height */}
      <div style={{ overflow: 'hidden' }}>
        {imageSrc ? (
          // Square display photography — keep --radius-sm only on 22px/32px utility thumbnails
          <img
            src={imageSrc}
            alt={title}
            loading="lazy"
            className="recipe-card-img"
            style={{ width: '100%', height: '220px', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '220px', backgroundColor: 'var(--color-stone)' }} />
        )}
      </div>

      <div style={{ paddingTop: 'var(--space-sm)' }}>
        {eyebrow && (
          <p style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontWeight: 600,
            fontSize: 'var(--text-eyebrow)',
            textTransform: 'uppercase',
            letterSpacing: '0.24em',
            color: 'var(--color-oxblood)',
            margin: '0 0 var(--space-2xs)',
          }}>
            {eyebrow}
          </p>
        )}
        <h3 style={{
          fontFamily: "'EB Garamond', Georgia, serif",
          fontWeight: 500,
          fontSize: 'var(--text-card)',
          lineHeight: 1.2,
          color: 'var(--color-ink)',
          margin: '0 0 var(--space-sm)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        } as React.CSSProperties}>
          {title}
        </h3>
        {metaStr && (
          <p className="onum" style={{
            fontFamily: "'EB Garamond', Georgia, serif",
            fontSize: 'var(--text-meta)',
            color: 'var(--color-ink-muted)',
            margin: 0,
          }}>
            {metaStr}
          </p>
        )}
      </div>
    </a>
  );
}
