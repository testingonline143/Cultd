import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Calendar, Users, Clock, ArrowRight, Loader2, Star, MessageCircle, X, LogIn, Share2 } from "lucide-react";
import type { Club, ClubAnnouncement, ClubScheduleEntry, ClubMoment, ClubPageSection } from "@shared/schema";

interface SectionEvent {
  id: string;
  eventId: string;
  title: string;
  startsAt: string;
  location: string;
  position: number;
}

interface PublicPageData {
  club: Club;
  sections: (ClubPageSection & { events: SectionEvent[] })[];
  announcements: ClubAnnouncement[];
  schedule: ClubScheduleEntry[];
  moments: ClubMoment[];
  memberCount: number;
  upcomingEventCount: number;
  pastEventCount: number;
  rating: number | null;
}

export default function PublicClub() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const { data, isLoading, error } = useQuery<PublicPageData>({
    queryKey: ["/api/c", slug],
    queryFn: async () => {
      const res = await fetch(`/api/c/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--terra)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="font-display text-2xl font-bold text-[var(--ink)] mb-2" data-testid="text-page-not-found">Page not found</h1>
          <p className="text-sm text-[var(--muted-warm)] mb-6">This club page doesn't exist or hasn't been set up yet.</p>
          <Link href="/explore" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "var(--terra)" }} data-testid="link-explore">
            Explore Clubs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const { club, sections, announcements, schedule, moments, memberCount, upcomingEventCount, pastEventCount, rating } = data;
  const pinnedAnnouncement = announcements.find(a => a.isPinned);
  const totalEvents = (pastEventCount || 0) + (upcomingEventCount || 0);

  useEffect(() => {
    document.title = `${club.emoji} ${club.name} | CultFam`;
    return () => { document.title = "CultFam - Find Your Tribe"; };
  }, [club.name, club.emoji]);

  const shareUrl = `${window.location.origin}/c/${slug}`;
  const waInviteText = encodeURIComponent(`Hey! Check out ${club.emoji} ${club.name} on CultFam — looks like a great community! 🙌\n${shareUrl}`);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => setShowShareSheet(false))
      .catch(() => window.prompt("Copy this link:", shareUrl));
  };
  const handleNativeShare = () => {
    navigator.share({ title: club.name, text: `Check out ${club.emoji} ${club.name} on CultFam!`, url: shareUrl })
      .catch(() => {})
      .finally(() => setShowShareSheet(false));
  };

  const handleJoinClick = () => {
    if (isAuthenticated) {
      navigate(`/club/${club.id}`);
    } else {
      setShowSignIn(true);
    }
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--cream)" }}>
      <div className="relative h-64 w-full overflow-hidden">
        <button
          onClick={() => setShowShareSheet(true)}
          className="absolute top-12 right-4 z-10 w-9 h-9 rounded-xl bg-white/80 backdrop-blur-sm flex items-center justify-center"
          style={{ border: "1px solid var(--warm-border)" }}
          data-testid="button-share-public-club"
        >
          <Share2 className="w-4 h-4 text-[var(--ink)]" />
        </button>
        {club.coverImageUrl ? (
          <>
            <img src={club.coverImageUrl} alt={club.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-[var(--cream)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#E8D5B8] via-[#C4A882] to-[#A88860] flex items-center justify-center">
              <span className="text-[80px] select-none">{club.emoji}</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--cream)]" style={{ top: '30%' }} />
          </>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-[5]">
          <span className="inline-flex items-center gap-1.5 text-white text-[10px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-md mb-1.5" style={{ background: 'var(--terra)' }} data-testid="badge-category">
            {club.category}
          </span>
          <h1 className="font-display text-3xl font-black text-[var(--ink)] leading-[0.95] tracking-tight" data-testid="text-club-name">
            {club.name}
          </h1>
          {club.shortDesc && (
            <p className="font-display text-[13px] italic text-[var(--ink3)] mt-1.5" data-testid="text-tagline">{club.shortDesc}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-6 mt-3">
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[20px] leading-none tracking-wide text-[var(--terra)]" data-testid="text-member-count">{memberCount}</div>
          <div className="text-[9px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Members</div>
        </div>
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[20px] leading-none tracking-wide text-[var(--gold)]" data-testid="text-rating">
            {typeof rating === 'number' ? rating.toFixed(1) : '—'}
          </div>
          <div className="text-[9px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Rating</div>
        </div>
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[20px] leading-none tracking-wide text-[var(--ink)]" data-testid="text-events-done">{pastEventCount || 0}</div>
          <div className="text-[9px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Events Done</div>
        </div>
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[20px] leading-none tracking-wide text-[var(--ink)]" data-testid="text-founding-spots">
            {Math.max(0, (club.foundingTotal || 20) - (club.foundingTaken || 0))}
          </div>
          <div className="text-[9px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Spots Left</div>
        </div>
      </div>

      {(club.schedule || club.location) && (
        <div className="flex items-center gap-3 px-6 mt-3">
          {club.schedule && (
            <span className="flex items-center gap-1 text-xs text-[var(--muted-warm)]" data-testid="text-schedule">
              <Clock className="w-3 h-3 text-[var(--terra)]" /> {club.schedule}
            </span>
          )}
          {club.location && (
            <span className="flex items-center gap-1 text-xs text-[var(--muted-warm)]" data-testid="text-location">
              <MapPin className="w-3 h-3 text-[var(--terra)]" /> {club.location}
            </span>
          )}
        </div>
      )}

      {club.whatsappNumber && (
        <div className="px-6 mt-3">
          <a
            href={`https://wa.me/${club.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'd love to join ${club.name}. I found your page! 🙌`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1.5px solid rgba(37,211,102,0.35)', color: '#1A8A3A' }}
            data-testid="button-whatsapp"
          >
            <MessageCircle className="w-4 h-4" />
            Chat on WhatsApp
          </a>
        </div>
      )}

      {pinnedAnnouncement && (
        <div className="mx-6 mt-3 rounded-2xl p-3.5 flex items-start gap-3" style={{ background: "var(--terra-pale)", border: "1.5px solid rgba(196,98,45,0.25)" }} data-testid="banner-pinned">
          <span className="text-lg shrink-0 mt-0.5">📢</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--ink)]">{pinnedAnnouncement.title}</p>
            {pinnedAnnouncement.body && <p className="text-xs text-[var(--ink3)] mt-0.5">{pinnedAnnouncement.body}</p>}
          </div>
        </div>
      )}

      {club.fullDesc && (
        <div className="px-6 mt-5">
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-2">About</h2>
          <p className="text-sm text-[var(--ink3)] leading-relaxed" data-testid="text-full-desc">{club.fullDesc}</p>
        </div>
      )}

      {sections.length > 0 && sections.map((section) => (
        <div key={section.id} className="px-6 mt-5" data-testid={`section-${section.id}`}>
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>{section.emoji}</span> {section.title}
          </h2>
          {section.description && <p className="text-sm text-[var(--ink3)] mb-3">{section.description}</p>}
          {section.events.length > 0 ? (
            <SectionEventRenderer events={section.events} layout={section.layout || "full"} />
          ) : (
            <p className="text-xs text-[var(--muted-warm)] italic">No events in this section yet.</p>
          )}
        </div>
      ))}

      {schedule.length > 0 && (
        <div className="px-6 mt-5">
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Weekly Schedule
          </h2>
          <div className="space-y-2">
            {schedule.map((entry) => (
              <div key={entry.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
                <div className="w-12 text-center">
                  <div className="text-[10px] font-bold text-[var(--terra)] uppercase">{entry.dayOfWeek.slice(0, 3)}</div>
                  <div className="text-xs text-[var(--muted-warm)]">{entry.startTime}</div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--ink)]">{entry.activity}</div>
                  {entry.location && <div className="text-xs text-[var(--muted-warm)]">{entry.location}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {moments.length > 0 && (
        <div className="px-6 mt-5">
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> Recent Moments
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {moments.filter(m => m.imageUrl).slice(0, 4).map((m) => (
              <div key={m.id} className="rounded-xl overflow-hidden aspect-square relative" data-testid={`moment-${m.id}`}>
                <img src={m.imageUrl!} alt={m.caption || ""} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                {m.caption && (
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-[10px] text-white line-clamp-2">{m.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {moments.filter(m => !m.imageUrl).length > 0 && (
            <div className="space-y-2 mt-2">
              {moments.filter(m => !m.imageUrl).slice(0, 3).map((m) => (
                <div key={m.id} className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
                  <span className="text-lg">{m.emoji || "✨"}</span>
                  <p className="text-sm text-[var(--ink3)]">{m.caption}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-center mt-8 pb-4">
        <p className="text-[10px] text-[var(--muted-warm)] tracking-wider">Powered by <span className="font-bold text-[var(--terra)]">CultFam</span></p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40" style={{ background: "linear-gradient(to top, var(--cream) 80%, transparent)" }}>
        <div className="px-6 pb-6 pt-3">
          <button
            onClick={handleJoinClick}
            className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] shadow-lg"
            style={{ background: "var(--terra)" }}
            data-testid="button-join-club"
          >
            <Users className="w-4 h-4" />
            {isAuthenticated ? "View Full Club & Join" : "Join Club"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showShareSheet && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowShareSheet(false)} data-testid="overlay-share-sheet-public" />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-3 pb-10"
            style={{ background: "var(--warm-white)", borderTop: "1.5px solid var(--warm-border)", maxWidth: 480, margin: "0 auto" }}
            data-testid="sheet-share-public"
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--warm-border)" }} />
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>Share Club</h3>
              <button onClick={() => setShowShareSheet(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--cream)" }} data-testid="button-close-share-public">
                <X className="w-4 h-4" style={{ color: "var(--ink)" }} />
              </button>
            </div>
            <div className="space-y-3">
              <a
                href={`https://wa.me/?text=${waInviteText}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowShareSheet(false)}
                className="flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]"
                style={{ background: "rgba(37,211,102,0.1)", border: "1.5px solid rgba(37,211,102,0.3)", textDecoration: "none" }}
                data-testid="button-share-whatsapp-public"
              >
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.15)" }}>
                  <MessageCircle className="w-5 h-5" style={{ color: "#1A8A3A" }} />
                </div>
                <div>
                  <p className="font-bold text-[14px]" style={{ color: "#1A8A3A" }}>Share on WhatsApp</p>
                  <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>Send to friends and family</p>
                </div>
              </a>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-4 p-4 rounded-2xl w-full text-left transition-all active:scale-[0.98]"
                style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                data-testid="button-copy-link-public"
              >
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "var(--terra-pale)" }}>
                  <Share2 className="w-5 h-5" style={{ color: "var(--terra)" }} />
                </div>
                <div>
                  <p className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>Copy Link</p>
                  <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{shareUrl.replace("https://", "")}</p>
                </div>
              </button>
              {typeof navigator.share === "function" && (
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-4 p-4 rounded-2xl w-full text-left transition-all active:scale-[0.98]"
                  style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                  data-testid="button-share-native-public"
                >
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,107,69,0.1)" }}>
                    <Share2 className="w-5 h-5" style={{ color: "var(--green-accent)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>More Options</p>
                    <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>Share via any app</p>
                  </div>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {showSignIn && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowSignIn(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 pt-3 animate-in slide-in-from-bottom duration-300" style={{ background: "var(--warm-white)" }} data-testid="sheet-sign-in">
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--warm-border)" }} />
            <button onClick={() => setShowSignIn(false)} className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--cream)" }} data-testid="button-close-signin">
              <X className="w-4 h-4 text-[var(--ink)]" />
            </button>
            <div className="text-center mb-5">
              <span className="text-4xl">{club.emoji}</span>
              <h3 className="font-display text-xl font-bold text-[var(--ink)] mt-2" data-testid="text-signin-title">Join {club.name}</h3>
              <p className="text-sm text-[var(--muted-warm)] mt-1">Sign in to request membership and join the community</p>
            </div>
            <a
              href={`/api/login?returnTo=/c/${slug}`}
              className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]"
              style={{ background: "var(--terra)", textDecoration: "none" }}
              data-testid="button-signin-action"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </a>
            <p className="text-center text-[10px] text-[var(--muted-warm)] mt-3">You'll be redirected back here after signing in</p>
          </div>
        </>
      )}
    </div>
  );
}

function SectionEventRenderer({ events, layout }: { events: SectionEvent[]; layout: string }) {
  if (layout === "scroll") {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
        {events.map((evt) => (
          <Link key={evt.id} href={`/event/${evt.eventId}`} className="block rounded-xl p-3 shrink-0 w-[200px]" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", textDecoration: "none", scrollSnapAlign: "start" }} data-testid={`link-event-${evt.eventId}`}>
            <div className="font-display text-sm font-bold text-[var(--ink)] line-clamp-2">{evt.title}</div>
            <div className="mt-1.5">
              <span className="text-xs text-[var(--muted-warm)] flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(evt.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              {evt.location && <span className="text-xs text-[var(--muted-warm)] flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{evt.location}</span>}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (layout === "list") {
    return (
      <div className="space-y-1.5">
        {events.map((evt) => (
          <Link key={evt.id} href={`/event/${evt.eventId}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", textDecoration: "none" }} data-testid={`link-event-${evt.eventId}`}>
            <Calendar className="w-4 h-4 text-[var(--terra)] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[var(--ink)] truncate">{evt.title}</div>
            </div>
            <span className="text-xs text-[var(--muted-warm)] shrink-0">{new Date(evt.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((evt) => (
        <Link key={evt.id} href={`/event/${evt.eventId}`} className="block rounded-xl p-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", textDecoration: "none" }} data-testid={`link-event-${evt.eventId}`}>
          <div className="font-display text-sm font-bold text-[var(--ink)]">{evt.title}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[var(--muted-warm)] flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(evt.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            {evt.location && <span className="text-xs text-[var(--muted-warm)] flex items-center gap-1"><MapPin className="w-3 h-3" />{evt.location}</span>}
          </div>
        </Link>
      ))}
    </div>
  );
}
