import { useRef } from "react";
import { motion } from "framer-motion";
import { Users, MapPin, Star, ChevronRight } from "lucide-react";
import { useLocation, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_EMOJI } from "@shared/schema";
import type { Club } from "@shared/schema";
import { CATEGORY_GRADIENTS, DEFAULT_GRADIENT } from "@/lib/constants";

type ClubWithActivity = Club & { recentJoins?: number };

interface ClubsSectionProps {
  clubs: ClubWithActivity[];
  isLoading: boolean;
}

function ScrollClubCard({ club, index }: { club: ClubWithActivity; index: number }) {
  const [, navigate] = useLocation();
  const foundingSpotsLeft = (club.foundingTotal ?? 20) - (club.foundingTaken ?? 0);
  const emoji = CATEGORY_EMOJI[club.category] || club.emoji;
  const gradient = CATEGORY_GRADIENTS[club.category] || DEFAULT_GRADIENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="shrink-0 w-[280px] sm:w-[300px] snap-start"
    >
      <div
        className="overflow-visible transition-all hover-elevate cursor-pointer h-full flex flex-col"
        style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderRadius: "18px" }}
        data-testid={`card-club-${club.id}`}
        onClick={() => navigate(`/club/${club.id}`)}
      >
        <div
          className="flex items-center justify-center py-8 relative"
          style={{ background: gradient, borderRadius: "17px 17px 0 0" }}
        >
          <span className="text-[56px] drop-shadow-lg" data-testid={`emoji-club-${club.id}`}>
            {emoji}
          </span>
          {foundingSpotsLeft > 0 && (
            <div
              className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.2)", color: "white", backdropFilter: "blur(8px)" }}
              data-testid={`badge-founding-${club.id}`}
            >
              <Star className="w-3 h-3" />
              Founding spots open
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1">
          <h3
            className="font-display text-lg font-bold tracking-tight leading-tight mb-1.5"
            style={{ color: "var(--ink)" }}
            data-testid={`text-club-name-${club.id}`}
          >
            {club.name}
          </h3>
          <p
            className="text-[13px] leading-relaxed mb-4 line-clamp-1"
            style={{ color: "var(--muted-warm)" }}
            data-testid={`text-club-desc-${club.id}`}
          >
            {club.shortDesc}
          </p>

          <div className="flex items-center flex-wrap gap-2 mt-auto">
            <Badge variant="secondary" data-testid={`badge-members-${club.id}`}>
              <Users className="w-3 h-3 mr-1" />
              <span style={{ color: "var(--terra)", fontWeight: 700 }}>{club.memberCount}</span>
            </Badge>
            <Badge variant="outline" data-testid={`badge-city-${club.id}`}>
              <MapPin className="w-3 h-3 mr-1" />
              {club.city}
            </Badge>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ClubsSection({ clubs, isLoading }: ClubsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <section id="clubs" className="py-16 sm:py-24">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[2px] uppercase mb-3" style={{ color: "var(--terra)" }}>
            <span className="w-5 h-px" style={{ background: "var(--terra)" }} />
            Curated for you
          </div>
          <h2
            className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-tight"
            style={{ color: "var(--ink)" }}
            data-testid="heading-clubs-section"
          >
            Clubs to check out
          </h2>
        </motion.div>
      </div>

      {isLoading ? (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <div className="flex gap-5 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[280px] sm:w-[300px] space-y-4"
                style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderRadius: "18px" }}
              >
                <Skeleton className="h-[120px] w-full rounded-t-[17px] rounded-b-none" />
                <div className="p-5 pt-0 space-y-3">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : clubs.length === 0 ? (
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-lg" style={{ color: "var(--muted-warm)" }}>No clubs yet. Be the first to start one!</p>
          </motion.div>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide px-4 sm:px-6"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", paddingLeft: "max(1.5rem, calc((100% - 1100px) / 2 + 1.5rem))" }}
            data-testid="scroll-clubs"
          >
            {clubs.map((club, i) => (
              <ScrollClubCard key={club.id} club={club} index={i} />
            ))}
            <div className="shrink-0 w-4" aria-hidden="true" />
          </div>

          <div
            className="pointer-events-none absolute top-0 right-0 bottom-0 w-16 sm:w-24"
            style={{ background: "linear-gradient(to right, transparent, var(--cream))" }}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 mt-8">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-all"
          style={{ color: "var(--terra)" }}
          data-testid="link-see-all-clubs"
        >
          See all clubs
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
