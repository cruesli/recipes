import SliderPkg from 'react-slick';
// CJS default interop for Vite SSR
const Slider = (SliderPkg as any).default ?? SliderPkg;
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

export interface SliderRecipe {
  slug: string;
  title: string;
  image: string | null;
}

function PrevArrow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Previous slide"
      style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        padding: '12px',
        backgroundColor: '#F1ECDB',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronLeft size={32} color="#7E2625" />
    </button>
  );
}

function NextArrow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Next slide"
      style={{
        position: 'absolute',
        right: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        padding: '12px',
        backgroundColor: '#F1ECDB',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ChevronRight size={32} color="#7E2625" />
    </button>
  );
}

export function RecipeSliderIsland({ recipes, basePath }: { recipes: SliderRecipe[]; basePath: string }) {
  const count = recipes.length;

  const settings = {
    dots: true,
    infinite: count > 1,
    speed: 500,
    slidesToShow: Math.min(4, count),
    slidesToScroll: 1,
    autoplay: count > 1,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    prevArrow: <PrevArrow />,
    nextArrow: <NextArrow />,
    responsive: [
      { breakpoint: 1024, settings: { slidesToShow: Math.min(2, count), slidesToScroll: 1 } },
      { breakpoint: 640, settings: { slidesToShow: 1, slidesToScroll: 1 } },
    ],
  };

  return (
    <div style={{ backgroundColor: '#FAF9F5', padding: '4rem 0 5rem' }}>
      <div className="recipe-slider-container">
        <Slider {...settings}>
          {recipes.map((recipe) => (
            <div key={recipe.slug}>
              <a
                href={`${basePath}/recipes/${recipe.slug}`}
                style={{ display: 'block', textDecoration: 'none' }}
              >
                <div className="slide-wrap" style={{ position: 'relative', height: 'clamp(130px, 23vw, 230px)', overflow: 'hidden' }}>
                  {recipe.image ? (
                    <img
                      className="slide-img"
                      src={`${basePath}${recipe.image}`}
                      alt={recipe.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 500ms' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#F1ECDB' }} />
                  )}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 40%, transparent 100%)',
                  }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem' }}>
                    <h3 style={{
                      color: 'white',
                      fontSize: '1.5rem',
                      fontWeight: 500,
                      margin: 0,
                      fontFamily: "'EB Garamond', Georgia, serif",
                      lineHeight: 1.2,
                    }}>
                      {recipe.title}
                    </h3>
                  </div>
                </div>
              </a>
            </div>
          ))}
        </Slider>
      </div>
    </div>
  );
}
