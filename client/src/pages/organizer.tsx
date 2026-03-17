import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { LayoutDashboard, Users, Loader2, ShieldCheck, Eye, Users2, FileText, IndianRupee, Settings } from "lucide-react";
import type { Club, JoinRequest } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// ── Lazy-loaded tab components ──────────────────────────────────────────────
const OverviewTab      = lazy(() => import("./organizer/OverviewTab"));
const InsightsTab      = lazy(() => import("./organizer/InsightsTab"));
const RequestsTab      = lazy(() => import("./organizer/RequestsTab"));
const MembersTab       = lazy(() => import("./organizer/MembersTab"));
const EventsTab        = lazy(() => import("./organizer/EventsTab"));
const ContentTab       = lazy(() => import("./organizer/ContentTab"));
const AnnouncementsTab = lazy(() => import("./organizer/AnnouncementsTab"));
const EditTab          = lazy(() => import("./organizer/EditTab"));
const EarningsTab      = lazy(() => import("./organizer/EarningsTab"));

// ── Tab-level Suspense fallback ───────────────────────────────────────────
function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--terra)]" />
    </div>
  );
}

// ── New 5-tab structure ────────────────────────────────────────────────────
type TabKey = "overview" | "people" | "content" | "revenue" | "settings";

// Normalize legacy URL tab params to new tab keys
function normalizeTab(raw: string | null): TabKey {
  if (!raw) return "overview";
  const legacyMap: Record<string, TabKey> = {
    overview: "overview",
    insights: "overview",
    requests: "people",
    members: "people",
    announcements: "people",
    broadcast: "people",
    events: "content",
    content: "content",
    earnings: "revenue",
    revenue: "revenue",
    edit: "settings",
    settings: "settings",
  };
  return legacyMap[raw] ?? "overview";
}

// Sub-section states for grouped tabs
type PeopleSection = "requests" | "members" | "broadcast";
type ContentSection = "events" | "posts";
type OverviewSection = "overview" | "insights";

interface TabBarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  clubId: string;
  isCreator?: boolean;
}

