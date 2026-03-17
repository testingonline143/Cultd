import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Calendar, Check, Copy, Clock3, Camera, Link2, Globe, Pencil, IndianRupee, CheckCircle2, AlertCircle } from "lucide-react";
import type { Club, Event } from "@shared/schema";

type TabKey = "overview" | "requests" | "insights" | "events" | "content" | "edit" | "announcements" | "earnings";

export default function OverviewTab({ club, user, setActiveTab, setContentInitialSection }: {
  club: Club;
  user: any;
  setActiveTab: (tab: TabKey) => void;
  setContentInitialSection?: (s: "faqs" | "schedule" | "moments") => void;
}) {
  return (
    <div className="space-y-4" data-testid="section-club-overview">
      <ClubOverview club={club} user={user} setActiveTab={setActiveTab} setContentInitialSection={setContentInitialSection} />
    </div>
  );
}

function ClubOverview({ club, user, setActiveTab, setContentInitialSection }: { club: Club; user: any; setActiveTab: (tab: TabKey) => void; setContentInitialSection?: (s: "faqs" | "schedule" | "moments") => void }) {
  const { toast } = useToast();
  const healthColors: Record<string, string> = {
    green: "text-[var(--green-accent)] bg-[var(--green-accent)]/10",
    yellow: "text-chart-4 bg-chart-4/10",
    red: "text-destructive bg-destructive/10",
  };

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ["/api/organizer/clubs", club.id, "pending-count"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/pending-count`);
      return res.json();
    },
  });

  const { data: clubEvents = [] } = useQuery<(Event & { rsvpCount: number })[]>({
    queryKey: ["/api/clubs", club.id, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${club.id}/events`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: clubMomentsData = [] } = useQuery<{ id: string }[]>({
    queryKey: ["/api/clubs", club.id, "moments"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${club.id}/moments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const pendingCount = pendingData?.count ?? 0;
  const now = new Date();
  const nextEvent = clubEvents
    .filter(e => !e.isCancelled && new Date(e.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] || null;

  const hasEvent = clubEvents.length > 0;
  const hasMoment = clubMomentsData.length > 0;
  const showChecklist = !hasEvent || !hasMoment;

  const clubLink = club.slug
    ? `${window.location.origin}/c/${club.slug}`
    : `${window.location.origin}/club/${club.id}`;
  const copyClubLink = () => {
    navigator.clipboard.writeText(clubLink).then(() => {
      toast({ description: "Club link copied!" });
    });
  };

  return (
    <>
      <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md p-5" style={{ borderRadius: 18 }} data-testid="card-club-overview">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-md flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: club.bgColor || undefined, borderRadius: 14 }}
          >
            {club.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-[var(--terra)]">{club.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{club.shortDesc}</p>
            {club.schedule && (
              <div className="flex items-center gap-1 mt-1.5">
                <Clock3 className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{club.schedule}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-overview-members">{club.memberCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Total Members</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-overview-events">
            {clubEvents.filter(e => !e.isCancelled).length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total Events</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md p-4 text-center" style={{ borderRadius: 18 }}>
          <div className="text-2xl font-bold text-[var(--terra)] font-mono" data-testid="text-overview-founding">
            {club.foundingTaken ?? 0}/{club.foundingTotal ?? 20}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Founding Spots</div>
        </div>
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md p-4 text-center" style={{ borderRadius: 18 }}>
          <div className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-md ${healthColors[club.healthStatus] || healthColors.green}`} data-testid="text-overview-health">
            {club.healthLabel}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Health Status</div>
        </div>
      </div>

      {showChecklist && (
        <div
          className="rounded-md p-5 space-y-4"
          style={{ background: "var(--ink)", borderRadius: 18 }}
          data-testid="card-getting-started"
        >
          <div>
            <p className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: "var(--terra-light)" }}>Your club is live!</p>
            <h3 className="font-display text-lg font-bold text-white leading-tight">Get Your Club Going</h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Complete these steps to launch properly</p>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--terra)" }}>
                <Check className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm text-white/70 line-through">Club created</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: hasEvent ? "var(--terra)" : "rgba(255,255,255,0.15)" }}
              >
                {hasEvent ? <Check className="w-3.5 h-3.5 text-white" /> : <Calendar className="w-3.5 h-3.5 text-white/60" />}
              </div>
              {hasEvent ? (
                <span className="text-sm text-white/50 line-through">Create your first event</span>
              ) : (
                <button
                  onClick={() => setActiveTab("events")}
                  className="text-sm font-semibold text-white underline underline-offset-2"
                  data-testid="checklist-create-event"
                >
                  Create your first event →
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: hasMoment ? "var(--terra)" : "rgba(255,255,255,0.15)" }}
              >
                {hasMoment ? <Check className="w-3.5 h-3.5 text-white" /> : <Camera className="w-3.5 h-3.5 text-white/60" />}
              </div>
              {hasMoment ? (
                <span className="text-sm text-white/50 line-through">Post your first moment</span>
              ) : (
                <button
                  onClick={() => { setContentInitialSection?.("moments"); setActiveTab("content"); }}
                  className="text-sm font-semibold text-white underline underline-offset-2"
                  data-testid="checklist-post-moment"
                >
                  Post your first moment →
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
                <Link2 className="w-3.5 h-3.5 text-white/60" />
              </div>
              <button
                onClick={copyClubLink}
                className="text-sm font-semibold text-white underline underline-offset-2"
                data-testid="checklist-copy-link"
              >
                Share your club link
              </button>
            </div>
          </div>
          <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.08)" }}>
            <span className="text-[10px] font-mono truncate flex-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {clubLink}
            </span>
            <button
              onClick={copyClubLink}
              className="text-[10px] font-bold shrink-0"
              style={{ color: "var(--terra-light)" }}
              data-testid="button-copy-club-link"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <PublicPageCard club={club} />
      <EarningsCard club={club} />
    </>
  );
}

function PublicPageCard({ club }: { club: Club }) {
  const { toast } = useToast();
  const publicUrl = club.slug ? `${window.location.origin}/c/${club.slug}` : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl).then(() => {
        setCopied(true);
        toast({ description: "Public page URL copied!" });
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="rounded-md p-4 space-y-3" style={{ borderRadius: 18, background: "linear-gradient(135deg, var(--terra-pale), rgba(201,168,76,0.08))", border: "1.5px solid rgba(196,98,45,0.2)" }} data-testid="card-public-page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--terra)", color: "white" }}>
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-[var(--ink)]">Public Page</div>
          <p className="text-xs text-[var(--muted-warm)] mt-0.5">
            {publicUrl ? "Share this link anywhere" : "Set up a shareable page for your club"}
          </p>
        </div>
      </div>

      {publicUrl && (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--ink)", border: "1.5px solid var(--ink)" }}>
          <span className="text-xs font-mono truncate flex-1 text-white/80" data-testid="text-public-url">{publicUrl}</span>
          <button onClick={handleCopy} className="shrink-0 text-white/60" data-testid="button-copy-public-url">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {publicUrl && (
          <a href={`/c/${club.slug}`} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }} data-testid="link-view-page">
            <Globe className="w-3.5 h-3.5" /> View Page
          </a>
        )}
        <Link href={`/organizer/page-builder?club=${club.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: "var(--terra)", textDecoration: "none" }} data-testid="link-edit-page">
          <Pencil className="w-3.5 h-3.5" /> Edit Page
        </Link>
      </div>
    </div>
  );
}

function EarningsCard({ club }: { club: Club }) {
  const [, navigate] = useLocation();
  const { data: earnings, isLoading } = useQuery<{
    totalTransferred: number;
    totalPending: number;
    totalFailed: number;
    recentTransactions: { id: string; eventTitle?: string; baseAmount: number; platformFee: number; status: string; createdAt: string }[];
  }>({
    queryKey: ["/api/organizer/clubs", club.id, "earnings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/earnings`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const fmt = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="h-28 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
    );
  }

  const total = (earnings?.totalTransferred ?? 0) + (earnings?.totalPending ?? 0) + (earnings?.totalFailed ?? 0);
  if (!earnings || total === 0) return null;

  const statusColor: Record<string, string> = {
    transferred: "text-green-700",
    pending: "text-amber-700",
    failed: "text-red-700",
  };

  return (
    <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="card-earnings-overview">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-[var(--terra)]" />
          <span className="text-sm font-bold text-[var(--ink)]">Earnings</span>
        </div>
        <button
          onClick={() => navigate(`/organizer/earnings?club=${club.id}`)}
          className="text-[11px] font-semibold"
          style={{ color: "var(--terra)" }}
          data-testid="link-view-all-earnings"
        >
          View full history →
        </button>
      </div>
      <div className={`grid gap-2 mb-3 ${earnings.totalFailed > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}>
          <div className="flex items-center gap-1 mb-0.5">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            <span className="text-[10px] font-bold text-green-700">Transferred</span>
          </div>
          <div className="font-bold text-green-800 text-sm">{fmt(earnings.totalTransferred)}</div>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: earnings.totalPending > 0 ? "rgba(245,158,11,0.06)" : "var(--cream)", border: `1px solid ${earnings.totalPending > 0 ? "rgba(245,158,11,0.25)" : "var(--warm-border)"}` }}>
          <div className="flex items-center gap-1 mb-0.5">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700">Pending</span>
          </div>
          <div className="font-bold text-amber-800 text-sm">{fmt(earnings.totalPending)}</div>
        </div>
        {earnings.totalFailed > 0 && (
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)" }}>
            <div className="flex items-center gap-1 mb-0.5">
              <AlertCircle className="w-3 h-3 text-red-600" />
              <span className="text-[10px] font-bold text-red-700">Failed</span>
            </div>
            <div className="font-bold text-red-700 text-sm">{fmt(earnings.totalFailed)}</div>
            <div className="text-[10px] text-red-600 mt-0.5">Contact admin</div>
          </div>
        )}
      </div>
      {earnings.recentTransactions.length > 0 && (
        <div className="space-y-0">
          {earnings.recentTransactions.slice(0, 5).map((tx, i) => (
            <div key={tx.id} className="flex items-center justify-between text-xs py-1.5" style={{ borderTop: "1px solid var(--warm-border)" }}>
              <div className="flex-1 mr-2 min-w-0">
                <div className="text-[var(--ink)] truncate font-medium">{tx.eventTitle || "Event"}</div>
                <div className="text-[10px] text-[var(--muted-warm)]">{new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold text-[var(--ink)]">{fmt(tx.baseAmount)}</div>
                <div className={`text-[10px] font-medium capitalize ${statusColor[tx.status] ?? "text-[var(--muted-warm)]"}`}>{tx.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
