import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { MapPin, Users, Crosshair, Search, ChevronRight, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { apiRequest } from "@/lib/queryClient";
import type { Club } from "@shared/schema";

interface MatchedClub extends Club {
  matchScore: number;
}

export default function MatchedClubs() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const { data: matchedClubs = [], isLoading } = useQuery<MatchedClub[]>({
    queryKey: ["/api/quiz/matches"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/quiz/matches");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--terra-pale)" }}
          >
            <Crosshair className="w-7 h-7" style={{ color: "var(--terra)" }} />
          </div>
          <h1
            className="font-display text-2xl font-bold mb-2"
            style={{ color: "var(--ink)" }}
            data-testid="text-matches-title"
          >
            Your Top Matches{user?.city ? ` in ${user.city}` : ""}
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>
            These clubs match your interests. Tap <strong>Join Club</strong> to send a request.
          </p>
        </div>

        {/* Club list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl animate-pulse"
                style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
              />
            ))}
          </div>
        ) : matchedClubs.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--terra-pale)" }}
            >
              <Search className="w-7 h-7" style={{ color: "var(--terra)" }} />
            </div>
            <h3
              className="font-display text-lg font-bold mb-2"
              style={{ color: "var(--ink)" }}
            >
              No matches yet
            </h3>
            <p className="text-sm mb-4 px-4" style={{ color: "var(--muted-warm)" }}>
              More clubs are being added. Browse all available clubs now!
            </p>
            <button
              onClick={() => navigate("/explore")}
              className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--terra)" }}
              data-testid="button-browse-all"
            >
              Browse All Clubs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {matchedClubs.map((club, index) => (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="rounded-2xl p-5"
                style={{
                  background: "var(--warm-white)",
                  border: "1.5px solid var(--warm-border)",
                }}
                data-testid={`card-match-${club.id}`}
              >
                <div className="flex items-start gap-4">
                  {/* Club emoji */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
                    style={{ background: "var(--terra-pale)" }}
                  >
                    {club.emoji}
                  </div>

                  {/* Club info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3
                        className="font-display font-bold truncate"
                        style={{ color: "var(--ink)" }}
                        data-testid={`text-match-name-${club.id}`}
                      >
                        {club.name}
                      </h3>
                      <span
                        className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          background: "var(--terra-pale)",
                          color: "var(--terra)",
                          border: "1px solid rgba(196,98,45,0.3)",
                        }}
                        data-testid={`badge-match-score-${club.id}`}
                      >
                        <Sparkles className="w-3 h-3" />
                        {club.matchScore}% match
                      </span>
                    </div>
                    <p
                      className="text-sm line-clamp-2 mb-3"
                      style={{ color: "var(--muted-warm)" }}
                    >
                      {club.shortDesc}
                    </p>
                    <div
                      className="flex items-center gap-3 text-xs flex-wrap mb-4"
                      style={{ color: "var(--muted-warm)" }}
                    >
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {club.memberCount} members
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {club.city || club.location}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: "var(--cream2)", color: "var(--ink)" }}
                      >
                        {club.category}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/club/${club.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
                        style={{ background: "var(--terra)" }}
                        data-testid={`button-join-${club.id}`}
                      >
                        Join Club
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/club/${club.id}`}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                        style={{
                          background: "var(--cream)",
                          border: "1.5px solid var(--warm-border)",
                          color: "var(--ink)",
                        }}
                        data-testid={`button-view-${club.id}`}
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 space-y-3">
          <button
            onClick={() => navigate("/home")}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] transition-all active:scale-95"
            style={{ background: "var(--ink)" }}
            data-testid="button-go-to-feed"
          >
            Go to Feed →
          </button>
          <div className="text-center">
            <button
              onClick={() => navigate("/explore")}
              className="text-sm font-medium hover:underline"
              style={{ color: "var(--terra)" }}
              data-testid="link-explore-all"
            >
              Explore All Clubs →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
