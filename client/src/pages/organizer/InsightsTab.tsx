import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BarChart3, TrendingUp, TrendingDown, Medal, UserCheck, Users, Calendar, ClipboardList } from "lucide-react";

interface InsightsData {
  totalMembers: number;
  pendingRequests: number;
  totalEvents: number;
  avgAttendanceRate: number;
  topEvent: { title: string; attended: number; total: number } | null;
  recentJoins: { name: string; date: string | null }[];
  recentRsvps: { userName: string; eventTitle: string; date: string | null }[];
}

interface AnalyticsData {
  memberGrowth: { week: string; count: number }[];
  perEventStats: { id: string; title: string; date: string; rsvps: number; attended: number; rate: number; isCancelled: boolean | null }[];
  mostActiveMembers: { name: string; rsvpCount: number }[];
  engagementRate: number;
  noShowRate: number;
}

type SurveySummaryRow = { eventId: string; eventTitle: string; eventDate: string; responseCount: number };

type OrganizerTab = "overview" | "requests" | "insights" | "events" | "content" | "edit" | "announcements" | "members";

export default function InsightsTab({ clubId, setActiveTab }: { clubId: string; setActiveTab?: (tab: OrganizerTab) => void }) {
  const { data: insights, isLoading: insightsLoading } = useQuery<InsightsData>({
    queryKey: ["/api/organizer/clubs", clubId, "insights"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/insights`);
      return res.json();
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/organizer/clubs", clubId, "analytics"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/analytics`);
      return res.json();
    },
  });

  const { data: surveySummary = [] } = useQuery<SurveySummaryRow[]>({
    queryKey: ["/api/organizer/clubs", clubId, "survey-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/survey-summary`);
      return res.json();
    },
  });

  const isLoading = insightsLoading || analyticsLoading;

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-24 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
      ))}
    </div>
  );

  if (!insights) return (
    <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-insights">
      Unable to load insights.
    </div>
  );

  const maxGrowth = analytics ? Math.max(...analytics.memberGrowth.map(w => w.count), 1) : 1;

  return (
    <div className="space-y-4" data-testid="section-organizer-insights">

      {/* ── Section 1: Key Metrics ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-insight-members">{insights.totalMembers}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Members</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-chart-4 font-mono" data-testid="text-insight-pending">{insights.pendingRequests}</div>
          <div className="text-xs text-muted-foreground mt-1">Pending Requests</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-insight-events">{insights.totalEvents}</div>
          <div className="text-xs text-muted-foreground mt-1">Events Created</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--green-accent)] font-mono" data-testid="text-insight-attendance">{insights.avgAttendanceRate}%</div>
          <div className="text-xs text-muted-foreground mt-1">Avg Attendance</div>
        </div>
      </div>

      {/* ── Section 2: Engagement Health ── */}
      {analytics && insights.totalEvents > 0 && (
        <div className="grid grid-cols-2 gap-3" data-testid="section-engagement-health">
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <UserCheck className="w-3.5 h-3.5 text-[var(--terra)]" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engagement</span>
            </div>
            <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-engagement-rate">{analytics.engagementRate}%</div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">members who've RSVPd to at least one event</div>
          </div>
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }}>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No-Shows</span>
            </div>
            <div className="text-2xl font-bold text-destructive font-mono" data-testid="text-noshow-rate">{analytics.noShowRate}%</div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">avg RSVPs that didn't check in</div>
          </div>
        </div>
      )}

      {/* ── Section 3: Member Growth Chart ── */}
      {analytics && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-member-growth">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Growth (last 8 weeks)</span>
          </div>
          <div className="flex items-end gap-1.5 h-20" data-testid="chart-member-growth">
            {analytics.memberGrowth.map((bar, i) => {
              const heightPct = maxGrowth > 0 ? Math.max((bar.count / maxGrowth) * 100, bar.count > 0 ? 8 : 3) : 3;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-full flex flex-col justify-end" style={{ height: 64 }}>
                    <div
                      className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${heightPct}%`,
                        minHeight: 3,
                        background: bar.count > 0 ? "var(--terra)" : "var(--warm-border)",
                        opacity: bar.count > 0 ? 1 : 0.5,
                      }}
                      data-testid={`bar-growth-${i}`}
                    />
                  </div>
                  {bar.count > 0 && (
                    <div className="text-[9px] font-mono font-bold text-[var(--terra)]">{bar.count}</div>
                  )}
                  <div className="text-[8px] text-muted-foreground text-center leading-tight truncate w-full px-0.5">{bar.week}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 4: Per-Event Attendance Breakdown ── */}
      {analytics && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-event-breakdown">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Breakdown</span>
          </div>
          {analytics.perEventStats.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2" data-testid="text-no-events-breakdown">No events yet — create one to see attendance data.</div>
          ) : (
            <div className="space-y-3">
              {analytics.perEventStats.slice(0, 8).map((evt, i) => (
                <div key={evt.id} data-testid={`event-breakdown-row-${evt.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{evt.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {evt.date ? new Date(evt.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }) : "—"}
                        {evt.isCancelled && <span className="ml-1 text-destructive">• Cancelled</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-[var(--terra)]" data-testid={`text-event-rate-${evt.id}`}>{evt.rate}%</div>
                      <div className="text-[10px] text-muted-foreground">{evt.attended}/{evt.rsvps}</div>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--warm-border)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${evt.rsvps > 0 ? evt.rate : 0}%`,
                        background: evt.rate >= 80 ? "var(--green-accent)" : evt.rate >= 50 ? "var(--terra)" : "hsl(var(--chart-4))",
                      }}
                      data-testid={`bar-event-attendance-${evt.id}`}
                    />
                  </div>
                  {i < analytics.perEventStats.slice(0, 8).length - 1 && (
                    <div className="mt-3 border-t border-[var(--warm-border)]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section 5: Most Active Members ── */}
      {analytics && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-top-members">
          <div className="flex items-center gap-2 mb-3">
            <Medal className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Members</span>
          </div>
          {analytics.mostActiveMembers.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2" data-testid="text-no-top-members">No event RSVPs yet.</div>
          ) : (
            <div className="space-y-2">
              {analytics.mostActiveMembers.map((member, i) => (
                <div key={i} className="flex items-center justify-between gap-2" data-testid={`top-member-${i}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: i === 0 ? "#C4622D" : i === 1 ? "#8B7355" : "var(--warm-border)", color: i < 2 ? "white" : "var(--ink)" }}
                    >
                      {i + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground">{member.name}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono" style={{ background: "var(--terra)", color: "white" }} data-testid={`badge-member-rsvps-${i}`}>
                    {member.rsvpCount} RSVPs
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Section 6: Most Popular Event + Recent Activity ── */}
      {insights.topEvent && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-top-event">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Most Popular Event</span>
          </div>
          <div className="font-semibold text-sm text-foreground" data-testid="text-top-event-title">{insights.topEvent.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-top-event-stats">
            {insights.topEvent.attended} attended out of {insights.topEvent.total} RSVPs
          </div>
        </div>
      )}

      <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-recent-activity">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[var(--terra)]" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Member Joins</span>
        </div>
        {insights.recentJoins.length === 0 ? (
          <div className="text-xs text-muted-foreground">No recent joins</div>
        ) : (
          <div className="space-y-2">
            {insights.recentJoins.map((join, i) => (
              <div key={i} className="flex items-center justify-between gap-2" data-testid={`recent-join-${i}`}>
                <span className="text-sm text-foreground">{join.name}</span>
                <span className="text-xs text-muted-foreground">
                  {join.date ? new Date(join.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="card-recent-rsvps">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[var(--terra)]" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent RSVPs</span>
        </div>
        {insights.recentRsvps.length === 0 ? (
          <div className="text-xs text-muted-foreground">No recent RSVPs</div>
        ) : (
          <div className="space-y-2">
            {insights.recentRsvps.map((rsvp, i) => (
              <div key={i} className="flex items-center justify-between gap-2" data-testid={`recent-rsvp-${i}`}>
                <div className="min-w-0">
                  <span className="text-sm text-foreground">{rsvp.userName}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">for {rsvp.eventTitle}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {rsvp.date ? new Date(rsvp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {surveySummary.length > 0 && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{ borderRadius: 18 }} data-testid="section-survey-responses-insights">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-[var(--terra)]" />
            <h3 className="text-sm font-bold text-foreground">Survey Responses</h3>
          </div>
          <div className="space-y-2">
            {surveySummary.map((row) => (
              <div key={row.eventId} className="flex items-center justify-between gap-2" data-testid={`survey-summary-row-${row.eventId}`}>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{row.eventTitle}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{new Date(row.eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
                <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)" }} data-testid={`survey-response-count-${row.eventId}`}>
                  {row.responseCount} {row.responseCount === 1 ? "response" : "responses"}
                </span>
              </div>
            ))}
          </div>
          {setActiveTab && (
            <button
              onClick={() => setActiveTab("events")}
              className="mt-3 text-[11px] font-semibold text-[var(--terra)] hover:underline"
              data-testid="button-go-to-events-for-responses"
            >
              View full responses in Events tab →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
