import { CITIES } from "@shared/schema";

export function Footer() {
  return (
    <footer className="py-12 sm:py-16" style={{ background: "var(--ink)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <div className="font-display text-2xl font-black mb-3 flex items-center justify-center gap-2" style={{ color: "var(--cream)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--terra)" }} />
          CultFam
        </div>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }} data-testid="text-footer-tagline">
          For India's hobby tribes
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-8">
          {CITIES.map((city) => (
            <span key={city} className="text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }} data-testid={`text-footer-city-${city.toLowerCase()}`}>
              {city}
            </span>
          ))}
        </div>
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }} data-testid="text-footer-copyright">
          &copy; {new Date().getFullYear()} CultFam
        </div>
      </div>
    </footer>
  );
}
