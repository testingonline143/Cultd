import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, ShieldAlert, Users, Activity, Ban, Calendar, MapPin,
  Search, CheckCircle2, XCircle, Building2, UserCheck, ArrowLeft,
  TrendingUp, Camera, MessageSquare, Zap, RotateCcw, ChevronRight,
  BarChart2, Megaphone, Download, X, Vote, Send, Copy, Check,
  IndianRupee, RefreshCw, Clock, AlertCircle, Filter,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { JoinRequest, Club } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminAnalytics {
  totalUsers: number;
  totalClubs: number;
  activeClubs: number;
  totalEvents: number;
  totalRsvps: number;
  totalCheckins: number;
  totalMoments: number;
  totalComments: number;
  newUsersThisWeek: number;
  newEventsThisWeek: number;
  newJoinsThisWeek: number;
  cityCounts: { city: string; count: number }[];
}

interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  city: string | null;
  role: string | null;
  createdAt: string | null;
  clubCount: number;
}

interface AdminEvent {
  id: string;
  title: string;
  clubId: string;
  clubName: string;
  clubEmoji: string;
  startsAt: string;
  rsvpCount: number;
  checkedInCount: number;
  isCancelled: boolean | null;
  maxCapacity: number;
}

interface ActivityFeed {
  recentJoins: { name: string; clubName: string; createdAt: string | null }[];
  recentClubs: { name: string; emoji: string; city: string; createdAt: string | null }[];
  recentEvents: { title: string; clubName: string; startsAt: string }[];
}

interface WeeklyGrowth {
  week: string;
  users: number;
  events: number;
  moments: number;
}

interface UserDetail {
  clubs: { clubId: string; clubName: string; clubEmoji: string; joinedAt: string | null }[];
  events: { id: string; title: string; startsAt: string; clubName: string }[];
  moments: { id: string; caption: string | null; createdAt: string | null }[];
  joinRequests: { clubName: string; status: string; createdAt: string | null }[];
}


function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminSetupScreen({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!userId) return;
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const steps = [
    { num: "1", text: "Click the Copy button below to copy your Admin ID" },
    { num: "2", text: "Open your environment variables (.env file)" },
    { num: "3", text: "Create a new secret named ADMIN_USER_ID" },
    { num: "4", text: "Paste your Admin ID as the value and save" },
    { num: "5", text: "Restart the app — you'll have full admin access" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--ink)" }}>
            <Shield className="w-8 h-8" style={{ color: "var(--terra)" }} />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>One Step to Admin Access</h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--muted-warm)" }}>
            You're signed in. Now set your Admin ID as a secret so only you can access the dashboard.
          </p>
        </div>
        <div className="rounded-[18px] p-5 space-y-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="card-admin-id">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: "#16a34a" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Your Admin ID</span>
          </div>
          {userId ? (
            <>
              <div className="w-full px-4 py-3 rounded-xl font-mono text-sm break-all select-all" style={{ background: "var(--cream)", color: "var(--ink)", border: "1.5px solid var(--warm-border)" }} data-testid="text-admin-user-id">{userId}</div>
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all"
                style={copied ? { background: "#16a34a", color: "white" } : { background: "var(--terra)", color: "white" }}
                data-testid="button-copy-admin-id"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Admin ID</>}
              </button>
            </>
          ) : (
            <div className="text-sm text-center py-2" style={{ color: "var(--muted-warm)" }}>Loading your ID...</div>
          )}
        </div>
        <div className="rounded-[18px] p-5 space-y-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--terra)" }}>How to activate</p>
          {steps.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white mt-0.5" style={{ background: "var(--terra)" }}>{step.num}</div>
              <p className="text-sm leading-snug" style={{ color: "var(--ink)" }}>{step.text}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[18px] p-4 flex items-center gap-3" style={{ background: "rgba(196,98,45,0.08)", border: "1.5px solid rgba(196,98,45,0.25)" }}>
          <Shield className="w-4 h-4 shrink-0" style={{ color: "var(--terra)" }} />
          <p className="text-xs" style={{ color: "var(--terra)" }}>The secret name must be exactly: <span className="font-bold font-mono">ADMIN_USER_ID</span></p>
        </div>
        <div className="text-center">
          <a href="/api/logout" className="text-xs" style={{ color: "var(--muted-warm)" }}>Not you? Sign out</a>
        </div>
      </div>
    </div>
  );
}

type AdminGroupTab = "overview" | "people" | "clubs-events" | "payments" | "broadcast";
type ClubsEventsSection = "clubs" | "events" | "proposals";
type PeopleSection = "users" | "requests";

