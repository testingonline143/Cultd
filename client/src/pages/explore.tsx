import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Users, MapPin, Calendar, PlusCircle, X, Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { CATEGORIES, CITIES, CATEGORY_EMOJI } from "@shared/schema";
import type { Club } from "@shared/schema";
import { CATEGORY_GRADIENTS, DEFAULT_GRADIENT } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 20;

const ALL_CATEGORIES = ["All", ...CATEGORIES];

function ProposeClubModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    clubName: "",
    category: "",
    vibe: "casual",
    shortDesc: "",
    city: "Tirupati",
    schedule: "",
    motivation: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/club-proposals", form),
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/club-proposals/mine"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to submit proposal", variant: "destructive" });
    },
  });

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
        <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 text-center space-y-4 animate-in slide-in-from-bottom" style={{ background: "var(--cream)" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(22,163,74,0.12)" }}>
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>Proposal Submitted!</h2>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>
            We'll review your club proposal and get back to you soon. You can check the status on your Profile page.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: "var(--terra)" }}
            data-testid="button-proposal-done"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  const canGoNext = step === 1
    ? form.clubName.length >= 3 && form.category && form.shortDesc
    : form.schedule && form.motivation;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-20 sm:p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[85vh]" style={{ background: "var(--cream)" }}>
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: "var(--warm-border)" }}>
          <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>Propose a Club</h2>
          <button onClick={onClose} className="p-1 rounded-lg" data-testid="button-close-proposal"><X className="w-5 h-5" style={{ color: "var(--muted-warm)" }} /></button>
        </div>

        <div className="flex gap-1 px-4 pt-3 shrink-0">
          <div className="h-1 flex-1 rounded-full" style={{ background: "var(--terra)" }} />
          <div className="h-1 flex-1 rounded-full" style={{ background: step >= 2 ? "var(--terra)" : "var(--warm-border)" }} />
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {step === 1 ? (
            <>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Club Name</label>
                <input
                  value={form.clubName}
                  onChange={e => set("clubName", e.target.value)}
                  placeholder="e.g. Tirupati Trail Runners"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                  data-testid="input-proposal-name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => set("category", cat)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={form.category === cat
                        ? { background: "var(--ink)", color: "var(--cream)", border: "1.5px solid var(--ink)" }
                        : { background: "var(--warm-white)", color: "var(--ink3)", border: "1.5px solid var(--warm-border)" }
                      }
                      data-testid={`proposal-cat-${cat.toLowerCase()}`}
                    >
                      {CATEGORY_EMOJI[cat]} {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Vibe</label>
                <div className="flex gap-2">
                  {["casual", "competitive"].map(v => (
                    <button
                      key={v}
                      onClick={() => set("vibe", v)}
                      className="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all"
                      style={form.vibe === v
                        ? { background: "var(--ink)", color: "var(--cream)", border: "1.5px solid var(--ink)" }
                        : { background: "var(--warm-white)", color: "var(--ink3)", border: "1.5px solid var(--warm-border)" }
                      }
                      data-testid={`proposal-vibe-${v}`}
                    >
                      {v === "casual" ? "😌 Casual" : "🔥 Competitive"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Short Description</label>
                <textarea
                  value={form.shortDesc}
                  onChange={e => set("shortDesc", e.target.value)}
                  placeholder="What's this club about?"
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                  data-testid="input-proposal-desc"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>City</label>
                <select
                  value={form.city}
                  onChange={e => set("city", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                  data-testid="select-proposal-city"
                >
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Intended Schedule</label>
                <input
                  value={form.schedule}
                  onChange={e => set("schedule", e.target.value)}
                  placeholder="e.g. Every Saturday morning 6 AM"
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2"
                  style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                  data-testid="input-proposal-schedule"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Why do you want to run this club?</label>
                <textarea
                  value={form.motivation}
                  onChange={e => set("motivation", e.target.value)}
                  placeholder="Tell us your passion and experience..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none"
                  style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                  data-testid="input-proposal-motivation"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t shrink-0" style={{ borderColor: "var(--warm-border)" }}>
          {step === 2 && (
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--warm-white)", color: "var(--ink)", border: "1.5px solid var(--warm-border)" }}
              data-testid="button-proposal-back"
            >
              Back
            </button>
          )}
          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!canGoNext}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: "var(--terra)" }}
              data-testid="button-proposal-next"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => mutation.mutate()}
              disabled={!canGoNext || mutation.isPending}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 inline-flex items-center justify-center gap-2"
              style={{ background: "var(--terra)" }}
              data-testid="button-proposal-submit"
            >
              {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Submit Proposal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ClubsPage {
  clubs: (Club & { recentJoins?: number })[];
  total: number;
  page: number;
  limit: number;
}

export default function Explore() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeCity, setActiveCity] = useState("All Cities");
  const [activeVibe, setActiveVibe] = useState("all");
  const [activeTimeOfDay, setActiveTimeOfDay] = useState("all");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [page, setPage] = useState(1);
  const [allClubs, setAllClubs] = useState<(Club & { recentJoins?: number })[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const buildParams = (p: number) => {
    const queryParams = new URLSearchParams();
    if (search) queryParams.set("search", search);
    if (activeCategory !== "All") queryParams.set("category", activeCategory);
    if (activeCity !== "All Cities") queryParams.set("city", activeCity);
    if (activeVibe !== "all") queryParams.set("vibe", activeVibe);
    if (activeTimeOfDay !== "all") queryParams.set("timeOfDay", activeTimeOfDay);
    queryParams.set("page", String(p));
    queryParams.set("limit", String(PAGE_SIZE));
    return queryParams;
  };

  const { data, isLoading, isFetching } = useQuery<ClubsPage>({
    queryKey: ["/api/clubs-with-activity", search, activeCategory, activeCity, activeVibe, activeTimeOfDay, page],
    queryFn: async () => {
      const res = await fetch(`/api/clubs-with-activity?${buildParams(page).toString()}`);
      if (!res.ok) throw new Error("Failed to fetch clubs");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const resetFilters = useCallback(() => {
    setPage(1);
    setAllClubs([]);
  }, []);

  const handleFilterChange = useCallback((fn: () => void) => {
    fn();
    setPage(1);
    setAllClubs([]);
  }, []);

  const currentPageClubs = data?.clubs ?? [];
  const total = data?.total ?? 0;

  const clubs = page === 1
    ? currentPageClubs
    : [...allClubs, ...currentPageClubs.filter(c => !allClubs.find(a => a.id === c.id))];

  const hasMore = clubs.length < total;

  function loadMore() {
    setAllClubs(clubs);
    setPage(p => p + 1);
  }

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <div
        className="sticky top-0 z-40 max-w-lg mx-auto px-6 pt-6 pb-3"
        style={{
          background: "rgba(245,240,232,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))",
          boxShadow: scrolled ? "0 1px 0 rgba(26,20,16,0.10)" : "none",
          transition: "box-shadow 0.2s ease",
        }}
      >
        <h1 className="font-display italic text-3xl font-bold mb-4" style={{ color: "var(--ink)" }} data-testid="text-explore-title">
          Discover Clubs
        </h1>

        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-warm)" }} />
          <input
            type="text"
            placeholder="Search tribes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); setAllClubs([]); }}
            className="w-full pl-10 pr-4 focus:outline-none focus:ring-2 placeholder:opacity-60 no-scrollbar"
            style={{
              height: 48,
              borderRadius: 999,
              background: "var(--warm-white)",
              boxShadow: "0 2px 10px rgba(26,20,16,0.07), 0 1px 3px rgba(26,20,16,0.05)",
              border: "none",
              color: "var(--ink)",
              fontSize: 14,
              "--tw-ring-color": "rgba(196,98,45,0.3)",
            } as React.CSSProperties}
            data-testid="input-explore-search"
          />
        </div>

        <div className="relative mb-4" data-testid="filter-categories">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleFilterChange(() => setActiveCategory(cat))}
                className="flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-all"
                style={
                  activeCategory === cat
                    ? { background: "var(--ink)", color: "var(--cream)", border: "1.5px solid var(--ink)" }
                    : { background: "var(--warm-white)", color: "var(--ink3)", border: "1.5px solid var(--warm-border)" }
                }
                data-testid={`filter-cat-${cat.toLowerCase()}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <select
            value={activeCity}
            onChange={(e) => handleFilterChange(() => setActiveCity(e.target.value))}
            className="px-3 py-2 text-sm focus:outline-none focus:ring-2"
            style={{
              borderRadius: 999,
              background: "var(--warm-white)",
              boxShadow: "0 2px 8px rgba(26,20,16,0.06)",
              border: "none",
              color: "var(--ink)",
              "--tw-ring-color": "rgba(196,98,45,0.3)",
            } as React.CSSProperties}
            data-testid="select-explore-city"
          >
            <option value="All Cities">All Cities</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="flex rounded-full overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(26,20,16,0.06)", background: "var(--warm-white)" }} data-testid="toggle-vibe">
            {[
              { value: "all", label: "All" },
              { value: "casual", label: "Casual" },
              { value: "competitive", label: "Competitive" },
            ].map((v) => (
              <button
                key={v.value}
                onClick={() => handleFilterChange(() => setActiveVibe(v.value))}
                className="px-3 py-2 text-xs font-medium transition-all"
                style={
                  activeVibe === v.value
                    ? { background: "var(--ink)", color: "var(--cream)" }
                    : { color: "var(--muted-warm)" }
                }
                data-testid={`vibe-filter-${v.value}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap" data-testid="filter-time-of-day">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Time:</span>
          <div className="flex rounded-full overflow-hidden" style={{ boxShadow: "0 2px 8px rgba(26,20,16,0.06)", background: "var(--warm-white)" }}>
            {[
              { value: "all", label: "Any" },
              { value: "morning", label: "Morning" },
              { value: "evening", label: "Evening" },
              { value: "weekends", label: "Weekends" },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => handleFilterChange(() => setActiveTimeOfDay(t.value))}
                className="px-3 py-2 text-xs font-medium transition-all"
                style={
                  activeTimeOfDay === t.value
                    ? { background: "var(--ink)", color: "var(--cream)" }
                    : { color: "var(--muted-warm)" }
                }
                data-testid={`time-filter-${t.value}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 pt-4">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-[18px] animate-pulse card-native" data-testid={`skeleton-club-${i}`} />
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--terra-pale)" }}>
              <Search className="w-7 h-7" style={{ color: "var(--terra)" }} />
            </div>
            <h3 className="font-display text-lg font-bold mb-2" style={{ color: "var(--ink)" }} data-testid="text-no-clubs">No clubs found</h3>
            <p className="text-sm mb-4" style={{ color: "var(--muted-warm)" }}>Try different filters or search terms</p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  setSearch("");
                  setActiveCategory("All");
                  setActiveCity("All Cities");
                  setActiveVibe("all");
                  setActiveTimeOfDay("all");
                  setPage(1);
                  setAllClubs([]);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </button>
              {isAuthenticated && (
                <button
                  onClick={() => setShowProposalModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: "var(--terra)" }}
                  data-testid="button-propose-empty-state"
                >
                  <PlusCircle className="w-4 h-4" />
                  Propose a Club
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {clubs.filter(c => c.isActive !== false).map((club) => {
              const gradient = CATEGORY_GRADIENTS[club.category] || DEFAULT_GRADIENT;
              return (
                <Link
                  key={club.id}
                  href={`/club/${club.id}`}
                  className="block"
                  data-testid={`card-club-${club.id}`}
                >
                  <div className="rounded-[18px] overflow-hidden hover-elevate card-native">
                    <div className="relative h-48 flex items-center justify-center" style={{ background: gradient }}>
                      <span className="text-6xl select-none" data-testid={`emoji-club-${club.id}`}>{club.emoji}</span>
                      <span className="absolute top-3 left-3 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[1.5px] uppercase text-white" style={{ background: "var(--terra)" }} data-testid={`badge-category-${club.id}`}>
                        {club.category}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }} data-testid={`text-club-name-${club.id}`}>
                        {club.name}
                      </h3>
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: "var(--muted-warm)" }} data-testid={`text-club-desc-${club.id}`}>
                        {club.shortDesc}
                      </p>
                      <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--muted-warm)" }}>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {club.schedule}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {club.city}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--terra)" }} data-testid={`badge-members-${club.id}`}>
                            <Users className="w-3.5 h-3.5" />
                            {club.memberCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={isFetching}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "var(--warm-white)", color: "var(--terra)", border: "1.5px solid var(--terra)" }}
                data-testid="button-load-more-clubs"
              >
                {isFetching ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</> : `Load more (${total - clubs.length} left)`}
              </button>
            )}

            {isAuthenticated && (
              <button
                onClick={() => setShowProposalModal(true)}
                className="w-full text-left"
                data-testid="card-propose-club"
              >
                <div className="rounded-[18px] p-6 text-center space-y-3" style={{ background: "var(--terra-pale)", border: "1.5px dashed rgba(196,98,45,0.4)" }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(196,98,45,0.15)" }}>
                    <PlusCircle className="w-6 h-6" style={{ color: "var(--terra)" }} />
                  </div>
                  <h3 className="font-display text-base font-bold" style={{ color: "var(--terra)" }}>
                    Don't see your hobby?
                  </h3>
                  <p className="text-xs" style={{ color: "var(--muted-warm)" }}>
                    Propose a new club and we'll help you get started!
                  </p>
                  <span className="inline-block text-sm font-semibold" style={{ color: "var(--terra)" }}>
                    Propose a Club
                  </span>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {showProposalModal && <ProposeClubModal onClose={() => setShowProposalModal(false)} />}
    </div>
  );
}
