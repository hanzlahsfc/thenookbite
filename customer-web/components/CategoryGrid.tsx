import Image from 'next/image';
import Link from 'next/link';
import { getMenuCategories, categoryLabel } from '@/lib/menuCategories';
import { MENU_ITEMS } from '@/lib/menuData';
import { Reveal } from './Reveal';

// Fallback imagery for a category added without its own picture
const PLACEHOLDER = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=75';


export function CategoryGrid() {
  const cats = getMenuCategories();

  // Live item counts — the old hardcoded ones had drifted badly (Appetizers
  // read "12 items" against 31 on the menu)
  const counts = new Map<string, number>();
  for (const i of MENU_ITEMS) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);

  return (
    <section className="bg-surface py-14 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="font-heading text-xs tracking-[0.4em] text-brand-red mb-2">WHAT WE SERVE</p>
              <h2 className="text-3xl sm:text-5xl text-primary leading-none">EXPLORE<br/>THE MENU</h2>
            </div>
            <Link href="/menu" className="hidden sm:flex items-center gap-2 font-heading text-xs tracking-widest text-muted hover:text-brand-red transition-colors duration-200">
              ALL ITEMS
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cats.map((c, i) => {
            const cat   = c.name;
            const count = counts.get(cat) ?? 0;
            if (count === 0) return null; // hide categories with nothing in them
            return (
              <Reveal key={c.id} direction="zoom" delay={(i % 4) * 60}>
                <Link
                  href={`/menu?category=${encodeURIComponent(cat)}`}
                  className="group relative block overflow-hidden bg-card rounded-sm aspect-[4/5]"
                >
                  {/* Image always visible, brightens on hover */}
                  <Image
                    src={c.image_url || PLACEHOLDER}
                    alt={cat}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover brightness-50 group-hover:brightness-70 group-hover:scale-105 transition-all duration-700"
                  />

                  {/* Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <span className="font-heading text-xs tracking-[0.3em] text-brand-red mb-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      {count} item{count === 1 ? '' : 's'}
                    </span>
                    <h3 className="font-heading text-lg sm:text-xl text-white leading-tight">
                      {categoryLabel(c)}
                    </h3>
                    <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 delay-75">
                      <span className="font-heading text-xs tracking-widest text-white/70">ORDER</span>
                      <div className="flex-1 h-px bg-brand-red" />
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