function OrganizerTabBar({ activeTab, setActiveTab, clubId, isCreator }: TabBarProps) {
  const { data: requests = [] } = useQuery<JoinRequest[]>({
    queryKey: ["/api/organizer/join-requests", clubId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/join-requests/${clubId}`);
      return res.json();
    },
  });
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const allTabs: { key: TabKey; label: string; icon: React.ElementType; creatorOnly?: boolean }[] = [
    { key: "overview",  label: "Overview",  icon: Eye },
    { key: "people",    label: "People",    icon: Users2 },
    { key: "content",   label: "Content",   icon: FileText },
    { key: "revenue",   label: "Revenue",   icon: IndianRupee },
    ...(isCreator ? [{ key: "settings" as TabKey, label: "Settings", icon: Settings }] : []),
  ];

  return (
    <div className="flex mb-6 overflow-x-auto -mx-4 px-4" style={{ borderBottom: "1.5px solid var(--warm-border)", scrollbarWidth: "none" }}>
      {allTabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`px-4 py-2.5 text-sm font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 border-b-2 -mb-px shrink-0 ${activeTab === key ? "border-[var(--terra)] text-[var(--terra)]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          data-testid={`tab-organizer-${key}`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
          {key === "people" && pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[var(--terra)] text-white" data-testid="badge-pending-requests">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Overview tab: Summary + Insights grouped ──────────────────────────────
function OverviewGroupTab({ club, user, setActiveTab, setContentSection }: {
  club: Club;
  user: ReturnType<typeof useAuth>["user"];
  setActiveTab: (tab: TabKey) => void;
  setContentSection: (s: ContentSection) => void;
}) {
  const [section, setSection] = useState<OverviewSection>("overview");
  const sections: { key: OverviewSection; label: string }[] = [
    { key: "overview",  label: "Summary" },
    { key: "insights",  label: "Insights" },
  ];

  // Mapper from old OverviewTab calls to new tab keys
  const handleOldTabNav = (oldTab: string) => {
    if (oldTab === "requests" || oldTab === "members" || oldTab === "announcements" || oldTab === "broadcast") {
      setActiveTab("people");
    } else if (oldTab === "events") {
      setContentSection("events");
      setActiveTab("content");
    } else if (oldTab === "content") {
      setActiveTab("content");
    } else if (oldTab === "earnings") {
      setActiveTab("revenue");
    } else if (oldTab === "edit") {
      setActiveTab("settings");
    } else if (oldTab === "insights") {
      setSection("insights");
    }
  };

  // Maps OverviewTab's content sub-section names to ContentGroupTab's section keys
  const handleContentSubSection = (s: "faqs" | "schedule" | "moments") => {
    setContentSection(s === "moments" ? "posts" : "events");
  };

  return (
    <div className="space-y-4" data-testid="section-overview-group">
      <div className="flex gap-2 flex-wrap">
        {sections.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${section === key ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
            style={{ borderRadius: 18 }}
            data-testid={`tab-overview-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabFallback />}>
        {section === "overview" && (
          <OverviewTab
            club={club}
            user={user}
            setActiveTab={handleOldTabNav as (tab: "overview" | "requests" | "insights" | "events" | "content" | "edit" | "announcements" | "earnings") => void}
            setContentInitialSection={handleContentSubSection}
          />
        )}
        {section === "insights" && <InsightsTab clubId={club.id} />}
      </Suspense>
    </div>
  );
}

// ── People tab: Requests + Members + Broadcast grouped ────────────────────
function PeopleTab({ clubId, club }: { clubId: string; club: Club }) {
  const [section, setSection] = useState<PeopleSection>("requests");
  const sections: { key: PeopleSection; label: string }[] = [
    { key: "requests",  label: "Requests" },
    { key: "members",   label: "Members" },
    { key: "broadcast", label: "Broadcast" },
  ];

  return (
    <div className="space-y-4" data-testid="section-people">
      <div className="flex gap-2 flex-wrap">
        {sections.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${section === key ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
            style={{ borderRadius: 18 }}
            data-testid={`tab-people-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabFallback />}>
        {section === "requests"  && <RequestsTab clubId={clubId} club={club} />}
        {section === "members"   && <MembersTab clubId={clubId} />}
        {section === "broadcast" && <AnnouncementsTab clubId={clubId} />}
      </Suspense>
    </div>
  );
}

// ── Content tab: Events + Posts (FAQs/Schedule/Moments) grouped ───────────
function ContentGroupTab({ clubId, section, setSection }: {
  clubId: string;
  section: ContentSection;
  setSection: (s: ContentSection) => void;
}) {
  const sections: { key: ContentSection; label: string }[] = [
    { key: "events", label: "Events" },
    { key: "posts",  label: "Posts & Media" },
  ];

  return (
    <div className="space-y-4" data-testid="section-content">
      <div className="flex gap-2 flex-wrap">
        {sections.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${section === key ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
            style={{ borderRadius: 18 }}
            data-testid={`tab-content-group-${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Suspense fallback={<TabFallback />}>
        {section === "events" && <EventsTab clubId={clubId} />}
        {section === "posts"  && <ContentTab clubId={clubId} />}
      </Suspense>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Organizer() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const rawTab = new URLSearchParams(searchString).get("tab");
  const [activeTab, setActiveTab] = useState<TabKey>(normalizeTab(rawTab));
  const [selectedClubIndex, setSelectedClubIndex] = useState(0);
  const [contentSection, setContentSection] = useState<ContentSection>("events");

  const { data: clubs = [], isLoading, error } = useQuery<Club[]>({
    queryKey: ["/api/organizer/my-clubs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/organizer/my-clubs");
      return res.json();
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const club = clubs.length > 0 ? clubs[selectedClubIndex] || clubs[0] : null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] flex items-center justify-center mx-auto" style={{ borderRadius: 18 }}>
            <LayoutDashboard className="w-8 h-8 text-[var(--terra)]" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--terra)]" data-testid="text-organizer-title">Organizer Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to access your club dashboard</p>
          <button onClick={() => { window.location.href = "/login"; }} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold" data-testid="button-organizer-sign-in">Sign In</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="h-7 w-48 rounded-lg animate-pulse" style={{ background: "var(--warm-border)" }} />
          <div className="h-4 w-32 rounded-lg animate-pulse" style={{ background: "var(--warm-border)" }} />
          <div className="flex gap-2 mt-4">{[1,2,3,4,5].map(i=><div key={i} className="h-9 w-20 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}/>)}</div>
          <div className="grid grid-cols-2 gap-3 mt-4">{[1,2,3,4].map(i=><div key={i} className="h-24 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}/>)}</div>
        </div>
      </div>
    );
  }

  if (error || clubs.length === 0 || !club) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] flex items-center justify-center mx-auto" style={{ borderRadius: 18 }}>
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--terra)]" data-testid="text-no-club-title">No Clubs Yet</h1>
          <p className="text-sm text-muted-foreground mt-1">You aren't managing any clubs yet. Create one or ask a club owner to add you as a co-organizer.</p>
          <button onClick={() => navigate("/create")} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold" data-testid="button-go-create-club">Propose a Club</button>
        </div>
      </div>
    );
  }

  const isCreator = user?.id === club.creatorUserId;

  return (
    <div className="min-h-screen bg-[var(--cream)] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--terra)]" data-testid="text-organizer-dashboard">{club.emoji} {club.name}</h1>
            {!isCreator ? (
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3 text-[var(--terra)]" />
                <p className="text-xs font-medium text-[var(--terra)]" data-testid="text-co-organizer-badge">Co-organizer</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Organizer Dashboard</p>
            )}
          </div>
        </div>

        {clubs.length > 1 && (
          <div className="mb-6" data-testid="section-club-switcher">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Switch Club</label>
            <div className="flex gap-2 overflow-x-auto flex-wrap">
              {clubs.map((c, index) => (
                <button key={c.id} onClick={() => { setSelectedClubIndex(index); setActiveTab("overview"); }}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${selectedClubIndex === index ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`}
                  style={{ borderRadius: 18 }} data-testid={`button-switch-club-${c.id}`}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <OrganizerTabBar activeTab={activeTab} setActiveTab={setActiveTab} clubId={club.id} isCreator={isCreator} />

        <Suspense fallback={<TabFallback />}>
          {activeTab === "overview" && <OverviewGroupTab club={club} user={user} setActiveTab={setActiveTab} setContentSection={setContentSection} />}
          {activeTab === "people"   && <PeopleTab clubId={club.id} club={club} />}
          {activeTab === "content"  && <ContentGroupTab clubId={club.id} section={contentSection} setSection={setContentSection} />}
          {activeTab === "revenue"  && <EarningsTab club={club} />}
          {activeTab === "settings" && isCreator && <EditTab club={club} />}
        </Suspense>
      </div>
    </div>
  );
}