export default function Admin() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [activeGroupTab, setActiveGroupTab] = useState<AdminGroupTab>("overview");
  const [clubsEventsSection, setClubsEventsSection] = useState<ClubsEventsSection>("clubs");
  const [peopleSection, setPeopleSection] = useState<PeopleSection>("users");

  const { data: adminStatus, isLoading: statusLoading } = useQuery<{ configured: boolean; isCurrentUserAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: pendingCountData } = useQuery<JoinRequest[]>({
    queryKey: ["/api/admin/join-requests"],
    enabled: isAuthenticated && adminStatus?.isCurrentUserAdmin === true,
    retry: false,
  });
  const pendingCount = (pendingCountData ?? []).filter((r: JoinRequest) => r.status === "pending" && !r.markedDone).length;

  const { data: proposalCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/club-proposals/pending-count"],
    enabled: isAuthenticated && adminStatus?.isCurrentUserAdmin === true,
    retry: false,
  });
  const pendingProposalCount = proposalCountData?.count ?? 0;

  const { data: analytics } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
    enabled: isAuthenticated && adminStatus?.isCurrentUserAdmin === true,
    retry: false,
  });

  if (authLoading || (isAuthenticated && statusLoading)) {
    return (
      <div className="min-h-screen" style={{ background: "var(--cream)" }}>
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-xl" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--cream)" }}>
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
            <Shield className="w-8 h-8" style={{ color: "var(--terra)" }} />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--terra)" }} data-testid="text-admin-title">Admin Dashboard</h1>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>Sign in to access the admin dashboard</p>
          <a href="/api/login?returnTo=/admin" className="inline-block w-full rounded-full py-3 text-sm font-bold text-white text-center" style={{ background: "var(--terra)" }} data-testid="button-admin-login">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (adminStatus?.configured === false) {
    return <AdminSetupScreen userId={user?.id || ""} />;
  }

  if (adminStatus?.isCurrentUserAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--cream)" }}>
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "rgba(220,38,38,0.1)" }}>
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-display text-xl font-bold" data-testid="text-access-denied">Access Denied</h2>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>You don't have admin privileges.</p>
          <Link href="/home" className="inline-block text-sm font-semibold" style={{ color: "var(--terra)" }} data-testid="link-go-home">Go Home</Link>
        </div>
      </div>
    );
  }

  // 5 grouped tabs: Overview | People (Users+Requests) | Clubs & Events (Clubs+Events+Proposals) | Payments | Broadcast
  const groupTabs: { key: AdminGroupTab; label: string; badge?: number }[] = [
    { key: "overview",     label: "Overview" },
    { key: "people",       label: "People",       badge: pendingCount > 0 ? pendingCount : undefined },
    { key: "clubs-events", label: "Clubs & Events", badge: pendingProposalCount > 0 ? pendingProposalCount : undefined },
    { key: "payments",     label: "Payments" },
    { key: "broadcast",    label: "Broadcast" },
  ];

  const displayName = user?.firstName || user?.email?.split("@")[0] || "Admin";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: "var(--ink)" }}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={displayName} className="w-10 h-10 rounded-full object-cover shrink-0" style={{ border: "2px solid var(--terra)" }} />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-base shrink-0" style={{ background: "var(--terra)" }}>
                  {initials}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Shield className="w-3 h-3" style={{ color: "var(--terra)" }} />
                  <span className="text-[9px] font-black tracking-[2.5px] uppercase" style={{ color: "var(--terra)" }}>Admin Dashboard</span>
                </div>
                <p className="font-display font-bold text-white text-[15px] leading-none">{displayName}</p>
              </div>
            </div>
            <Link href="/home" data-testid="link-admin-home">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-full transition-all active:opacity-70" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <ArrowLeft className="w-3.5 h-3.5 text-white" />
                <span className="text-white text-xs font-semibold">Home</span>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Group tab bar */}
      <div
        className="flex overflow-x-auto px-4 sticky top-[64px] z-30"
        style={{ background: "var(--cream)", borderBottom: "1.5px solid var(--warm-border)", scrollbarWidth: "none" }}
      >
        {groupTabs.map((tab) => {
          const isActive = activeGroupTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveGroupTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 border-b-2 -mb-px shrink-0 ${
                isActive
                  ? "border-[var(--terra)] text-[var(--terra)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-admin-${tab.key}`}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[var(--terra)] text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {activeGroupTab === "overview" && <AnalyticsTab />}

        {activeGroupTab === "people" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["users", "requests"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPeopleSection(s)}
                  className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${peopleSection === s ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
                  style={{ borderRadius: 18 }}
                  data-testid={`tab-admin-people-${s}`}
                >
                  {s === "users" ? "Users" : "Requests"}
                  {s === "requests" && pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold bg-[var(--terra)] text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {peopleSection === "users" && <UsersTab />}
            {peopleSection === "requests" && <JoinRequestsTab />}
          </div>
        )}

        {activeGroupTab === "clubs-events" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["clubs", "events", "proposals"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setClubsEventsSection(s)}
                  className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1 ${clubsEventsSection === s ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
                  style={{ borderRadius: 18 }}
                  data-testid={`tab-admin-clubs-${s}`}
                >
                  {s === "clubs" ? "Clubs" : s === "events" ? "Events" : "Proposals"}
                  {s === "proposals" && pendingProposalCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold bg-[var(--terra)] text-white">
                      {pendingProposalCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {clubsEventsSection === "clubs" && <ClubsMonitorTab />}
            {clubsEventsSection === "events" && <EventsTab />}
            {clubsEventsSection === "proposals" && <ProposalsTab />}
          </div>
        )}

        {activeGroupTab === "payments" && <PaymentsTab />}
        {activeGroupTab === "broadcast" && <BroadcastTab />}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div
      className="rounded-[18px] p-4 relative overflow-hidden"
      style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderLeft: `4px solid ${color || "var(--terra)"}` }}
    >
      <div className="absolute top-3 right-3 opacity-[0.07]">
        <span style={{ color: color || "var(--terra)", fontSize: 36 }}>{icon}</span>
      </div>
      <div className="text-3xl font-black font-mono leading-none mb-1" style={{ color: color || "var(--terra)" }}>{value}</div>
      <div className="text-[11px] font-semibold" style={{ color: "var(--muted-warm)" }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-warm2)" }}>{sub}</div>}
    </div>
  );
}

function BroadcastModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/broadcast", { title: title.trim(), message: message.trim(), linkUrl: linkUrl.trim() || undefined });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Broadcast sent to ${data.sent} users` });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to send broadcast", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(26,20,16,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-[28px] overflow-hidden shadow-2xl" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
        <div className="px-6 pt-6 pb-4" style={{ background: "var(--ink)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(196,98,45,0.25)" }}>
                <Megaphone className="w-5 h-5" style={{ color: "var(--terra)" }} />
              </div>
              <div>
                <h2 className="font-display font-bold text-white text-lg">Send Broadcast</h2>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Notify all platform users</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }} data-testid="button-close-broadcast">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New city going live!"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-title"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-message"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Link URL <span className="normal-case tracking-normal font-normal">(optional)</span></label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-link"
            />
          </div>
          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={broadcastMutation.isPending || title.trim().length < 2 || message.trim().length < 5}
            className="w-full rounded-full py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
            style={{ background: "var(--terra)" }}
            data-testid="button-send-broadcast"
          >
            <Send className="w-4 h-4" />
            {broadcastMutation.isPending ? "Sending..." : "Send to All Users"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailDrawer({ userId, user: userRow, onClose }: { userId: string; user: AdminUser; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", userId, "detail"],
    queryFn: () => fetch(`/api/admin/users/${userId}/detail`).then(r => r.json()),
    enabled: !!userId,
  });

  const statusColor = (s: string) => {
    if (s === "approved") return { bg: "rgba(22,163,74,0.12)", color: "#16a34a" };
    if (s === "rejected") return { bg: "rgba(220,38,38,0.1)", color: "#dc2626" };
    return { bg: "rgba(201,168,76,0.12)", color: "var(--gold)" };
  };

  const initials = (userRow.firstName || userRow.email || "?").charAt(0).toUpperCase();

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(26,20,16,0.5)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto shadow-2xl"
        style={{ background: "var(--warm-white)" }}
        data-testid="drawer-user-detail"
      >
        {/* Drawer header */}
        <div className="px-5 pt-6 pb-5" style={{ background: "var(--ink)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0" style={{ background: "var(--terra)" }}>
                {initials}
              </div>
              <div>
                <p className="font-display font-bold text-white text-base leading-tight">{userRow.firstName || "No Name"}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{userRow.email || "No email"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }} data-testid="button-close-drawer">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {userRow.city && (
              <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                <MapPin className="w-3 h-3" />{userRow.city}
              </span>
            )}
            <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: "rgba(196,98,45,0.3)", color: "var(--terra)" }}>
              {userRow.clubCount} club{userRow.clubCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full capitalize" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
              {userRow.role || "user"}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : !detail ? null : (
          <div className="p-5 space-y-6">
            {/* Clubs */}
            <div>
              <h3 className="text-[11px] font-black tracking-wider uppercase mb-3 flex items-center gap-1.5" style={{ color: "var(--terra)" }}>
                <Building2 className="w-3.5 h-3.5" /> Clubs Joined ({detail.clubs.length})
              </h3>
              {detail.clubs.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No clubs joined yet</p>
              ) : (
                <div className="space-y-2">
                  {detail.clubs.map((c) => (
                    <div key={c.clubId} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ background: "var(--warm-white)" }}>{c.clubEmoji}</div>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{c.clubName}</p>
                        {c.joinedAt && <p className="text-[10px]" style={{ color: "var(--muted-warm)" }}>Joined {new Date(c.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Events */}
            <div>
              <h3 className="text-[11px] font-black tracking-wider uppercase mb-3 flex items-center gap-1.5" style={{ color: "var(--terra)" }}>
                <Calendar className="w-3.5 h-3.5" /> Events RSVPed ({detail.events.length})
              </h3>
              {detail.events.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No RSVPs yet</p>
              ) : (
                <div className="space-y-2">
                  {detail.events.map((e) => (
                    <div key={e.id} className="flex items-start justify-between p-3 rounded-xl" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }}>
                      <div>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{e.title}</p>
                        <p className="text-[10px]" style={{ color: "var(--muted-warm)" }}>{e.clubName}</p>
                      </div>
                      <p className="text-[10px] shrink-0 mt-0.5 font-semibold" style={{ color: "var(--terra)" }}>{new Date(e.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Moments */}
            {detail.moments.length > 0 && (
              <div>
                <h3 className="text-[11px] font-black tracking-wider uppercase mb-3 flex items-center gap-1.5" style={{ color: "var(--terra)" }}>
                  <Camera className="w-3.5 h-3.5" /> Moments ({detail.moments.length})
                </h3>
                <div className="space-y-2">
                  {detail.moments.map((m) => (
                    <div key={m.id} className="p-3 rounded-xl" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }}>
                      <p className="text-[12px]" style={{ color: "var(--ink)" }}>{m.caption || "No caption"}</p>
                      {m.createdAt && <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-warm)" }}>{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Join History */}
            <div>
              <h3 className="text-[11px] font-black tracking-wider uppercase mb-3 flex items-center gap-1.5" style={{ color: "var(--terra)" }}>
                <UserCheck className="w-3.5 h-3.5" /> Join History ({detail.joinRequests.length})
              </h3>
              {detail.joinRequests.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No requests</p>
              ) : (
                <div className="space-y-2">
                  {detail.joinRequests.map((r, i) => {
                    const ss = statusColor(r.status);
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }}>
                        <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>{r.clubName}</p>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{r.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SectionEmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="text-center py-14 space-y-3">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--terra-pale)" }}>
        <span style={{ color: "var(--terra)" }}>{icon}</span>
      </div>
      <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>{title}</h3>
      {desc && <p className="text-sm" style={{ color: "var(--muted-warm)" }}>{desc}</p>}
    </div>
  );
}

type StatRowItem = { label: string; value: number; icon: React.ReactNode; color?: string };

function AnalyticsTab() {
  const { data: analytics, isLoading, error } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
    retry: false,
  });

  const { data: feed } = useQuery<ActivityFeed>({
    queryKey: ["/api/admin/activity-feed"],
    retry: false,
  });

  const { data: growth } = useQuery<WeeklyGrowth[]>({
    queryKey: ["/api/admin/growth"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" />)}
        </div>
      </div>
    );
  }

  if (error) return (
    <SectionEmptyState icon={<ShieldAlert className="w-6 h-6" />} title="Access Denied" desc="You don't have admin privileges." />
  );
  if (!analytics) return null;

  const statsRow1: StatRowItem[] = [
    { label: "Total Users", value: analytics.totalUsers, icon: <Users className="w-6 h-6" /> },
    { label: "Active Clubs", value: analytics.activeClubs, icon: <Building2 className="w-6 h-6" />, color: "#16a34a" },
    { label: "Total Events", value: analytics.totalEvents, icon: <Calendar className="w-6 h-6" /> },
    { label: "Total RSVPs", value: analytics.totalRsvps, icon: <CheckCircle2 className="w-6 h-6" /> },
    { label: "Check-ins", value: analytics.totalCheckins, icon: <Zap className="w-6 h-6" />, color: "#C9A84C" },
    { label: "Moments", value: analytics.totalMoments, icon: <Camera className="w-6 h-6" /> },
    { label: "Comments", value: analytics.totalComments, icon: <MessageSquare className="w-6 h-6" /> },
    { label: "All Clubs", value: analytics.totalClubs, icon: <Activity className="w-6 h-6" /> },
  ];

  return (
    <div className="space-y-6" data-testid="section-analytics">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {statsRow1.map((stat) => (
          <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} color={stat.color} />
        ))}
      </div>

      {/* This Week */}
      <div className="rounded-[20px] p-5 relative overflow-hidden" style={{ background: "var(--ink)" }}>
        <div
          className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, var(--terra) 0, var(--terra) 1px, transparent 0, transparent 50%)", backgroundSize: "12px 12px" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: "var(--terra)" }} />
            <span className="text-[10px] font-black tracking-[2.5px] uppercase" style={{ color: "var(--terra)" }}>This Week</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: analytics.newUsersThisWeek, label: "New Users" },
              { value: analytics.newJoinsThisWeek, label: "New Members" },
              { value: analytics.newEventsThisWeek, label: "New Events" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-4xl font-black text-white font-mono leading-none">+{item.value}</p>
                <p className="text-[11px] mt-1.5 font-medium" style={{ color: "var(--muted-warm2)" }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Growth Chart */}
      {growth && growth.length > 0 && (
        <div className="rounded-[20px] p-5" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="card-growth-chart">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>Platform Growth</h3>
                <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>Last 8 weeks activity</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              {[
                { label: "Users", color: "#C4622D" },
                { label: "Events", color: "#C9A84C" },
                { label: "Moments", color: "#3D6B45" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: l.color + "18", color: l.color }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={growth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C4622D" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#C4622D" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorMoments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3D6B45" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3D6B45" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#8A7A6A" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#8A7A6A" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#FDFAF5", border: "1px solid #E8E0D4", borderRadius: 12, fontSize: 11 }}
                labelStyle={{ color: "#1A1410", fontWeight: 700 }}
              />
              <Area type="monotone" dataKey="users" stroke="#C4622D" strokeWidth={2} fill="url(#colorUsers)" dot={false} />
              <Area type="monotone" dataKey="events" stroke="#C9A84C" strokeWidth={2} fill="url(#colorEvents)" dot={false} />
              <Area type="monotone" dataKey="moments" stroke="#3D6B45" strokeWidth={2} fill="url(#colorMoments)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* City breakdown */}
      {analytics.cityCounts.length > 0 && (
        <div className="rounded-[20px] p-5" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="card-city-breakdown">
          <h3 className="font-display font-bold text-base mb-4 flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <MapPin className="w-4 h-4" style={{ color: "var(--terra)" }} />
            Clubs by City
          </h3>
          <div className="space-y-3">
            {analytics.cityCounts.map((city) => {
              const pct = Math.round((city.count / Math.max(...analytics.cityCounts.map(c => c.count))) * 100);
              return (
                <div key={city.city}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                      <MapPin className="w-3 h-3" style={{ color: "var(--muted-warm)" }} />{city.city}
                    </span>
                    <span className="text-xs font-black font-mono" style={{ color: "var(--terra)" }}>{city.count} clubs · {pct}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--cream)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--terra), var(--terra-light))` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Platform Pulse */}
      {feed && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>Platform Pulse</h3>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#16a34a" }} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderLeft: "4px solid var(--terra)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: "var(--terra)" }}><UserCheck className="w-3.5 h-3.5" /></span>
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "var(--terra)" }}>Recent Joins</span>
              </div>
              <div className="space-y-2.5">
                {feed.recentJoins.length === 0 && <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No joins yet</p>}
                {feed.recentJoins.map((j, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{j.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{j.clubName}</p>
                    </div>
                    {j.createdAt && <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "var(--muted-warm)" }}>{formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderLeft: "4px solid var(--terra)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: "var(--terra)" }}><Building2 className="w-3.5 h-3.5" /></span>
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "var(--terra)" }}>New Clubs</span>
              </div>
              <div className="space-y-2.5">
                {feed.recentClubs.length === 0 && <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No clubs yet</p>}
                {feed.recentClubs.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-base" style={{ background: "var(--cream)" }}>{c.emoji}</div>
                    <div>
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{c.city}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderLeft: "4px solid var(--terra)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: "var(--terra)" }}><Calendar className="w-3.5 h-3.5" /></span>
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "var(--terra)" }}>New Events</span>
              </div>
              <div className="space-y-2.5">
                {feed.recentEvents.length === 0 && <p className="text-xs" style={{ color: "var(--muted-warm)" }}>No events yet</p>}
                {feed.recentEvents.map((e, i) => (
                  <div key={i}>
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{e.title}</p>
                    <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{e.clubName} · {format(new Date(e.startsAt), "d MMM")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastTab() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/broadcast", { title: title.trim(), message: message.trim(), linkUrl: linkUrl.trim() || undefined });
    },
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Broadcast sent to ${data.sent} users` });
      setTitle("");
      setMessage("");
      setLinkUrl("");
    },
    onError: () => {
      toast({ title: "Failed to send broadcast", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6" data-testid="section-broadcast">
      <div className="rounded-[20px] overflow-hidden shadow-sm" style={{ border: "1.5px solid var(--warm-border)" }}>
        <div className="px-6 pt-5 pb-4" style={{ background: "var(--ink)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(196,98,45,0.25)" }}>
              <Megaphone className="w-5 h-5" style={{ color: "var(--terra)" }} />
            </div>
            <div>
              <h2 className="font-display font-bold text-white text-base">Send Broadcast</h2>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>Notify all platform users instantly</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4" style={{ background: "var(--warm-white)" }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New city going live!"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-title"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Message *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-message"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--muted-warm)" }}>Link URL <span className="normal-case tracking-normal font-normal">(optional)</span></label>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="input-broadcast-link"
            />
          </div>
          <button
            onClick={() => broadcastMutation.mutate()}
            disabled={broadcastMutation.isPending || title.trim().length < 2 || message.trim().length < 5}
            className="w-full rounded-full py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-40"
            style={{ background: "var(--terra)" }}
            data-testid="button-send-broadcast"
          >
            <Send className="w-4 h-4" />
            {broadcastMutation.isPending ? "Sending..." : "Send to All Users"}
          </button>
        </div>
      </div>

      <div className="rounded-[18px] p-4" style={{ background: "var(--terra-pale)", border: "1.5px solid rgba(196,98,45,0.2)" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--terra)" }}>
          Broadcasts are delivered as push notifications to all registered users. Use sparingly for important platform-wide announcements.
        </p>
      </div>
    </div>
  );
}

const HEALTH_OPTIONS = [
  { status: "green", label: "Very Active", color: "#16a34a" },
  { status: "yellow", label: "Growing", color: "#C9A84C" },
  { status: "red", label: "Inactive", color: "#dc2626" },
];

function ClubsMonitorTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [healthPickerId, setHealthPickerId] = useState<string | null>(null);
  const [commissionPickerId, setCommissionPickerId] = useState<string | null>(null);

  const { data: clubs = [], isLoading, error } = useQuery<Club[]>({
    queryKey: ["/api/admin/clubs"],
    retry: false,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("PATCH", `/api/admin/clubs/${id}/deactivate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] }); },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("PATCH", `/api/admin/clubs/${id}/activate`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] }); queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] }); },
  });

  const healthMutation = useMutation({
    mutationFn: async ({ id, status, label }: { id: string; status: string; label: string }) => {
      await apiRequest("PATCH", `/api/admin/clubs/${id}/health`, { status, label });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      setHealthPickerId(null);
      toast({ title: "Health status updated" });
    },
    onError: () => { toast({ title: "Failed to update health", variant: "destructive" }); },
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" />)}</div>;
  if (error) return <SectionEmptyState icon={<ShieldAlert className="w-6 h-6" />} title="Access Denied" />;

  const q = searchQuery.toLowerCase().trim();
  const filtered = q
    ? clubs.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || (c.organizerName || "").toLowerCase().includes(q))
    : clubs;

  const activeClubs = clubs.filter(c => c.isActive !== false);
  const inactiveClubs = clubs.filter(c => c.isActive === false);

  const healthColor = (status: string | null) => {
    if (status === "green") return "#16a34a";
    if (status === "yellow") return "#C9A84C";
    if (status === "red") return "#dc2626";
    return "#8A7A6A";
  };

  return (
    <div className="space-y-5" data-testid="list-admin-clubs">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Building2 className="w-6 h-6" />} label="Total" value={clubs.length} />
        <StatCard icon={<Activity className="w-6 h-6" />} label="Active" value={activeClubs.length} color="#16a34a" />
        <StatCard icon={<Ban className="w-6 h-6" />} label="Paused" value={inactiveClubs.length} color="#dc2626" />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-warm)" }} />
          <input
            type="text"
            placeholder="Search clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-full text-sm focus:outline-none"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="input-search-clubs"
          />
        </div>
        <span className="text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-full" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--muted-warm)" }}>{filtered.length}</span>
      </div>

      <div className="space-y-3">
        {filtered.map((club) => {
          const foundingPct = club.foundingTotal && club.foundingTotal > 0
            ? Math.round(((club.foundingTaken ?? 0) / club.foundingTotal) * 100)
            : null;
          const hColor = healthColor(club.healthStatus);

          return (
            <div
              key={club.id}
              className={`rounded-[18px] transition-all ${club.isActive === false ? "opacity-50" : ""}`}
              style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
              data-testid={`row-admin-club-${club.id}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Link href={`/club/${club.id}`}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: club.bgColor || "var(--terra-pale)" }}>
                      {club.emoji}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Link href={`/club/${club.id}`}>
                        <span className="font-bold text-[15px] hover:underline" style={{ color: "var(--ink)" }}>{club.name}</span>
                      </Link>
                      {/* Health pill */}
                      <button
                        onClick={() => setHealthPickerId(healthPickerId === club.id ? null : club.id)}
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                        style={{ background: hColor + "18", color: hColor, border: `1px solid ${hColor}44` }}
                        data-testid={`button-health-${club.id}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: hColor }} />
                        {club.healthLabel || "Unknown"}
                      </button>
                      {club.isActive === false && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>Paused</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] flex-wrap" style={{ color: "var(--muted-warm)" }}>
                      <span>{club.category}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{club.memberCount}</span>
                      <span>·</span>
                      <span>{club.organizerName}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{club.city}</span>
                    </div>
                    {foundingPct !== null && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cream)" }}>
                          <div className="h-full rounded-full" style={{ width: `${foundingPct}%`, background: foundingPct >= 100 ? "#16a34a" : foundingPct >= 50 ? "#C9A84C" : "var(--terra)" }} />
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: "var(--muted-warm)" }}>{club.foundingTaken}/{club.foundingTotal} founding</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {club.isActive === false ? (
                      <button onClick={() => activateMutation.mutate(club.id)} disabled={activateMutation.isPending} className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }} data-testid={`button-activate-${club.id}`}>Activate</button>
                    ) : (
                      <button onClick={() => deactivateMutation.mutate(club.id)} disabled={deactivateMutation.isPending} className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }} data-testid={`button-deactivate-${club.id}`}>Pause</button>
                    )}
                  </div>
                </div>

                {/* Commission + health row */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button
                    onClick={() => setCommissionPickerId(commissionPickerId === club.id ? null : club.id)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all"
                    style={{ background: "rgba(196,98,45,0.1)", color: "var(--terra)", border: "1px solid rgba(196,98,45,0.25)" }}
                    data-testid={`button-commission-${club.id}`}
                  >
                    {club.commissionSetByAdmin
                      ? club.commissionType === "fixed"
                        ? `₹${((club.commissionValue ?? 0) / 100).toFixed(0)} fixed`
                        : `${((club.commissionValue ?? 700) / 100).toFixed(0)}%`
                      : "7% (default)"}
                  </button>
                </div>

                {/* Commission edit inline */}
                {commissionPickerId === club.id && (
                  <CommissionEditPopover
                    clubId={club.id}
                    currentType={club.commissionType ?? null}
                    currentValue={club.commissionValue ?? null}
                    onSaved={() => setCommissionPickerId(null)}
                  />
                )}

                {/* Health picker */}
                {healthPickerId === club.id && (
                  <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px dashed var(--warm-border)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Set:</span>
                    {HEALTH_OPTIONS.map((opt) => {
                      const isSelected = club.healthStatus === opt.status;
                      return (
                        <button
                          key={opt.status}
                          onClick={() => healthMutation.mutate({ id: club.id, status: opt.status, label: opt.label })}
                          disabled={healthMutation.isPending}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                          style={{ background: isSelected ? opt.color + "22" : "var(--cream)", color: isSelected ? opt.color : "var(--muted-warm)", border: `1.5px solid ${isSelected ? opt.color : "transparent"}` }}
                          data-testid={`button-set-health-${club.id}-${opt.status}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: opt.color }} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <SectionEmptyState icon={<Building2 className="w-6 h-6" />} title="No clubs found" desc="Try a different search term" />
      )}
    </div>
  );
}

function UsersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const { data: allUsers = [], isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Role updated" }); },
    onError: () => { toast({ title: "Failed to update role", variant: "destructive" }); },
  });

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-[18px]" />)}</div>;
  if (error) return <SectionEmptyState icon={<ShieldAlert className="w-6 h-6" />} title="Access Denied" />;

  const q = searchQuery.toLowerCase().trim();
  const filteredUsers = q ? allUsers.filter(u => (u.firstName || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)) : allUsers;

  const avatarColors = ["#C4622D", "#3D6B45", "#C9A84C", "#6B3D8A", "#2D7DC4", "#C43D4A"];
  const getAvatarColor = (name: string) => avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];

  const handleExportCSV = () => {
    const headers = ["ID", "Name", "Email", "City", "Role", "Clubs", "Joined"];
    const rows = allUsers.map(u => [
      u.id, u.firstName || "", u.email || "", u.city || "", u.role || "user",
      String(u.clubCount), u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "",
    ]);
    downloadCSV("cultfam_users.csv", rows, headers);
  };

  const roles = ["user", "organiser", "admin"] as const;

  return (
    <div className="space-y-4" data-testid="section-admin-users">
      {selectedUser && (
        <UserDetailDrawer userId={selectedUser.id} user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-warm)" }} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-full text-sm focus:outline-none"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="input-search-users"
          />
        </div>
        <span className="text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-full" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--muted-warm)" }}>{filteredUsers.length}</span>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold transition-all"
          style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--muted-warm)" }}
          data-testid="button-export-users-csv"
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div className="space-y-2">
        {filteredUsers.map((u) => {
          const avatarColor = getAvatarColor(u.firstName || u.email || "A");
          const currentRole = u.role || "user";
          return (
            <div
              key={u.id}
              className="rounded-[18px] p-4 cursor-pointer transition-all"
              style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
              data-testid={`row-admin-user-${u.id}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-black text-base text-white" style={{ background: avatarColor }}>
                  {(u.firstName || u.email || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px]" style={{ color: "var(--ink)" }} data-testid={`text-user-name-${u.id}`}>{u.firstName || "No Name"}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px]" style={{ color: "var(--muted-warm)" }}>
                    {u.email && <span className="truncate max-w-[140px]">{u.email}</span>}
                    {u.city && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{u.city}</span>}
                    <span>{u.clubCount} club{u.clubCount !== 1 ? "s" : ""}</span>
                    {u.createdAt && <span>{new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}</span>}
                  </div>
                </div>
                {/* Role toggle buttons */}
                <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {roles.map((role) => {
                    const isActive = currentRole === role;
                    const roleLabel = role === "organiser" ? "Org" : role.charAt(0).toUpperCase() + role.slice(1);
                    return (
                      <button
                        key={role}
                        onClick={() => !isActive && roleMutation.mutate({ userId: u.id, role })}
                        disabled={roleMutation.isPending}
                        className="text-[10px] font-black px-2 py-1 rounded-full transition-all whitespace-nowrap"
                        style={isActive
                          ? { background: role === "admin" ? "var(--terra)" : role === "organiser" ? "var(--terra-pale)" : "var(--cream)", color: role === "admin" ? "white" : "var(--terra)", border: `1.5px solid ${role === "admin" ? "var(--terra)" : "rgba(196,98,45,0.3)"}` }
                          : { background: "transparent", color: "var(--muted-warm2)", border: "1.5px solid transparent" }
                        }
                        data-testid={`button-role-${role}-${u.id}`}
                      >
                        {roleLabel}
                      </button>
                    );
                  })}
                  <ChevronRight className="w-4 h-4" style={{ color: "var(--muted-warm)" }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <SectionEmptyState icon={<Users className="w-6 h-6" />} title={searchQuery ? "No users match" : "No users yet"} desc={searchQuery ? "Try a different search" : undefined} />
      )}
    </div>
  );
}

function EventsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  const { data: allEvents = [], isLoading, error } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events"],
    retry: false,
  });

  const cancelEventMutation = useMutation({
    mutationFn: async (eventId: string) => { await apiRequest("DELETE", `/api/admin/events/${eventId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      setConfirmingCancel(null);
      toast({ title: "Event cancelled" });
    },
    onError: () => { toast({ title: "Failed to cancel event", variant: "destructive" }); },
  });

  const restoreEventMutation = useMutation({
    mutationFn: async (eventId: string) => { await apiRequest("PATCH", `/api/admin/events/${eventId}/restore`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: "Event restored" });
    },
    onError: () => { toast({ title: "Failed to restore event", variant: "destructive" }); },
  });

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-[18px]" />)}</div>;
  if (error) return <SectionEmptyState icon={<ShieldAlert className="w-6 h-6" />} title="Access Denied" />;
  if (allEvents.length === 0) return <SectionEmptyState icon={<Calendar className="w-6 h-6" />} title="No events yet" desc="Events will appear here once clubs start organising" />;

  const now = new Date();
  const q = searchQuery.toLowerCase().trim();
  const filtered = q ? allEvents.filter(e => e.title.toLowerCase().includes(q) || e.clubName.toLowerCase().includes(q)) : allEvents;

  return (
    <div className="space-y-4" data-testid="section-admin-events">
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Calendar className="w-6 h-6" />} label="Total" value={allEvents.length} />
        <StatCard icon={<Activity className="w-6 h-6" />} label="Upcoming" value={allEvents.filter(e => new Date(e.startsAt) > now && !e.isCancelled).length} color="#16a34a" />
        <StatCard icon={<CheckCircle2 className="w-6 h-6" />} label="RSVPs" value={allEvents.reduce((sum, e) => sum + e.rsvpCount, 0)} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--muted-warm)" }} />
          <input
            type="text"
            placeholder="Search events or clubs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-full text-sm focus:outline-none"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="input-search-events"
          />
        </div>
        <span className="text-xs font-semibold whitespace-nowrap px-3 py-2 rounded-full" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--muted-warm)" }}>{filtered.length}</span>
      </div>

      <div className="space-y-2">
        {filtered.map((event) => {
          const d = new Date(event.startsAt);
          const isPast = d < now;
          const attendanceRate = event.rsvpCount > 0 ? Math.round((event.checkedInCount / event.rsvpCount) * 100) : 0;
          const capacityPct = event.maxCapacity > 0 ? Math.round((event.rsvpCount / event.maxCapacity) * 100) : 0;

          const borderColor = event.isCancelled ? "#dc2626" : isPast ? "var(--warm-border)" : "#16a34a";

          return (
            <div
              key={event.id}
              className={`rounded-[18px] transition-all ${event.isCancelled ? "opacity-60" : isPast ? "opacity-80" : ""}`}
              style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderLeft: `4px solid ${borderColor}` }}
              data-testid={`row-admin-event-${event.id}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Date chip */}
                  <div className="shrink-0 w-11 flex flex-col items-center justify-center rounded-xl py-1.5" style={{ background: "var(--terra-pale)", minHeight: 44 }}>
                    <span className="text-[18px] font-black leading-none" style={{ color: "var(--terra)" }}>{format(d, "d")}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--terra)" }}>{format(d, "MMM")}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link href={`/event/${event.id}`}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-[14px] hover:underline" style={{ color: "var(--ink)" }}>{event.title}</span>
                        {event.isCancelled && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>Cancelled</span>}
                        {!event.isCancelled && !isPast && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>Live</span>}
                        {!event.isCancelled && isPast && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--muted-warm)" }}>Past</span>}
                      </div>
                    </Link>
                    <p className="text-[11px] mb-2" style={{ color: "var(--muted-warm)" }}>
                      {event.clubEmoji} {event.clubName} · {format(d, "h:mm a")}
                    </p>
                    {/* RSVP bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--cream)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(capacityPct, 100)}%`, background: capacityPct >= 90 ? "#dc2626" : capacityPct >= 60 ? "#C9A84C" : "#16a34a" }} />
                      </div>
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: "var(--muted-warm)" }}>{event.rsvpCount}/{event.maxCapacity}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {isPast && event.rsvpCount > 0 && (
                      <div className="text-right">
                        <div className="text-[20px] font-black leading-none font-mono" style={{ color: attendanceRate >= 70 ? "#16a34a" : "var(--terra)" }}>{attendanceRate}%</div>
                        <div className="text-[9px]" style={{ color: "var(--muted-warm)" }}>attended</div>
                      </div>
                    )}
                    {event.isCancelled && (
                      <button onClick={() => restoreEventMutation.mutate(event.id)} disabled={restoreEventMutation.isPending} className="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }} data-testid={`button-restore-event-${event.id}`}>
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    )}
                    {!isPast && !event.isCancelled && (
                      confirmingCancel === event.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => cancelEventMutation.mutate(event.id)} disabled={cancelEventMutation.isPending} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }} data-testid={`button-confirm-cancel-event-${event.id}`}>{cancelEventMutation.isPending ? "..." : "Confirm"}</button>
                          <button onClick={() => setConfirmingCancel(null)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: "var(--cream)", color: "var(--muted-warm)" }} data-testid={`button-undo-cancel-event-${event.id}`}>Back</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmingCancel(event.id)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }} data-testid={`button-cancel-event-${event.id}`}>Cancel</button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JoinRequestsTab() {
  const { toast } = useToast();

  const { data: requests = [], isLoading, error } = useQuery<JoinRequest[]>({
    queryKey: ["/api/admin/join-requests"],
    retry: false,
  });

  const markDoneMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("PATCH", `/api/admin/join-requests/${id}/done`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/join-requests"] }); },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, clubId }: { id: string; clubId: string }) => {
      await apiRequest("POST", `/api/admin/join-requests/${id}/approve`, { clubId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/analytics"] });
      toast({ title: "Request approved" });
    },
    onError: () => { toast({ title: "Failed to approve", variant: "destructive" }); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("POST", `/api/admin/join-requests/${id}/reject`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/join-requests"] });
      toast({ title: "Request rejected" });
    },
    onError: () => { toast({ title: "Failed to reject", variant: "destructive" }); },
  });

  if (isLoading) return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-[18px]" />)}</div>;
  if (error) return <SectionEmptyState icon={<ShieldAlert className="w-6 h-6" />} title="Access Denied" />;
  if (requests.length === 0) return <SectionEmptyState icon={<UserCheck className="w-6 h-6" />} title="No join requests yet" desc="When users apply to join clubs, they'll appear here" />;

  const handleExportCSV = () => {
    const headers = ["Name", "Phone", "Club", "Status", "Date"];
    const rows = requests.map(r => [
      r.name || "", r.phone || "", r.clubName || "", r.status || "",
      r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "",
    ]);
    downloadCSV("cultfam_join_requests.csv", rows, headers);
  };

  const pending = requests.filter(r => r.status === "pending" && !r.markedDone);
  const rest = requests.filter(r => r.status !== "pending" || r.markedDone);

  const statusStyle = (status: string) => {
    if (status === "approved") return { bg: "rgba(22,163,74,0.12)", color: "#16a34a" };
    if (status === "rejected") return { bg: "rgba(220,38,38,0.1)", color: "#dc2626" };
    return { bg: "rgba(201,168,76,0.12)", color: "var(--gold)" };
  };

  const renderRequest = (req: JoinRequest) => {
    const ss = statusStyle(req.status);
    const isPending = req.status === "pending" && !req.markedDone;

    return (
      <div
        key={req.id}
        className={`rounded-[18px] transition-all ${req.markedDone ? "opacity-40" : ""}`}
        style={{
          background: "var(--warm-white)",
          border: "1.5px solid var(--warm-border)",
          borderLeft: isPending ? "4px solid var(--terra)" : "1.5px solid var(--warm-border)",
        }}
        data-testid={`row-join-request-${req.id}`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-black text-sm text-white" style={{ background: "var(--terra)" }}>
              {(req.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-bold text-[14px]" style={{ color: "var(--ink)" }} data-testid={`text-join-name-${req.id}`}>{req.name}</span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: ss.bg, color: ss.color }}>{req.status}</span>
                {req.markedDone && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "var(--cream)", color: "var(--muted-warm)" }}>Done</span>}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]" style={{ color: "var(--muted-warm)" }}>
                <span data-testid={`text-join-phone-${req.id}`}>{req.phone}</span>
                <span>·</span>
                <span className="font-semibold" style={{ color: "var(--terra)" }} data-testid={`text-join-club-${req.id}`}>{req.clubName}</span>
                <span>·</span>
                <span>{req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</span>
              </div>
            </div>
          </div>

          {isPending && (
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => approveMutation.mutate({ id: req.id, clubId: req.clubId })}
                disabled={approveMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1.5px solid rgba(22,163,74,0.3)" }}
                data-testid={`button-approve-${req.id}`}
              >
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => rejectMutation.mutate(req.id)}
                disabled={rejectMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1.5px solid rgba(220,38,38,0.3)" }}
                data-testid={`button-reject-${req.id}`}
              >
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}

          {!req.markedDone && req.status !== "pending" && (
            <div className="mt-3">
              <button
                onClick={() => markDoneMutation.mutate(req.id)}
                disabled={markDoneMutation.isPending}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
                data-testid={`button-mark-done-${req.id}`}
              >
                Mark Done
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5" data-testid="list-join-requests">
      <div className="flex justify-end">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
          style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--muted-warm)" }}
          data-testid="button-export-requests-csv"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>Needs Action</h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: "#e53e3e" }}>{pending.length}</span>
          </div>
          <div className="space-y-2">{pending.map(renderRequest)}</div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-base mb-3" style={{ color: "var(--muted-warm)" }}>All Requests</h3>
          <div className="space-y-2">{rest.map(renderRequest)}</div>
        </div>
      )}
    </div>
  );
}

interface Proposal {
  id: string;
  userId: string;
  clubName: string;
  category: string;
  vibe: string;
  shortDesc: string;
  city: string;
  schedule: string;
  motivation: string;
  status: string;
  reviewNote: string | null;
  createdAt: string | null;
  userName: string | null;
  userEmail: string | null;
}

function CommissionEditPopover({
  clubId,
  currentType,
  currentValue,
  onSaved,
}: {
  clubId: string;
  currentType: string | null;
  currentValue: number | null;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<"percentage" | "fixed">(currentType === "fixed" ? "fixed" : "percentage");
  const [rawValue, setRawValue] = useState(() => {
    if (currentValue === null) return "";
    if (currentType === "percentage") return String(Math.round(currentValue / 100));
    return String(Math.round(currentValue / 100));
  });
  const [note, setNote] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const numVal = parseFloat(rawValue);
      if (isNaN(numVal) || numVal < 0) throw new Error("Invalid value");
      const commissionValue = type === "percentage" ? Math.round(numVal * 100) : Math.round(numVal * 100);
      const res = await apiRequest("PATCH", `/api/admin/clubs/${clubId}/commission`, {
        commissionType: type,
        commissionValue,
        commissionNote: note || undefined,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(e.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      toast({ title: "Commission updated" });
      onSaved?.();
    },
    onError: (e: Error) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const suffix = type === "percentage" ? "%" : "₹";
  const placeholder = type === "percentage" ? "e.g. 7" : "e.g. 10";

  return (
    <div className="rounded-xl p-3 space-y-2.5 mt-2" style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }} data-testid="commission-edit-popover">
      <div className="flex rounded-lg overflow-hidden border-[1.5px] border-[var(--warm-border)]">
        <button
          onClick={() => setType("percentage")}
          className={`flex-1 py-1.5 text-xs font-bold transition-all ${type === "percentage" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
          data-testid="button-commission-type-percentage"
        >Percentage</button>
        <button
          onClick={() => setType("fixed")}
          className={`flex-1 py-1.5 text-xs font-bold transition-all ${type === "fixed" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
          data-testid="button-commission-type-fixed"
        >Fixed</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.5"
          value={rawValue}
          onChange={e => setRawValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--warm-white)]"
          data-testid="input-commission-value"
        />
        <span className="text-sm font-bold text-[var(--muted-warm)]">{suffix}</span>
      </div>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Optional note (internal)..."
        className="w-full px-3 py-1.5 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--warm-white)]"
        data-testid="input-commission-note"
      />
      <button
        onClick={() => updateMutation.mutate()}
        disabled={updateMutation.isPending || !rawValue}
        className="w-full py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
        style={{ background: "var(--ink)" }}
        data-testid="button-save-commission"
      >
        {updateMutation.isPending ? "Saving..." : "Save Commission"}
      </button>
    </div>
  );
}

function suggestCommission(city: string): { type: "percentage" | "fixed"; value: number; label: string } {
  const lower = city.toLowerCase();
  if (["tirupati", "nellore", "guntur", "warangal"].some(c => lower.includes(c))) {
    return { type: "fixed", value: 10, label: `Suggested for ${city}: ₹10 fixed` };
  }
  if (["vijayawada", "vizag", "coimbatore"].some(c => lower.includes(c))) {
    return { type: "percentage", value: 7, label: `Suggested for ${city}: 7%` };
  }
  if (["kochi", "bengaluru"].some(c => lower.includes(c))) {
    return { type: "percentage", value: 10, label: `Suggested for ${city}: 10%` };
  }
  if (["chennai", "hyderabad"].some(c => lower.includes(c))) {
    return { type: "percentage", value: 15, label: `Suggested for ${city}: 15%` };
  }
  return { type: "percentage", value: 7, label: "Default rate: 7%" };
}

function ProposalsTab() {
  const { toast } = useToast();
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commissionStep, setCommissionStep] = useState<Record<string, { type: "percentage" | "fixed"; value: string; note: string }>>({});

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/admin/club-proposals"],
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, commissionType, commissionValue, commissionNote }: { id: string; commissionType: string; commissionValue: number; commissionNote?: string }) =>
      apiRequest("PATCH", `/api/admin/club-proposals/${id}`, { status: "approved", commissionType, commissionValue, commissionNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/club-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/club-proposals/pending-count"] });
      toast({ title: "Proposal approved", description: "Club created and user promoted to organiser." });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve proposal", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      apiRequest("PATCH", `/api/admin/club-proposals/${id}`, { status: "rejected", reviewNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/club-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/club-proposals/pending-count"] });
      toast({ title: "Proposal rejected" });
    },
    onError: () => toast({ title: "Error", description: "Failed to reject proposal", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-[18px]" />)}
      </div>
    );
  }

  const pending = proposals.filter(p => p.status === "pending");
  const reviewed = proposals.filter(p => p.status !== "pending");

  const statusBadge = (status: string) => {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: "rgba(251,191,36,0.15)", color: "#92400e", label: "Pending" },
      approved: { bg: "rgba(22,163,74,0.12)", color: "#15803d", label: "Approved" },
      rejected: { bg: "rgba(239,68,68,0.12)", color: "#dc2626", label: "Rejected" },
    };
    const c = cfg[status] || cfg.pending;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
  };

  const renderProposal = (p: Proposal) => {
    const isExpanded = expandedId === p.id;
    return (
      <div
        key={p.id}
        className="rounded-[18px] p-4 space-y-3"
        style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
        data-testid={`admin-proposal-${p.id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>{p.clubName}</h3>
              {statusBadge(p.status)}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--muted-warm)" }}>
              by {p.userName || "Unknown"} ({p.userEmail || "no email"})
              {p.createdAt && <> &middot; {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}</>}
            </p>
          </div>
          <button
            onClick={() => setExpandedId(isExpanded ? null : p.id)}
            className="p-1"
            data-testid={`toggle-proposal-${p.id}`}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} style={{ color: "var(--muted-warm)" }} />
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg p-2" style={{ background: "var(--cream)" }}>
                <span className="block font-bold" style={{ color: "var(--muted-warm)" }}>Category</span>
                <span style={{ color: "var(--ink)" }}>{p.category}</span>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--cream)" }}>
                <span className="block font-bold" style={{ color: "var(--muted-warm)" }}>Vibe</span>
                <span className="capitalize" style={{ color: "var(--ink)" }}>{p.vibe}</span>
              </div>
              <div className="rounded-lg p-2" style={{ background: "var(--cream)" }}>
                <span className="block font-bold" style={{ color: "var(--muted-warm)" }}>City</span>
                <span style={{ color: "var(--ink)" }}>{p.city}</span>
              </div>
            </div>
            <div className="text-xs rounded-lg p-2" style={{ background: "var(--cream)" }}>
              <span className="block font-bold mb-0.5" style={{ color: "var(--muted-warm)" }}>Description</span>
              <span style={{ color: "var(--ink)" }}>{p.shortDesc}</span>
            </div>
            <div className="text-xs rounded-lg p-2" style={{ background: "var(--cream)" }}>
              <span className="block font-bold mb-0.5" style={{ color: "var(--muted-warm)" }}>Schedule</span>
              <span style={{ color: "var(--ink)" }}>{p.schedule}</span>
            </div>
            <div className="text-xs rounded-lg p-2" style={{ background: "var(--cream)" }}>
              <span className="block font-bold mb-0.5" style={{ color: "var(--muted-warm)" }}>Motivation</span>
              <span style={{ color: "var(--ink)" }}>{p.motivation}</span>
            </div>

            {p.status === "pending" && (
              <div className="space-y-2 pt-2">
                {commissionStep[p.id] ? (
                  <div className="rounded-xl p-3 space-y-2.5" style={{ background: "rgba(22,163,74,0.04)", border: "1.5px solid rgba(22,163,74,0.2)" }} data-testid={`commission-step-${p.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-green-800">Commission Settings</span>
                      <button onClick={() => setCommissionStep(prev => { const n = { ...prev }; delete n[p.id]; return n; })} className="text-[10px] text-[var(--muted-warm)]">Cancel</button>
                    </div>
                    <div className="rounded-lg px-3 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(22,163,74,0.1)", color: "#15803d" }}>
                      💡 {suggestCommission(p.city).label}
                    </div>
                    <div className="flex rounded-lg overflow-hidden border-[1.5px] border-[var(--warm-border)]">
                      <button
                        onClick={() => setCommissionStep(prev => ({ ...prev, [p.id]: { ...prev[p.id], type: "percentage" } }))}
                        className={`flex-1 py-1.5 text-xs font-bold ${commissionStep[p.id].type === "percentage" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
                        data-testid={`button-commission-percentage-${p.id}`}
                      >%</button>
                      <button
                        onClick={() => setCommissionStep(prev => ({ ...prev, [p.id]: { ...prev[p.id], type: "fixed" } }))}
                        className={`flex-1 py-1.5 text-xs font-bold ${commissionStep[p.id].type === "fixed" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
                        data-testid={`button-commission-fixed-${p.id}`}
                      >₹ Fixed</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={commissionStep[p.id].value}
                        onChange={e => setCommissionStep(prev => ({ ...prev, [p.id]: { ...prev[p.id], value: e.target.value } }))}
                        placeholder={commissionStep[p.id].type === "percentage" ? "e.g. 7" : "e.g. 10"}
                        className="flex-1 px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--warm-white)]"
                        data-testid={`input-commission-value-${p.id}`}
                      />
                      <span className="text-sm font-bold text-[var(--muted-warm)]">{commissionStep[p.id].type === "percentage" ? "%" : "₹"}</span>
                    </div>
                    <input
                      type="text"
                      value={commissionStep[p.id].note}
                      onChange={e => setCommissionStep(prev => ({ ...prev, [p.id]: { ...prev[p.id], note: e.target.value } }))}
                      placeholder="Internal note (optional)..."
                      className="w-full px-3 py-1.5 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--warm-white)]"
                      data-testid={`input-commission-note-${p.id}`}
                    />
                    <button
                      onClick={() => {
                        const cs = commissionStep[p.id];
                        const numVal = parseFloat(cs.value);
                        if (isNaN(numVal) || numVal < 0) { toast({ title: "Invalid commission value", variant: "destructive" }); return; }
                        const commissionValue = Math.round(numVal * 100);
                        approveMutation.mutate({ id: p.id, commissionType: cs.type, commissionValue, commissionNote: cs.note || undefined });
                      }}
                      disabled={approveMutation.isPending || !commissionStep[p.id].value}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: "#15803d" }}
                      data-testid={`button-confirm-approve-${p.id}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {approveMutation.isPending ? "Approving..." : "Confirm Approve"}
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={rejectNote[p.id] || ""}
                      onChange={e => setRejectNote(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Optional note (shown if rejected)..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-2 resize-none"
                      style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)", "--tw-ring-color": "rgba(196,98,45,0.3)" } as React.CSSProperties}
                      data-testid={`input-reject-note-${p.id}`}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const suggestion = suggestCommission(p.city);
                          setCommissionStep(prev => ({ ...prev, [p.id]: { type: suggestion.type, value: String(suggestion.value), note: "" } }));
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5"
                        style={{ background: "#15803d" }}
                        data-testid={`button-approve-proposal-${p.id}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ id: p.id, reviewNote: rejectNote[p.id] || undefined })}
                        disabled={rejectMutation.isPending}
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5"
                        style={{ background: "#dc2626" }}
                        data-testid={`button-reject-proposal-${p.id}`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {p.status === "rejected" && p.reviewNote && (
              <div className="text-xs rounded-lg p-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                <span className="block font-bold mb-0.5" style={{ color: "#dc2626" }}>Rejection Note</span>
                <span style={{ color: "#dc2626" }}>{p.reviewNote}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="section-proposals-tab">
      {proposals.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--terra-pale)" }}>
            <Send className="w-7 h-7" style={{ color: "var(--terra)" }} />
          </div>
          <h3 className="font-display text-lg font-bold mb-1" style={{ color: "var(--ink)" }}>No Proposals Yet</h3>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>Club proposals from users will appear here.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>Pending Review</h3>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ background: "#e53e3e" }}>{pending.length}</span>
          </div>
          <div className="space-y-3">{pending.map(renderProposal)}</div>
        </div>
      )}

      {reviewed.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-base mb-3" style={{ color: "var(--muted-warm)" }}>Reviewed</h3>
          <div className="space-y-3">{reviewed.map(renderProposal)}</div>
        </div>
      )}
    </div>
  );
}

interface AdminTransaction {
  id: string;
  eventId: string;
  rsvpId: string;
  clubId: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpayTransferId?: string | null;
  totalAmount: number;
  baseAmount: number;
  platformFee: number;
  currency: string;
  status: string;
  createdAt: string;
  eventTitle?: string;
  clubName?: string;
  userName?: string | null;
}

interface AdminPaymentsResponse {
  platformRevenue: number;
  totalVolume: number;
  pendingCount: number;
  failedCount: number;
  topClubs: { clubId: string; clubName: string; city: string; totalVolume: number; organizerReceived: number; platformEarned: number }[];
  commissionRates: { clubId: string; clubName: string; city: string; commissionType: string | null; commissionValue: number | null; totalTickets: number; totalEarned: number }[];
  transactions: AdminTransaction[];
  total: number;
  page: number;
  limit: number;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TxStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    transferred: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PaymentsTab() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<AdminPaymentsResponse>({
    queryKey: ["/api/admin/payments", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/admin/payments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (txId: string) => {
      const res = await apiRequest("POST", `/api/admin/payments/retry/${txId}`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Retry failed" }));
        throw new Error(err.message || "Retry failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Transfer retried!", description: "The payout has been re-attempted." });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });

  const retryAllMutation = useMutation({
    mutationFn: async () => {
      const allData = await apiRequest("GET", `/api/admin/payments?page=1&limit=500&status=failed`).then(r => r.json());
      const failedIds: string[] = (allData.transactions as AdminTransaction[]).filter(t => t.status === "failed").map(t => t.id);
      for (const id of failedIds) {
        await apiRequest("POST", `/api/admin/payments/retry/${id}`, {}).catch(() => {});
      }
      return failedIds.length;
    },
    onSuccess: (count) => {
      toast({ title: `Retried ${count} failed transfers` });
      refetch();
    },
    onError: () => toast({ title: "Retry all failed", variant: "destructive" }),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-4" data-testid="section-admin-payments">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>Payment Dashboard</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const res = await apiRequest("GET", `/api/admin/payments?page=1&limit=10000`);
                const allData = await res.json();
                const rows = (allData.transactions as AdminTransaction[]).map(tx => [
                  new Date(tx.createdAt).toLocaleString("en-IN"),
                  tx.userName || tx.userId,
                  tx.eventTitle || tx.eventId,
                  tx.clubName || tx.clubId,
                  String(tx.totalAmount / 100),
                  String(tx.platformFee / 100),
                  String(tx.baseAmount / 100),
                  tx.status,
                  tx.razorpayPaymentId,
                ]);
                downloadCSV("cultfam-payments.csv", rows, ["Date", "User", "Event", "Club", "Total (₹)", "Platform Fee (₹)", "Organiser (₹)", "Status", "Payment ID"]);
              } catch { toast({ title: "Export failed", variant: "destructive" }); }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity hover:opacity-70"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="button-export-csv"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button onClick={() => refetch()} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="button-refresh-payments">
            <RefreshCw className="w-4 h-4" style={{ color: "var(--terra)" }} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="stat-total-volume">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Total Volume</div>
            <div className="font-display text-xl font-black" style={{ color: "var(--terra)" }}>{fmt(data.totalVolume)}</div>
            <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>{data.total} transactions</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="stat-platform-fees">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Platform Revenue</div>
            <div className="font-display text-xl font-black" style={{ color: "var(--ink)" }}>{fmt(data.platformRevenue)}</div>
            <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>CultFam earnings</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="stat-pending">
            <div className="flex items-center gap-1 mb-0.5">
              <Clock className="w-3 h-3 text-amber-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Pending</div>
            </div>
            <div className="font-display text-xl font-black text-amber-700">{data.pendingCount}</div>
            <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>transfers</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: data.failedCount > 0 ? "rgba(220,38,38,0.04)" : "var(--warm-white)", border: `1.5px solid ${data.failedCount > 0 ? "rgba(220,38,38,0.2)" : "var(--warm-border)"}` }} data-testid="stat-failed">
            <div className="flex items-center gap-1 mb-0.5">
              <XCircle className="w-3 h-3 text-red-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Failed</div>
            </div>
            <div className="font-display text-xl font-black text-red-700">{data.failedCount}</div>
            {data.failedCount > 0 ? (
              <button
                onClick={() => retryAllMutation.mutate()}
                disabled={retryAllMutation.isPending}
                className="mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full disabled:opacity-50"
                style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.3)" }}
                data-testid="button-retry-all"
              >
                {retryAllMutation.isPending ? "Retrying..." : "Retry All"}
              </button>
            ) : (
              <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>transfers</div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap" data-testid="section-filters">
        {["all", "transferred", "pending", "failed"].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={statusFilter === s
              ? { background: "var(--terra)", color: "white" }
              : { background: "var(--warm-white)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }}
            data-testid={`filter-${s}`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />)}
        </div>
      ) : data && data.transactions.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="empty-payments">
          <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--terra)" }} />
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>No transactions found.</p>
        </div>
      ) : (
        <div className="rounded-[18px] overflow-hidden" style={{ border: "1.5px solid var(--warm-border)" }} data-testid="section-transactions">
          <div className="grid text-[10px] font-bold uppercase tracking-wider px-3 py-2" style={{ background: "var(--cream)", color: "var(--muted-warm)", gridTemplateColumns: "1.8fr 1.2fr 1.2fr 0.9fr 0.9fr 0.9fr auto auto" }}>
            <span>Date/Event</span>
            <span>User</span>
            <span>Club</span>
            <span className="text-right">Total</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Organiser</span>
            <span>Status</span>
            <span></span>
          </div>
          {data?.transactions.map((tx, i) => (
            <div
              key={tx.id}
              className="grid items-center px-3 py-2.5 text-xs"
              style={{ gridTemplateColumns: "1.8fr 1.2fr 1.2fr 0.9fr 0.9fr 0.9fr auto auto", borderTop: i > 0 ? "1px solid var(--warm-border)" : undefined, background: i % 2 === 0 ? "var(--warm-white)" : "var(--cream)" }}
              data-testid={`admin-tx-${tx.id}`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-bold truncate" style={{ color: "var(--ink)" }}>{tx.eventTitle || "Event"}</div>
                <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>{new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
              </div>
              <div className="truncate pr-1" style={{ color: "var(--ink)" }}>{tx.userName || "—"}</div>
              <div className="truncate pr-1" style={{ color: "var(--muted-warm)" }}>{tx.clubName || "—"}</div>
              <div className="text-right font-bold" style={{ color: "var(--ink)" }}>{fmt(tx.totalAmount)}</div>
              <div className="text-right" style={{ color: "var(--terra)" }}>{fmt(tx.platformFee)}</div>
              <div className="text-right" style={{ color: "var(--muted-warm)" }}>{fmt(tx.baseAmount)}</div>
              <div className="px-1"><TxStatusBadge status={tx.status} /></div>
              <div>
                {tx.status === "failed" && (
                  <button
                    onClick={() => retryMutation.mutate(tx.id)}
                    disabled={retryMutation.isPending}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                    style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.25)" }}
                    data-testid={`button-retry-${tx.id}`}
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2" data-testid="section-pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="button-prev-page"
          >
            Previous
          </button>
          <span className="text-xs" style={{ color: "var(--muted-warm)" }}>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
            data-testid="button-next-page"
          >
            Next
          </button>
        </div>
      )}

      {/* Top Clubs by Revenue */}
      {data?.topClubs && data.topClubs.length > 0 && (
        <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="section-top-clubs">
          <h3 className="text-sm font-bold mb-3" style={{ color: "var(--ink)" }}>Top Clubs by Revenue</h3>
          <div className="space-y-2">
            {data.topClubs.map((tc, i) => (
              <div key={tc.clubId} className="flex items-center justify-between py-2" style={{ borderBottom: i < data.topClubs.length - 1 ? "1px solid var(--warm-border)" : undefined }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[11px] font-bold w-5 shrink-0 text-center" style={{ color: "var(--muted-warm)" }}>#{i + 1}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>{tc.clubName}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>{tc.city}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="text-xs font-bold" style={{ color: "var(--ink)" }}>₹{(tc.totalVolume / 100).toLocaleString("en-IN")} total</div>
                  <div className="text-[10px] font-semibold" style={{ color: "var(--terra)" }}>CultFam: ₹{(tc.platformEarned / 100).toLocaleString("en-IN")}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>Organiser: ₹{(tc.organizerReceived / 100).toLocaleString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commission Rates per Club */}
      {data?.commissionRates && data.commissionRates.length > 0 && (
        <CommissionRatesSection commissionRates={data.commissionRates} onUpdated={() => refetch()} />
      )}
    </div>
  );
}

function CommissionRatesSection({ commissionRates, onUpdated }: {
  commissionRates: { clubId: string; clubName: string; city: string; commissionType: string | null; commissionValue: number | null; totalTickets: number; totalEarned: number }[];
  onUpdated: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-[18px] p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="section-commission-rates">
      <h3 className="text-sm font-bold mb-3" style={{ color: "var(--ink)" }}>Commission Rates by Club</h3>
      <div className="space-y-0">
        {commissionRates.map((cr, i) => (
          <div key={cr.clubId} style={{ borderBottom: i < commissionRates.length - 1 ? "1px solid var(--warm-border)" : undefined }}>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>{cr.clubName}</div>
                  <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>
                    {cr.city} · {cr.totalTickets} tickets
                    {cr.totalEarned > 0 && <span className="font-semibold text-[var(--terra)]"> · CultFam: ₹{(cr.totalEarned / 100).toLocaleString("en-IN")}</span>}
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: cr.commissionType ? "rgba(196,98,45,0.1)" : "var(--cream)",
                    color: "var(--terra)",
                    border: "1px solid rgba(196,98,45,0.2)",
                    opacity: cr.commissionType ? 1 : 0.65,
                  }}
                >
                  {cr.commissionType === "fixed"
                    ? `₹${((cr.commissionValue ?? 0) / 100).toFixed(0)} fixed`
                    : cr.commissionType === "percentage"
                      ? `${((cr.commissionValue ?? 700) / 100).toFixed(0)}%`
                      : "7% default"}
                </span>
              </div>
              <button
                onClick={() => setOpenId(openId === cr.clubId ? null : cr.clubId)}
                className="ml-2 shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg hover:opacity-70 transition-opacity"
                style={{ background: "var(--cream)", color: "var(--ink)", border: "1.5px solid var(--warm-border)" }}
                data-testid={`button-edit-commission-${cr.clubId}`}
              >
                {openId === cr.clubId ? "Close" : "Edit"}
              </button>
            </div>
            {openId === cr.clubId && (
              <CommissionEditPopover
                clubId={cr.clubId}
                currentType={cr.commissionType}
                currentValue={cr.commissionValue}
                onSaved={() => { setOpenId(null); onUpdated(); }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

