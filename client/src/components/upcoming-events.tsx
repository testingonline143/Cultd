import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Calendar, MapPin, Users, Share2 } from "lucide-react";

interface UpcomingEvent {
  id: string;
  clubId: string;
  title: string;
  description: string | null;
  locationText: string;
  startsAt: string;
  maxCapacity: number;
  clubName: string;
  clubEmoji: string;
  rsvpCount: number;
}

export function UpcomingEvents() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [justRsvpdId, setJustRsvpdId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useQuery<UpcomingEvent[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const res = await fetch("/api/events?limit=6");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/rsvp`);
      if (!res.ok) throw new Error("Failed to RSVP");
      return res.json();
    },
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setJustRsvpdId(eventId);
    },
  });

  if (isLoading || events.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const handleShareEvent = (event: UpcomingEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/event/${event.id}`;
    const text = `I'm going to ${event.title} with ${event.clubName}! Join me: ${url}`;
    if (navigator.share) {
      navigator.share({ title: event.title, text: `I'm going to ${event.title} with ${event.clubName}! Join me`, url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-10" data-testid="section-upcoming-events">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }} data-testid="text-events-title">
          Happening Soon
        </h2>
        <a href="/events" className="text-[11px] font-bold tracking-[1px] uppercase" style={{ color: "var(--terra)" }} data-testid="link-view-all-events">
          View All &rarr;
        </a>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {events.map((event, index) => {
          const spotsLeft = event.maxCapacity - event.rsvpCount;
          const isJustRsvpd = justRsvpdId === event.id;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex-shrink-0 w-72 rounded-2xl overflow-hidden transition-all cursor-pointer"
              style={{ background: "var(--ink)", borderRadius: "20px" }}
              onClick={() => navigate(`/event/${event.id}`)}
              data-testid={`card-event-${event.id}`}
            >
              <div className="relative h-[140px] flex items-center justify-center text-[52px]" style={{ background: "linear-gradient(135deg, #2D1A0A, #4A2A12)" }}>
                <span className="relative z-10">{event.clubEmoji}</span>
                <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, var(--ink) 100%)" }} />
              </div>
              <div className="p-4 pt-0">
                <div className="text-[10px] font-semibold tracking-[1.5px] uppercase mb-1.5" style={{ color: "var(--terra-light)" }}>{event.clubName}</div>
                <h3 className="font-display font-bold text-sm mb-2 line-clamp-2" style={{ color: "var(--cream)" }}>{event.title}</h3>
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-warm2)" }}>
                    <Calendar className="w-3 h-3" />
                    {formatDate(event.startsAt)} {"\u00B7"} {formatTime(event.startsAt)}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-warm2)" }}>
                    <MapPin className="w-3 h-3" />
                    {event.locationText}
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-warm2)" }}>
                    <Users className="w-3 h-3" />
                    {event.rsvpCount} going {"\u00B7"} {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
                  </div>
                </div>
                {isJustRsvpd ? (
                  <button
                    onClick={(e) => handleShareEvent(event, e)}
                    className="w-full rounded-[10px] py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
                    style={{ background: "var(--terra-pale)", color: "var(--terra-light)", border: "1px solid rgba(196,98,45,0.3)" }}
                    data-testid={`button-share-rsvp-${event.id}`}
                  >
                    <Share2 className="w-3 h-3" />
                    You're in! Share with friends
                  </button>
                ) : isAuthenticated && spotsLeft > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); rsvpMutation.mutate(event.id); }}
                    disabled={rsvpMutation.isPending}
                    className="w-full rounded-[10px] py-2 text-xs font-semibold disabled:opacity-50"
                    style={{ background: "var(--terra)", color: "white" }}
                    data-testid={`button-rsvp-${event.id}`}
                  >
                    Count Me In
                  </button>
                ) : !isAuthenticated ? (
                  <p className="text-[10px] text-center italic" style={{ color: "var(--muted-warm2)" }}>Sign in to RSVP</p>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
