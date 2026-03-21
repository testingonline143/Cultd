import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Users, Plus, Repeat } from "lucide-react";
import { format, isToday, isSaturday, isSunday, isThisWeek } from "date-fns";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { Event, Club } from "@shared/schema";

const FILTERS = ["All", "Today", "This Weekend"] as const;
type Filter = (typeof FILTERS)[number];

interface EventWithRsvps extends Event {
  rsvpCount: number;
}

export default function Events() {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isOrganiser = user?.role === "organiser" || user?.role === "admin";

  const { data: events = [], isLoading: eventsLoading } = useQuery<EventWithRsvps[]>({
    queryKey: ["/api/events"],
  });

  const { data: clubsData } = useQuery<{ clubs: Club[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/clubs"],
  });
  const clubs = clubsData?.clubs ?? [];

  const clubMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const club of clubs) {
      map[club.id] = club.name;
    }
    return map;
  }, [clubs]);

  const filteredEvents = useMemo(() => {
    const now = new Date();
    let filtered = events.filter((e) => new Date(e.startsAt) >= now);

    if (activeFilter === "Today") {
      filtered = filtered.filter((e) => isToday(new Date(e.startsAt)));
    } else if (activeFilter === "This Weekend") {
      filtered = filtered.filter((e) => {
        const d = new Date(e.startsAt);
        return (isSaturday(d) || isSunday(d)) && isThisWeek(d, { weekStartsOn: 1 });
      });
    }

    return filtered.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );
  }, [events, activeFilter]);

  return (
    <div className="min-h-screen bg-background px-6 pt-6" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display italic text-3xl font-bold" style={{ color: "var(--ink)" }} data-testid="text-page-title">
          Event Schedule
        </h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar" data-testid="filter-pills">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            data-testid={`button-filter-${filter.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all"
            style={
              activeFilter === filter
                ? { background: "var(--ink)", color: "var(--cream)", border: "1.5px solid var(--ink)" }
                : { background: "var(--warm-white)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }
            }
          >
            {filter}
          </button>
        ))}
      </div>

      {eventsLoading ? (
        <div className="flex flex-col gap-4 mt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[18px] p-4 h-32 animate-pulse card-native" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20" data-testid="text-empty-state">
          <Calendar className="w-12 h-12 mb-3" style={{ color: "var(--muted-warm)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>No upcoming events</p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-warm)" }}>
            {activeFilter !== "All" ? "Try a different filter" : "Check back soon for new events"}
          </p>
          {isOrganiser && (
            <Link
              href="/create?tab=event"
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--terra)" }}
              data-testid="link-create-event"
            >
              <Plus className="w-4 h-4" />
              Create an Event
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {filteredEvents.map((event) => {
            const date = new Date(event.startsAt);
            return (
              <div
                key={event.id}
                className="card-native p-4 mb-4 flex gap-4 relative"
                data-testid={`card-event-${event.id}`}
              >
                <div className="flex-shrink-0 text-center w-16">
                  <div className="text-xs font-bold uppercase" style={{ color: "var(--terra)" }}>
                    {format(date, "EEE")}
                  </div>
                  <div className="font-mono text-[28px] leading-none" style={{ color: "var(--ink)", letterSpacing: "1px" }}>
                    {format(date, "d")}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-warm)" }}>
                    {format(date, "MMM")}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }} data-testid={`text-event-title-${event.id}`}>
                    {event.title}
                  </h3>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--terra)" }} data-testid={`text-club-name-${event.id}`}>
                    {clubMap[event.clubId] || "Unknown Club"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: "var(--muted-warm)" }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(date, "h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: "var(--muted-warm)" }}>
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{event.locationText}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: "var(--muted-warm)" }}>
                    <Users className="w-3.5 h-3.5" />
                    <span>{event.rsvpCount} / {event.maxCapacity} Joined</span>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => navigate(`/event/${event.id}`)}
                      className="text-sm font-bold"
                      style={{ color: "var(--terra)" }}
                      data-testid={`link-details-${event.id}`}
                    >
                      Details
                    </button>
                  </div>
                </div>

                <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)", border: "1px solid rgba(196,98,45,0.2)" }} data-testid={`badge-free-${event.id}`}>
                    FREE
                  </span>
                  {event.recurrenceRule && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(196,98,45,0.1)", color: "var(--terra)" }} data-testid={`badge-recurring-${event.id}`}>
                      <Repeat className="w-2.5 h-2.5" />
                      {event.recurrenceRule === "weekly" ? "Weekly" : event.recurrenceRule === "biweekly" ? "Bi-weekly" : "Monthly"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
