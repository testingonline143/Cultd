import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ChevronLeft, Share2, MapPin, Calendar, Users, ArrowRight, Star, MessageCircle, User, Settings, Plus, LayoutDashboard, Clock, Activity, LogOut, Clock3, CheckCircle2, XCircle, Sparkles, Camera, Megaphone, Heart, Trash2, Send, X, BarChart2, Pin, ImageIcon, Loader2, Crown, Repeat } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Club, ClubFaq, ClubScheduleEntry, ClubMoment, MomentComment, ClubAnnouncement } from "@shared/schema";

interface ClubEvent {
  id: string;
  title: string;
  startsAt: string;
  locationText: string;
  maxCapacity: number;
  rsvpCount: number;
  recurrenceRule: string | null;
}

export default function ClubDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: club, isLoading, error } = useQuery<Club>({
    queryKey: ["/api/clubs", id],
  });

  if (isLoading) {
    return <ClubDetailSkeleton />;
  }

  if (error || !club) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="text-4xl mb-4">
            <User className="w-12 h-12 mx-auto text-muted-foreground" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground mb-2" data-testid="text-club-not-found">
            Club not found
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            This club may have been removed or the link is incorrect.
          </p>
          <Button onClick={() => navigate("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  if (club.isActive === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <h2 className="font-display text-xl font-bold text-foreground mb-2" data-testid="text-club-inactive">
            This club is currently inactive
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {club.name} has been temporarily deactivated. Check back later or explore other clubs.
          </p>
          <Button onClick={() => navigate("/explore")} data-testid="button-explore-clubs">
            Explore Other Clubs
          </Button>
        </Card>
      </div>
    );
  }

  return <ClubDetailContent club={club} />;
}

function getClubPublicUrl(club: Club): string {
  return club.slug
    ? `${window.location.origin}/c/${club.slug}`
    : `${window.location.origin}/club/${club.id}`;
}

function ClubDetailContent({ club }: { club: Club }) {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isOwner = !!(user && club.creatorUserId && user.id === club.creatorUserId);
  const joinFormRef = useRef<HTMLDivElement>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinName, setJoinName] = useState(user?.firstName || "");
  const [joinPhone, setJoinPhone] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinAnswer1, setJoinAnswer1] = useState("");
  const [joinAnswer2, setJoinAnswer2] = useState("");
  const [activeTab, setActiveTab] = useState("meet-ups");
  const [showShareSheet, setShowShareSheet] = useState(false);

  const { data: activity } = useQuery<{ recentJoins: number; recentJoinNames: string[]; totalEvents: number; lastEventDate: string | null }>({
    queryKey: ["/api/clubs", club.id, "activity"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${club.id}/activity`);
      if (!res.ok) return { recentJoins: 0, recentJoinNames: [], totalEvents: 0, lastEventDate: null };
      return res.json();
    },
  });

  const { data: ratingsData } = useQuery<{ average: number; count: number; userRating: { rating: number; review: string | null } | null; hasJoined: boolean }>({
    queryKey: ["/api/clubs", club.id, "ratings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${club.id}/ratings`);
      return res.json();
    },
  });

  const { data: joinCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/clubs", club.id, "join-count"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${club.id}/join-count`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
  });

  const { data: membersPreview = [] } = useQuery<{ userId: string | null; name: string; profileImageUrl: string | null }[]>({
    queryKey: ["/api/clubs", club.id, "members-preview"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${club.id}/members-preview`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: joinStatus } = useQuery<{ status: string | null; requestId: string | null }>({
    queryKey: ["/api/clubs", club.id, "join-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${club.id}/join-status`);
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/clubs/${club.id}/leave`);
      if (!res.ok) throw new Error("Failed to leave");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "join-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/join-requests"] });
      setJoinSuccess(false);
    },
  });

  const [showRatingForm, setShowRatingForm] = useState(false);
  const [selectedRating, setSelectedRating] = useState(ratingsData?.userRating?.rating || 0);
  const [reviewText, setReviewText] = useState(ratingsData?.userRating?.review || "");

  useEffect(() => {
    if (ratingsData?.userRating) {
      setSelectedRating(ratingsData.userRating.rating);
      setReviewText(ratingsData.userRating.review || "");
    }
  }, [ratingsData?.userRating]);

  const ratingMutation = useMutation({
    mutationFn: async (data: { rating: number; review?: string }) => {
      const res = await apiRequest("POST", `/api/clubs/${club.id}/ratings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "ratings"] });
      setShowRatingForm(false);
    },
  });

  const activeCount = joinCountData?.count ?? Math.max(1, Math.round(club.memberCount * 0.25));
  const avgRating = ratingsData?.average ?? 0;
  const ratingCount = ratingsData?.count ?? 0;

  useEffect(() => {
    setJoinName(user?.firstName || "");
  }, [user]);

  useEffect(() => {
    if (showJoinForm && joinFormRef.current) {
      joinFormRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showJoinForm]);

  const joinMutation = useMutation({
    mutationFn: async (data: { clubId: string; clubName: string; name: string; phone: string; answer1?: string; answer2?: string }) => {
      const res = await apiRequest("POST", "/api/join", data);
      return res.json();
    },
    onSuccess: () => {
      setJoinSuccess(true);
      setShowJoinForm(false);
      setJoinName("");
      setJoinPhone("");
      setJoinAnswer1("");
      setJoinAnswer2("");
      setJoinError("");
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs-with-activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "ratings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", club.id, "join-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/join-requests"] });
    },
    onError: async (err: any) => {
      try {
        const msg = err?.message || "Something went wrong. Please try again.";
        setJoinError(msg);
      } catch {
        setJoinError("Something went wrong. Please try again.");
      }
    },
  });

  const foundingSpotsLeft = (club.foundingTotal ?? 20) - (club.foundingTaken ?? 0);
  const foundingProgress = ((club.foundingTaken ?? 0) / (club.foundingTotal ?? 20)) * 100;
  const allFoundingTaken = foundingSpotsLeft <= 0;

  const handleJoinSubmit = () => {
    setJoinError("");
    if (!joinName || joinName.length < 2) {
      setJoinError("Name is required (minimum 2 characters)");
      return;
    }
    const digitsOnly = joinPhone.replace(/\D/g, "");
    if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 15) {
      setJoinError("Enter a valid mobile number (10\u201315 digits)");
      return;
    }
    if ((club as any).joinQuestion1 && !joinAnswer1.trim()) {
      setJoinError("Please answer the required question");
      return;
    }
    joinMutation.mutate({
      clubId: club.id,
      clubName: club.name,
      name: joinName,
      phone: joinPhone,
      ...(joinAnswer1.trim() && { answer1: joinAnswer1.trim() }),
      ...(joinAnswer2.trim() && { answer2: joinAnswer2.trim() }),
    });
  };

  const tags: string[] = [];
  if (club.highlights && club.highlights.length > 0) {
    tags.push(...club.highlights);
  }
  if (club.vibe === "casual") {
    tags.push("Beginner-friendly");
  }
  if (club.city) {
    tags.push(club.city);
  }
  if (club.timeOfDay) {
    tags.push(club.timeOfDay.charAt(0).toUpperCase() + club.timeOfDay.slice(1));
  }

  const isApprovedMember = isOwner || joinStatus?.status === "approved";

  const { data: announcements = [] } = useQuery<ClubAnnouncement[]>({
    queryKey: ["/api/clubs", club.id, "announcements"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${club.id}/announcements`);
      return res.json();
    },
  });

  const { data: momentsForGallery = [] } = useQuery<ClubMoment[]>({
    queryKey: ["/api/clubs", club.id, "moments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${club.id}/moments`);
      return res.json();
    },
  });

  const hasImages = momentsForGallery.some(m => m.imageUrl);
  const pinnedAnnouncement = announcements.find(a => a.isPinned) || null;

  const tabs = [
    { id: "meet-ups", label: "Meet-ups" },
    { id: "schedule", label: "Schedule" },
    { id: "moments", label: "Moments" },
    ...(hasImages ? [{ id: "gallery", label: "Gallery" }] : []),
    { id: "about", label: "About" },
    { id: "values", label: "Values" },
    { id: "faqs", label: "FAQs" },
    { id: "leaders", label: "Leaders" },
    { id: "members", label: "Members" },
  ];

  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="relative h-72 w-full overflow-hidden">
        {club.coverImageUrl ? (
          <>
            <img src={club.coverImageUrl} alt={club.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-[var(--cream)]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#E8D5B8] via-[#C4A882] to-[#A88860] flex items-center justify-center">
              <span className="text-[90px] select-none relative z-[2]" data-testid="text-club-emoji">{club.emoji}</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--cream)]" style={{ top: '30%' }} />
          </>
        )}

        <button
          onClick={() => navigate("/explore")}
          className="absolute top-14 left-5 w-9 h-9 rounded-xl bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"
          style={{ border: '1px solid var(--warm-border)' }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 text-[var(--ink)]" />
        </button>

        <button
          onClick={() => setShowShareSheet(true)}
          className="absolute top-14 right-5 w-9 h-9 rounded-xl bg-white/80 backdrop-blur-sm flex items-center justify-center z-10"
          style={{ border: '1px solid var(--warm-border)' }}
          data-testid="button-share-club"
        >
          <Share2 className="w-4 h-4 text-[var(--ink)]" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-5 z-[5]">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-white text-[11px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-md" style={{ background: 'var(--terra)' }} data-testid="badge-category">
              {club.category}
            </span>
            {club.schedule && (
              <span className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[var(--ink3)]" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="badge-schedule">
                {club.schedule}
              </span>
            )}
          </div>
          <h1
            className="font-display text-4xl font-black text-[var(--ink)] leading-[0.95] tracking-tight"
            data-testid="text-club-name"
          >
            {club.name}
          </h1>
          {club.shortDesc && (
            <p className="font-display text-[13px] italic text-[var(--ink3)] mt-1.5" data-testid="text-club-tagline">
              {club.shortDesc}
            </p>
          )}
        </div>
      </div>

      <div className="mx-6 mt-3 rounded-2xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, var(--terra-pale), rgba(201,168,76,0.08))', border: '1.5px solid rgba(196,98,45,0.2)' }} data-testid="card-founding">
        <div>
          <div className="font-display text-[15px] font-bold text-[var(--ink)] flex items-center gap-1.5">
            <Star className="w-4 h-4 text-[var(--terra)]" />
            Founding Member Spots
          </div>
          <div className="text-xs text-[var(--muted-warm)] mt-0.5">
            {allFoundingTaken ? "All founding spots taken" : "Join now \u00b7 Get founding badge forever"}
          </div>
        </div>
        <div className="font-mono text-[28px] text-[var(--terra)] tracking-wide leading-none">
          {allFoundingTaken ? "Full" : `${club.foundingTaken ?? 0}/${club.foundingTotal ?? 20}`}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-6 mt-3">
        <div className="rounded-[14px] p-3 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[28px] leading-none tracking-wide text-[var(--terra)]" data-testid="text-member-count">
            {club.memberCount}
          </div>
          <div className="text-[11px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Members</div>
        </div>
        <div className="rounded-[14px] p-3 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[28px] leading-none tracking-wide text-[var(--ink)]" data-testid="text-active-count">
            {activeCount}
          </div>
          <div className="text-[11px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">Active</div>
        </div>
        <div className="rounded-[14px] p-3 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="font-mono text-[28px] leading-none tracking-wide text-[var(--gold)]" data-testid="text-avg-rating">
            {ratingCount > 0 ? avgRating.toFixed(1) : "—"}
          </div>
          <div className="text-[11px] font-semibold text-[var(--muted-warm)] tracking-wider mt-0.5">
            {ratingCount > 0 ? `${ratingCount} ${ratingCount === 1 ? "review" : "reviews"}` : "No ratings"}
          </div>
        </div>
      </div>

      {ratingCount > 0 && (
        <div className="mx-6 mt-3 rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="card-reviews-highlight">
          <div className="flex flex-col items-center justify-center shrink-0">
            <div className="font-mono text-[32px] leading-none tracking-wide text-[var(--gold)]" data-testid="text-avg-rating-highlight">
              {avgRating.toFixed(1)}
            </div>
            <div className="flex items-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(avgRating) ? "text-[var(--gold)] fill-[var(--gold)]" : "text-[var(--warm-border)]"}`} />
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold text-[var(--ink)]">Community Rating</div>
            <div className="text-xs text-[var(--muted-warm)] mt-0.5">
              Based on {ratingCount} {ratingCount === 1 ? "review" : "reviews"} from members
            </div>
          </div>
          <Heart className="w-5 h-5 text-[var(--terra)] shrink-0" />
        </div>
      )}

      {club.whatsappNumber && (
        <div className="px-6 mt-3" data-testid="section-whatsapp-cta">
          <a
            href={`https://wa.me/${club.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi! I'd love to join ${club.name}. I found you on CultFam! 🙌`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1.5px solid rgba(37,211,102,0.35)', color: '#1A8A3A' }}
            data-testid="button-whatsapp-join"
          >
            <MessageCircle className="w-4 h-4" />
            Chat on WhatsApp
          </a>
        </div>
      )}

      {membersPreview.length > 0 && (
        <div className="px-6 mt-4" data-testid="section-members-preview">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider">Members</h2>
            <Badge variant="secondary" className="text-[11px] no-default-active-elevate" data-testid="badge-total-members">
              {club.memberCount} total
            </Badge>
          </div>
          <div className="flex flex-wrap gap-3">
            {membersPreview.map((member, i) => {
              const inner = (
                <>
                  <Avatar className="w-11 h-11">
                    <AvatarImage src={member.profileImageUrl || undefined} alt={member.name} />
                    <AvatarFallback className="text-sm font-semibold" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-[var(--ink3)] text-center truncate w-full font-medium">{member.name.split(' ')[0]}</span>
                </>
              );
              return member.userId ? (
                <Link
                  key={member.userId}
                  href={`/member/${member.userId}`}
                  className="flex flex-col items-center gap-1.5 w-16"
                  style={{ textDecoration: "none" }}
                  data-testid={`link-member-profile-${member.userId}`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1.5 w-16" data-testid={`member-preview-${i}`}>
                  {inner}
                </div>
              );
            })}
            {club.memberCount > membersPreview.length && (
              <div className="flex flex-col items-center gap-1.5 w-16" data-testid="member-preview-more">
                <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
                  <span className="text-xs font-bold text-[var(--muted-warm)]">+{club.memberCount - membersPreview.length}</span>
                </div>
                <span className="text-[11px] text-[var(--muted-warm)] text-center font-medium">more</span>
              </div>
            )}
          </div>
        </div>
      )}

      {pinnedAnnouncement && (
        <div className="mx-6 mt-3 rounded-2xl p-3.5 flex items-start gap-3" style={{ background: "var(--terra-pale)", border: "1.5px solid rgba(196,98,45,0.25)" }} data-testid="banner-pinned-announcement">
          <Megaphone className="w-4 h-4 text-[var(--terra)] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-sm text-[var(--terra)]">{pinnedAnnouncement.title}</div>
            <p className="text-xs text-[var(--ink3)] mt-0.5 leading-relaxed line-clamp-2">{pinnedAnnouncement.body}</p>
            <div className="text-[11px] text-[var(--muted-warm)] mt-1">
              From organiser · {pinnedAnnouncement.createdAt ? getRelativeTime(String(pinnedAnnouncement.createdAt)) : ""}
            </div>
          </div>
        </div>
      )}

      <div className="flex mt-5 overflow-x-auto scrollbar-none" style={{ borderBottom: '1.5px solid var(--warm-border)', scrollbarWidth: 'none' }} data-testid="section-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "text-[var(--terra)]"
                : "text-[var(--muted-warm)]"
            }`}
            style={{
              borderBottom: activeTab === tab.id ? '2.5px solid var(--terra)' : '2.5px solid transparent',
              marginBottom: '-1.5px',
            }}
            data-testid={`tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "meet-ups" && (
        <>
          {isOwner && (
            <div className="px-6 py-3" data-testid="section-organiser-controls">
              <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--warm-white)', border: '1.5px solid rgba(196,98,45,0.3)' }}>
                <h3 className="text-xs font-bold text-[var(--terra)] uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5" />
                  Organiser Controls
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate(`/organizer`)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--terra)] transition-colors"
                    style={{ background: 'var(--terra-pale)' }}
                    data-testid="button-view-dashboard"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    View Dashboard
                  </button>
                  <button
                    onClick={() => navigate(`/create?tab=event&clubId=${club.id}`)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--terra)] transition-colors"
                    style={{ background: 'var(--terra-pale)' }}
                    data-testid="button-create-event-for-club"
                  >
                    <Plus className="w-4 h-4" />
                    Create Event
                  </button>
                  <button
                    onClick={() => navigate(`/organizer`)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--terra)] transition-colors"
                    style={{ background: 'var(--terra-pale)' }}
                    data-testid="button-edit-club"
                  >
                    <Settings className="w-4 h-4" />
                    Edit Club
                  </button>
                </div>
              </div>
            </div>
          )}

          <ClubEvents clubId={club.id} clubName={club.name} isAuthenticated={isAuthenticated} />

          {club.location && (
            <div className="px-6 pt-3.5 pb-1">
              <div className="font-mono text-[22px] text-[var(--ink)] tracking-wider leading-none" data-testid="text-venue-heading">
                Usually Meet At
              </div>
            </div>
          )}
          {club.location && (
            <div className="mx-6 mt-2 rounded-2xl p-3.5 flex items-center gap-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="card-venue">
              <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'linear-gradient(135deg, #E8D5B8, #C4A882)' }}>
                <MapPin className="w-6 h-6 text-[var(--ink3)]" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-[var(--ink)]">{club.location}</div>
                <div className="text-[11px] text-[var(--muted-warm)] leading-relaxed mt-0.5">
                  {club.schedule && <>{club.schedule}<br /></>}
                  {club.city}
                </div>
              </div>
            </div>
          )}

          {activity && (activity.recentJoins > 0 || activity.totalEvents > 0) && (
            <div className="px-6 py-4" data-testid="section-recent-activity">
              <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--warm-white)', border: '1.5px solid rgba(196,98,45,0.3)' }}>
                <h3 className="font-display text-base font-bold text-[var(--ink)]">Recent Activity</h3>
                {activity.recentJoins > 0 && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-recent-joins">
                    <Users className="w-4 h-4 text-[var(--terra)]" />
                    <span className="text-[var(--ink)]">
                      <span className="font-semibold text-[var(--terra)]">{activity.recentJoins}</span> new {activity.recentJoins === 1 ? "member" : "members"} this week
                    </span>
                  </div>
                )}
                {activity.totalEvents > 0 && (
                  <div className="flex items-center gap-2 text-sm" data-testid="text-total-events">
                    <Calendar className="w-4 h-4 text-[var(--terra)]" />
                    <span className="text-[var(--ink)]">
                      <span className="font-semibold text-[var(--terra)]">{activity.totalEvents}</span> {activity.totalEvents === 1 ? "event" : "events"} hosted
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "about" && (
        <div className="px-6 py-4 space-y-4">
          {club.organizerName && (
            <div className="flex justify-between items-center gap-4" data-testid="section-leader">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)', border: '2px solid var(--terra)' }}>
                  <span className="text-[var(--terra)] font-bold text-lg">
                    {club.organizerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--muted-warm)] uppercase tracking-wider font-semibold">Leader</div>
                  <div className="font-display font-bold text-[var(--ink)]">{club.organizerName}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-2">About</h2>
            <p className="text-sm text-[var(--muted-warm)] leading-relaxed" data-testid="text-club-description">
              {club.fullDesc}
            </p>
          </div>

          {tags.length > 0 && (
            <div data-testid="section-tags">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span key={i} className="rounded-full px-3 py-1.5 text-xs text-[var(--ink3)]" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid={`tag-${i}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap" data-testid="section-health">
            {club.healthLabel && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                club.healthStatus === "green" ? "text-[var(--green-accent)]" : club.healthStatus === "yellow" ? "text-chart-4" : "text-destructive"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  club.healthStatus === "green" ? "bg-[var(--green-accent)]" : club.healthStatus === "yellow" ? "bg-chart-4" : "bg-destructive"
                }`} />
                {club.healthLabel}
              </span>
            )}
            {club.activeSince && (
              <span className="text-xs text-[var(--muted-warm)]">Active since {club.activeSince}</span>
            )}
          </div>
        </div>
      )}

      {activeTab === "schedule" && (
        <ScheduleTab clubId={club.id} fallbackSchedule={club.schedule} />
      )}

      {activeTab === "moments" && (
        <MomentsTab
          clubId={club.id}
          isOwner={isOwner}
          isOrganiser={isOwner}
          isMember={isApprovedMember && !isOwner}
        />
      )}

      {activeTab === "faqs" && (
        <FaqsTab clubId={club.id} />
      )}

      {activeTab === "members" && (
        <MembersTab clubId={club.id} />
      )}

      {activeTab === "gallery" && (
        <GalleryTab clubId={club.id} />
      )}

      {activeTab === "values" && (
        <div className="px-6 py-4 space-y-4" data-testid="tab-values">
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider">What we stand for</h2>
          {club.highlights && club.highlights.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {club.highlights.map((item: string, i: number) => {
                const parts = item.split(" ");
                const emoji = parts[0];
                const label = parts.slice(1).join(" ");
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4 flex flex-col items-start gap-2"
                    style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                    data-testid={`card-value-${i}`}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="font-display text-sm font-bold text-[var(--ink)] leading-tight">{label || item}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">✨</span>
              <p className="text-sm font-semibold text-[var(--ink)] mb-1">No values added yet</p>
              <p className="text-xs text-[var(--muted-warm)]">The organiser hasn't shared the club's values yet.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "leaders" && (
        <div className="px-6 py-4 space-y-4" data-testid="tab-leaders">
          <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider">Club Leaders</h2>
          {club.organizerName ? (
            <div
              className="rounded-2xl p-5 flex flex-col items-center gap-4 text-center"
              style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
              data-testid="card-organiser"
            >
              <div className="relative">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
                  style={{ background: 'var(--terra-pale)', border: '2.5px solid var(--terra)', color: 'var(--terra)' }}
                >
                  {club.organizerAvatar || club.organizerName.charAt(0).toUpperCase()}
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--gold)', border: '2px solid var(--cream)' }}
                >
                  <Crown className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div>
                <div className="font-display text-lg font-black text-[var(--ink)]">{club.organizerName}</div>
                <div
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full mt-1"
                  style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}
                >
                  <Crown className="w-3 h-3" /> Club Leader
                </div>
              </div>
              {club.organizerYears && (
                <p className="text-xs text-[var(--muted-warm)]">{club.organizerYears}</p>
              )}
              {club.organizerResponse && (
                <p className="text-xs text-[var(--muted-warm)]">💬 {club.organizerResponse}</p>
              )}
              {club.whatsappNumber && (
                <a
                  href={`https://wa.me/${club.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${club.organizerName}! I'd love to connect about ${club.name} on CultFam.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(37,211,102,0.12)', border: '1.5px solid rgba(37,211,102,0.35)', color: '#1A8A3A' }}
                  data-testid="button-whatsapp-leader"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Talk
                </a>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">👑</span>
              <p className="text-sm font-semibold text-[var(--ink)] mb-1">Leader info not available</p>
            </div>
          )}
        </div>
      )}

      {isAuthenticated && ratingsData?.hasJoined && (
        <RatingSection
          clubId={club.id}
          showRatingForm={showRatingForm}
          setShowRatingForm={setShowRatingForm}
          selectedRating={selectedRating}
          setSelectedRating={setSelectedRating}
          reviewText={reviewText}
          setReviewText={setReviewText}
          ratingMutation={ratingMutation}
          userRating={ratingsData?.userRating || null}
        />
      )}

      {joinSuccess || joinStatus?.status === "pending" ? (
        <div className="px-6 py-6">
          <Card className="p-6 text-center space-y-3" data-testid="card-join-pending">
            <div className="text-4xl">
              <Clock3 className="w-10 h-10 mx-auto text-[var(--gold)]" />
            </div>
            <h3 className="font-display text-xl font-bold text-[var(--gold)]">Request Pending</h3>
            <p className="text-sm text-[var(--muted-warm)]">
              Your join request has been sent. The organizer will review and approve it soon.
            </p>
            {club.whatsappNumber && (
              <a
                href={`https://wa.me/${club.whatsappNumber}?text=${encodeURIComponent(`Hi! I just requested to join ${club.name} on CultFam. Please review my request!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white rounded-md px-5 py-3 text-sm font-semibold transition-all"
                style={{ background: "var(--green-accent)", borderColor: "var(--green-accent)" }}
                data-testid="button-message-organizer"
              >
                <MessageCircle className="w-4 h-4" />
                Message Organizer on WhatsApp
              </a>
            )}
          </Card>
        </div>
      ) : joinStatus?.status === "approved" ? (
        <div className="px-6 py-6">
          <Card className="p-6 text-center space-y-3" data-testid="card-member-status">
            <div className="text-4xl">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[var(--green-accent)]" />
            </div>
            <h3 className="font-display text-xl font-bold text-[var(--green-accent)]">You're a Member!</h3>
            <p className="text-sm text-[var(--muted-warm)]">
              You're part of {club.name}. Check out upcoming events and join the community!
            </p>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to leave this club?")) {
                  leaveMutation.mutate();
                }
              }}
              disabled={leaveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold text-destructive transition-all"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              data-testid="button-leave-club"
            >
              <LogOut className="w-3.5 h-3.5" />
              {leaveMutation.isPending ? "Leaving..." : "Leave Club"}
            </button>
          </Card>
        </div>
      ) : joinStatus?.status === "rejected" ? (
        <div className="px-6 py-6">
          <Card className="p-6 text-center space-y-3" data-testid="card-join-rejected">
            <div className="text-4xl">
              <XCircle className="w-10 h-10 mx-auto text-destructive" />
            </div>
            <h3 className="font-display text-xl font-bold text-destructive">Request Not Approved</h3>
            <p className="text-sm text-[var(--muted-warm)]">
              Your previous join request was not approved. You can submit a new request.
            </p>
            <button
              onClick={() => setShowJoinForm(true)}
              className="rounded-xl px-6 py-3 font-display font-bold text-sm text-white"
              style={{ background: 'var(--ink)' }}
              data-testid="button-rejoin"
            >
              Request Again
            </button>
          </Card>
        </div>
      ) : showJoinForm ? (
        <div ref={joinFormRef} className="px-6 py-6">
          <Card className="p-6 space-y-3" data-testid="form-join">
            <h3 className="font-display text-lg font-bold text-[var(--ink)] mb-1">Join {club.name}</h3>
            <p className="text-xs text-[var(--muted-warm)] mb-1">Your phone number is shared with the organizer so they can add you to the WhatsApp group.</p>
            <input
              type="text"
              placeholder="Your Name"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 placeholder:text-[var(--muted-warm)]"
              style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
              data-testid="input-join-name"
            />
            <input
              type="tel"
              placeholder="10-digit mobile number (for WhatsApp group)"
              value={joinPhone}
              onChange={(e) => setJoinPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 placeholder:text-[var(--muted-warm)]"
              style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
              data-testid="input-join-phone"
            />
            {(club as any).joinQuestion1 && (
              <div>
                <label className="text-xs font-semibold text-[var(--muted-warm)] block mb-1.5">{(club as any).joinQuestion1} <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  placeholder="Your answer"
                  value={joinAnswer1}
                  onChange={(e) => setJoinAnswer1(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 placeholder:text-[var(--muted-warm)]"
                  style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                  data-testid="input-join-answer1"
                />
              </div>
            )}
            {(club as any).joinQuestion2 && (
              <div>
                <label className="text-xs font-semibold text-[var(--muted-warm)] block mb-1.5">{(club as any).joinQuestion2} <span className="text-muted-foreground">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Your answer (optional)"
                  value={joinAnswer2}
                  onChange={(e) => setJoinAnswer2(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 placeholder:text-[var(--muted-warm)]"
                  style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                  data-testid="input-join-answer2"
                />
              </div>
            )}
            {joinError && (
              <p className="text-xs text-destructive font-medium" data-testid="text-join-error">{joinError}</p>
            )}
            <button
              onClick={handleJoinSubmit}
              disabled={joinMutation.isPending}
              className="w-full text-white rounded-xl py-4 font-display font-bold text-lg disabled:opacity-50"
              style={{ background: 'var(--ink)', boxShadow: 'var(--warm-shadow)' }}
              data-testid="button-send-join"
            >
              {joinMutation.isPending ? "Sending..." : "Send Join Request"}
            </button>
          </Card>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3.5 flex items-center gap-3" style={{ background: 'var(--cream)', borderTop: '1.5px solid var(--warm-border)' }} data-testid="sticky-join-cta">
          {!isAuthenticated ? (
            <a
              href="/login"
              className="block w-full text-center rounded-2xl py-4 font-display font-bold italic text-lg tracking-tight transition-all"
              style={{ background: 'var(--ink)', color: 'var(--cream)' }}
              data-testid="button-signin-to-join"
            >
              Sign In to Join
            </a>
          ) : (
            <>
              <div className="flex-1">
                <div className="font-mono text-[32px] leading-none tracking-wide text-[var(--terra)]">FREE</div>
                <div className="text-[11px] font-semibold text-[var(--muted-warm)] tracking-wider">FOUNDING MEMBER</div>
              </div>
              <button
                onClick={() => setShowJoinForm(true)}
                className="flex-[2] rounded-2xl py-4 font-display font-bold italic text-base tracking-tight flex items-center justify-center gap-2 transition-all"
                style={{ background: 'var(--ink)', color: 'var(--cream)' }}
                data-testid="button-join"
              >
                Join the Tribe <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClubEvents({ clubId, clubName, isAuthenticated }: { clubId: string; clubName: string; isAuthenticated: boolean }) {
  const [, navigate] = useLocation();
  const [justRsvpdId, setJustRsvpdId] = useState<string | null>(null);

  const { data: events = [] } = useQuery<ClubEvent[]>({
    queryKey: ["/api/clubs", clubId, "events"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/events`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/events/${eventId}/rsvp`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "events"] });
      setJustRsvpdId(eventId);
    },
  });

  const upcomingEvents = events.filter((e) => new Date(e.startsAt) > new Date());

  return (
    <div className="px-6 py-4" data-testid="section-club-events">
      <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-3">Upcoming Events</h2>
      {upcomingEvents.length === 0 ? (
        <p className="text-sm text-[var(--muted-warm)]">No upcoming events</p>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.slice(0, 5).map((event) => {
            const d = new Date(event.startsAt);
            const month = d.toLocaleDateString("en-IN", { month: "short" });
            const day = d.getDate();
            return (
              <div
                key={event.id}
                className="rounded-xl overflow-hidden cursor-pointer hover-elevate"
                style={{ background: 'var(--ink)', borderRadius: '20px' }}
                onClick={() => navigate(`/event/${event.id}`)}
                data-testid={`club-event-${event.id}`}
              >
                <div className="p-4 flex items-center gap-3">
                  <div className="rounded-lg p-2 flex flex-col items-center justify-center shrink-0 min-w-[3rem]" style={{ background: 'var(--terra-pale)' }}>
                    <span className="text-xs text-[var(--terra-light)] font-medium">{month}</span>
                    <span className="font-bold text-[var(--cream)] text-lg leading-tight">{day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-semibold text-[var(--cream)] text-sm truncate">{event.title}</span>
                      {event.recurrenceRule && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(196,98,45,0.25)', color: 'var(--terra-light)' }} data-testid={`badge-recurring-${event.id}`}>
                          <Repeat className="w-2.5 h-2.5" />
                          {event.recurrenceRule === "weekly" ? "Weekly" : event.recurrenceRule === "biweekly" ? "Bi-weekly" : "Monthly"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-[var(--muted-warm2)] mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{event.locationText}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--terra-light)] shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RatingSection({
  clubId,
  showRatingForm,
  setShowRatingForm,
  selectedRating,
  setSelectedRating,
  reviewText,
  setReviewText,
  ratingMutation,
  userRating,
}: {
  clubId: string;
  showRatingForm: boolean;
  setShowRatingForm: (v: boolean) => void;
  selectedRating: number;
  setSelectedRating: (v: number) => void;
  reviewText: string;
  setReviewText: (v: string) => void;
  ratingMutation: any;
  userRating: { rating: number; review: string | null } | null;
}) {
  if (!showRatingForm && !userRating) {
    return (
      <div className="px-6 py-3">
        <button
          onClick={() => setShowRatingForm(true)}
          className="w-full rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--terra)] transition-colors"
          style={{ background: 'var(--terra-pale)', border: '1.5px solid rgba(196,98,45,0.2)' }}
          data-testid="button-rate-club"
        >
          <Star className="w-4 h-4" />
          Rate this club
        </button>
      </div>
    );
  }

  if (userRating && !showRatingForm) {
    return (
      <div className="px-6 py-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="card-user-rating">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-[var(--muted-warm)] mr-1">Your rating:</span>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-4 h-4 ${s <= userRating.rating ? "text-[var(--gold)] fill-[var(--gold)]" : "text-[var(--warm-border)]"}`} />
              ))}
            </div>
            <button
              onClick={() => setShowRatingForm(true)}
              className="text-xs font-semibold text-[var(--terra)]"
              data-testid="button-edit-rating"
            >
              Edit
            </button>
          </div>
          {userRating.review && (
            <p className="text-xs text-[var(--muted-warm)] mt-1.5">{userRating.review}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-3">
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="form-rating">
        <h3 className="text-sm font-bold text-[var(--ink)]">Rate this club</h3>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedRating(s)}
              className="p-1"
              data-testid={`button-star-${s}`}
            >
              <Star className={`w-7 h-7 transition-colors ${s <= selectedRating ? "text-[var(--gold)] fill-[var(--gold)]" : "text-[var(--warm-border)]"}`} />
            </button>
          ))}
        </div>
        <textarea
          placeholder="Write a short review (optional)"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 placeholder:text-[var(--muted-warm)] resize-none"
          style={{ background: 'var(--cream)', border: '1.5px solid var(--warm-border)' }}
          data-testid="input-review"
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (selectedRating > 0) {
                ratingMutation.mutate({ rating: selectedRating, review: reviewText || undefined });
              }
            }}
            disabled={selectedRating === 0 || ratingMutation.isPending}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--terra)' }}
            data-testid="button-submit-rating"
          >
            {ratingMutation.isPending ? "Submitting..." : "Submit Rating"}
          </button>
          <button
            onClick={() => setShowRatingForm(false)}
            className="px-4 rounded-lg py-2.5 text-sm font-semibold text-[var(--muted-warm)]"
            style={{ background: 'var(--cream)' }}
            data-testid="button-cancel-rating"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleTab({ clubId, fallbackSchedule }: { clubId: string; fallbackSchedule: string }) {
  const { data: entries = [], isLoading } = useQuery<ClubScheduleEntry[]>({
    queryKey: ["/api/clubs", clubId, "schedule"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/schedule`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4 space-y-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-6 py-6 text-center">
        <Clock className="w-8 h-8 mx-auto text-[var(--muted-warm2)] mb-2" />
        <p className="text-sm font-semibold text-[var(--ink3)] mb-1">No schedule set up yet</p>
        {fallbackSchedule && (
          <p className="text-xs text-[var(--muted-warm)]">{fallbackSchedule}</p>
        )}
      </div>
    );
  }

  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sorted = [...entries].sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek));

  return (
    <div className="px-6 py-4 space-y-2" data-testid="section-schedule">
      <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-3">Weekly Schedule</h2>
      {sorted.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl p-3.5 flex items-start gap-3"
          style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
          data-testid={`schedule-entry-${entry.id}`}
        >
          <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}>
            <span className="text-[11px] font-bold text-[var(--terra)] uppercase">{entry.dayOfWeek.slice(0, 3)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold text-[var(--ink)]">{entry.activity}</div>
            <div className="flex items-center gap-1 text-xs text-[var(--muted-warm)] mt-0.5">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ""}</span>
            </div>
            {entry.location && (
              <div className="flex items-center gap-1 text-xs text-[var(--muted-warm)] mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{entry.location}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getMomentIcon(caption: string) {
  const lower = caption.toLowerCase();
  if (lower.includes("photo") || lower.includes("pic") || lower.includes("snap")) return Camera;
  if (lower.includes("event") || lower.includes("meet") || lower.includes("session")) return Calendar;
  if (lower.includes("member") || lower.includes("join") || lower.includes("welcome")) return Users;
  if (lower.includes("announce") || lower.includes("update") || lower.includes("news")) return Megaphone;
  if (lower.includes("achieve") || lower.includes("milestone") || lower.includes("record")) return Sparkles;
  return Activity;
}

type MomentWithCount = ClubMoment & { commentCount: number; authorName?: string | null; authorUserId?: string | null };

const MOMENT_ICONS = ["🎉", "📸", "🏃", "🎵", "📚", "🌄", "⚽", "🎨", "🍜", "💪", "🧘", "🎭"];

function MomentsTab({
  clubId,
  isOwner = false,
  isOrganiser = false,
  isMember = false,
}: {
  clubId: string;
  isOwner?: boolean;
  isOrganiser?: boolean;
  isMember?: boolean;
}) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showPostForm, setShowPostForm] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [momentImageUrl, setMomentImageUrl] = useState<string | null>(null);

  const canPost = isOwner || isOrganiser;

  const { data: moments = [], isLoading } = useQuery<MomentWithCount[]>({
    queryKey: ["/api/clubs", clubId, "moments"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/moments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clubs/${clubId}/moments`, {
        caption: caption.trim(),
        emoji: selectedEmoji || undefined,
        imageUrl: momentImageUrl || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "moments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      setCaption("");
      setSelectedEmoji("");
      setMomentImageUrl(null);
      setShowPostForm(false);
    },
  });

  function toggleComments(momentId: string) {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(momentId)) next.delete(momentId);
      else next.add(momentId);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="px-6 py-4 space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (moments.length === 0 && !canPost) {
    return (
      <div className="px-6 py-6">
        <div className="text-center py-4">
          <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--muted-warm2)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink3)" }}>No moments yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-warm)" }}>Join this club to be part of the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 space-y-3" data-testid="section-moments">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>Moments</h2>
          {isMember && !isOrganiser && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
            >
              Member
            </span>
          )}
          {isOrganiser && (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--terra)", color: "white" }}
            >
              Organiser
            </span>
          )}
        </div>
        {canPost && (
          <button
            onClick={() => setShowPostForm(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white transition-all"
            style={{ background: showPostForm ? "var(--ink)" : "var(--terra)" }}
            data-testid="button-share-moment"
          >
            {showPostForm ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {showPostForm ? "Cancel" : "Share a Moment"}
          </button>
        )}
      </div>

      {showPostForm && canPost && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ background: "var(--warm-white)", border: "1.5px solid rgba(196,98,45,0.3)" }}
          data-testid="form-post-moment"
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--terra)" }}>
            Share what happened
          </p>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Tell your clubmates about a recent meetup, milestone, or memory..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm text-foreground focus:outline-none focus:border-[var(--terra)] resize-none transition-colors"
            data-testid="input-moment-caption"
          />
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-2">Add a vibe</p>
            <div className="flex flex-wrap gap-2">
              {MOMENT_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setSelectedEmoji(selectedEmoji === icon ? "" : icon)}
                  className={`text-xl w-9 h-9 rounded-lg flex items-center justify-center transition-all ${selectedEmoji === icon ? "ring-2 ring-[var(--terra)] bg-[var(--terra-pale)]" : "bg-[var(--cream)]"}`}
                  data-testid={`button-emoji-${icon}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <ImageUpload value={momentImageUrl} onChange={setMomentImageUrl} label="Photo (optional)" />
          <button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || !caption.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-50 transition-all"
            style={{ background: "var(--terra)" }}
            data-testid="button-submit-moment"
          >
            {postMutation.isPending ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Posting...</span>
            ) : "Post Moment"}
          </button>
        </div>
      )}

      {moments.length === 0 && canPost && (
        <div className="text-center py-6">
          <Camera className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--muted-warm2)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink3)" }}>No moments yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-warm)" }}>Be the first to share a moment with your clubmates!</p>
        </div>
      )}

      {moments.map((moment) => {
        const timeAgo = getRelativeTime(moment.createdAt);
        const MomentIcon = getMomentIcon(moment.caption);
        const isExpanded = expandedComments.has(moment.id);
        const isMyMoment = user && moment.authorUserId === user.id;
        const authorDisplay = isMyMoment ? "You" : (moment.authorName || null);
        return (
          <div
            key={moment.id}
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
            data-testid={`moment-${moment.id}`}
          >
            {authorDisplay && (
              <div className="px-3.5 pt-3 pb-1 flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: isMyMoment ? "var(--terra)" : "var(--ink2)" }}
                >
                  {authorDisplay.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold" style={{ color: "var(--ink3)" }}>
                  {isMyMoment ? "You posted this" : `Posted by ${authorDisplay}`}
                </span>
              </div>
            )}
            {moment.imageUrl && (
              <img
                src={moment.imageUrl}
                alt={moment.caption}
                className="w-full object-cover"
                style={{ maxHeight: 200 }}
                loading="lazy"
              />
            )}
            <div className="p-3.5 flex items-start gap-3">
              {!moment.imageUrl && (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}>
                  {moment.emoji ? (
                    <span className="text-xl">{{ fire: "🔥", star: "⭐" }[moment.emoji] ?? moment.emoji}</span>
                  ) : (
                    <MomentIcon className="w-5 h-5 text-[var(--terra)]" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {moment.emoji && moment.imageUrl && (
                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md mb-1.5 bg-[var(--terra-pale)] text-[var(--terra)]">
                    {{ fire: "🔥", star: "⭐" }[moment.emoji] ?? moment.emoji}
                  </span>
                )}
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>{moment.caption}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="w-3 h-3" style={{ color: "var(--muted-warm)" }} />
                  <span className="text-[11px] font-medium" style={{ color: "var(--muted-warm)" }}>{timeAgo}</span>
                </div>
              </div>
            </div>

            <div
              className="px-3.5 py-2.5 flex items-center"
              style={{ borderTop: "1px solid var(--warm-border)" }}
            >
              <button
                onClick={() => toggleComments(moment.id)}
                className="flex items-center gap-1.5 transition-colors"
                data-testid={`button-toggle-comments-${moment.id}`}
              >
                <MessageCircle
                  className="w-4 h-4"
                  style={{ color: isExpanded ? "var(--terra)" : "var(--muted-warm)" }}
                />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: isExpanded ? "var(--terra)" : "var(--muted-warm)" }}
                >
                  {moment.commentCount === 0 ? "Comment" : `${moment.commentCount} ${moment.commentCount === 1 ? "comment" : "comments"}`}
                </span>
              </button>
            </div>

            {isExpanded && (
              <CommentsSection momentId={moment.id} isOrganiser={isOrganiser} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CommentsSection({ momentId, isOrganiser }: { momentId: string; isOrganiser: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const [text, setText] = useState("");

  const { data: comments = [], isLoading } = useQuery<MomentComment[]>({
    queryKey: ["/api/moments", momentId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/moments/${momentId}/comments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/moments/${momentId}/comments`, { content: text.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moments", momentId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      setText("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => apiRequest("DELETE", `/api/moments/${momentId}/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moments", momentId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || addMutation.isPending) return;
    addMutation.mutate();
  }

  return (
    <div style={{ borderTop: "1px solid var(--warm-border)" }}>
      {isLoading ? (
        <div className="px-4 py-3 space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-7 rounded-lg animate-pulse" style={{ background: "var(--warm-border)" }} />
          ))}
        </div>
      ) : (
        <div>
          {comments.length === 0 && (
            <p className="px-4 py-4 text-xs italic text-center" style={{ color: "var(--muted-warm)" }}>
              No comments yet. Be the first!
            </p>
          )}
          <div>
            {comments.map((c) => {
              const isOwn = user?.id === c.userId;
              const canDelete = isOwn || isOrganiser;
              const initial = c.userName.charAt(0).toUpperCase();
              const timeAgo = c.createdAt ? getRelativeTime(c.createdAt) : "";
              return (
                <div
                  key={c.id}
                  className="px-4 py-2.5 flex items-start gap-2.5"
                  style={{ borderTop: "1px solid var(--warm-border)" }}
                  data-testid={`comment-${c.id}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[11px] font-bold"
                    style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
                  >
                    {c.userImageUrl ? (
                      <img src={c.userImageUrl} alt={c.userName} className="w-full h-full object-cover" loading="lazy" />
                    ) : initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-[12px] font-bold" style={{ color: "var(--ink)" }} data-testid={`comment-author-${c.id}`}>
                        {c.userName.split(" ")[0]}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{timeAgo}</span>
                    </div>
                    <p className="text-[13px] leading-snug mt-0.5" style={{ color: "var(--ink3)" }} data-testid={`comment-content-${c.id}`}>
                      {c.content}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={deleteMutation.isPending}
                      className="shrink-0 p-1 rounded-md opacity-40 hover:opacity-100 transition-all group"
                      data-testid={`button-delete-comment-${c.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 group-hover:text-[var(--terra)] transition-colors" style={{ color: "var(--ink3)" }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isAuthenticated ? (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderTop: "1px solid var(--warm-border)" }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden text-[11px] font-bold"
                style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
              >
                {user?.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (user?.firstName?.charAt(0) || "?").toUpperCase()}
              </div>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add a comment…"
                maxLength={300}
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-[var(--muted-warm)] placeholder:opacity-70"
                style={{ color: "var(--ink)" }}
                data-testid="input-comment"
              />
              <button
                type="submit"
                disabled={!text.trim() || addMutation.isPending}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: "var(--terra)" }}
                data-testid="button-submit-comment"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </form>
          ) : (
            <div className="px-4 py-3" style={{ borderTop: "1px solid var(--warm-border)" }}>
              <a
                href="/login"
                className="text-xs font-semibold"
                style={{ color: "var(--terra)" }}
                data-testid="link-sign-in-comment"
              >
                Sign in to comment →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FaqsTab({ clubId }: { clubId: string }) {
  const { data: faqs = [], isLoading } = useQuery<ClubFaq[]>({
    queryKey: ["/api/clubs", clubId, "faqs"],
    queryFn: async () => {
      const res = await fetch(`/api/clubs/${clubId}/faqs`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4 space-y-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  }

  if (faqs.length === 0) {
    return (
      <div className="px-6 py-6 text-center">
        <MessageCircle className="w-8 h-8 mx-auto text-[var(--muted-warm2)] mb-2" />
        <p className="text-sm font-semibold text-[var(--ink3)]">No FAQs yet</p>
        <p className="text-xs text-[var(--muted-warm)] mt-1">Frequently asked questions will appear here</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4" data-testid="section-faqs">
      <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-3">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.id}
            value={faq.id}
            className="rounded-xl overflow-visible"
            style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
            data-testid={`faq-${faq.id}`}
          >
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-[var(--ink)] text-left [&[data-state=open]>svg]:rotate-180">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3 text-sm text-[var(--muted-warm)] leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function getRelativeTime(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function MembersTab({ clubId }: { clubId: string }) {
  const { data: members = [], isLoading } = useQuery<{ userId: string | null; name: string; profileImageUrl: string | null; joinedAt: string | null; isFoundingMember: boolean | null }[]>({
    queryKey: ["/api/clubs", clubId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${clubId}/members`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 w-16 animate-pulse">
              <div className="w-12 h-12 rounded-full" style={{ background: "var(--warm-border)" }} />
              <div className="w-10 h-2.5 rounded" style={{ background: "var(--warm-border)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4" data-testid="tab-members">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-[var(--muted-warm)] uppercase tracking-wider">Members</h2>
        <span className="text-xs font-semibold text-[var(--muted-warm)]" data-testid="text-member-total">{members.length} members</span>
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-[var(--muted-warm)] text-center py-8">No members yet.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {members.map((member, i) => {
            const inner = (
              <>
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={member.profileImageUrl || undefined} alt={member.name} />
                    <AvatarFallback className="text-sm font-semibold" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {member.isFoundingMember && (
                    <span className="absolute -bottom-1 -right-1 text-[11px] bg-amber-400 text-amber-900 rounded-full px-1 font-bold leading-tight" title="Founding Member" data-testid={`badge-founding-${member.userId || i}`}>⚡</span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--ink3)] text-center truncate w-full font-medium" data-testid={`text-member-name-${member.userId || i}`}>
                  {member.name.split(' ')[0]}
                </span>
                {member.isFoundingMember && (
                  <span className="text-[11px] font-bold text-amber-600 text-center w-full truncate">Founder</span>
                )}
              </>
            );
            return member.userId ? (
              <Link
                key={member.userId}
                href={`/member/${member.userId}`}
                className="flex flex-col items-center gap-1.5 w-16"
                style={{ textDecoration: "none" }}
                data-testid={`member-card-${member.userId}`}
              >
                {inner}
              </Link>
            ) : (
              <div key={i} className="flex flex-col items-center gap-1.5 w-16" data-testid={`member-card-${i}`}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GalleryTab({ clubId }: { clubId: string }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: moments = [], isLoading } = useQuery<ClubMoment[]>({
    queryKey: ["/api/clubs", clubId, "moments"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${clubId}/moments`);
      return res.json();
    },
  });

  const images = moments.filter(m => m.imageUrl);

  if (isLoading) {
    return (
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4" data-testid="tab-gallery">
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ImageIcon className="w-10 h-10 text-[var(--warm-border)] mb-3" />
          <p className="text-sm text-muted-foreground">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {images.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedImage(m.imageUrl!)}
              className="aspect-square rounded-2xl overflow-hidden transition-all active:scale-[0.97]"
              data-testid={`img-gallery-${m.id}`}
            >
              <img src={m.imageUrl!} alt={m.caption || ""} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Share / Invite Sheet */}
      {showShareSheet && (() => {
        const shareUrl = getClubPublicUrl(club);
        const waText = encodeURIComponent(`Hey! I'm part of ${club.emoji} ${club.name} on CultFam — you should check it out! It's a great community 🙌\n${shareUrl}`);
        const handleCopyLink = () => {
          navigator.clipboard.writeText(shareUrl).then(() => {
            setShowShareSheet(false);
          }).catch(() => {
            window.prompt("Copy this link:", shareUrl);
          });
        };
        const handleNativeShare = () => {
          navigator.share({ title: club.name, text: `Check out ${club.emoji} ${club.name} on CultFam!`, url: shareUrl })
            .catch(() => {})
            .finally(() => setShowShareSheet(false));
        };
        return (
          <>
            <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowShareSheet(false)} data-testid="overlay-share-sheet" />
            <div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-3 pb-10"
              style={{ background: "var(--warm-white)", borderTop: "1.5px solid var(--warm-border)", maxWidth: 480, margin: "0 auto" }}
              data-testid="sheet-share"
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--warm-border)" }} />
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg" style={{ color: "var(--ink)" }}>Invite Friends</h3>
                <button onClick={() => setShowShareSheet(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--cream)" }} data-testid="button-close-share">
                  <X className="w-4 h-4" style={{ color: "var(--ink)" }} />
                </button>
              </div>
              <div className="space-y-3">
                <a
                  href={`https://wa.me/?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowShareSheet(false)}
                  className="flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]"
                  style={{ background: "rgba(37,211,102,0.1)", border: "1.5px solid rgba(37,211,102,0.3)", textDecoration: "none" }}
                  data-testid="button-share-whatsapp"
                >
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(37,211,102,0.15)" }}>
                    <MessageCircle className="w-5 h-5" style={{ color: "#1A8A3A" }} />
                  </div>
                  <div>
                    <p className="font-bold text-[14px]" style={{ color: "#1A8A3A" }}>Share on WhatsApp</p>
                    <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>Send an invite to your contacts</p>
                  </div>
                </a>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-4 p-4 rounded-2xl w-full text-left transition-all active:scale-[0.98]"
                  style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                  data-testid="button-copy-link"
                >
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "var(--terra-pale)" }}>
                    <Share2 className="w-5 h-5" style={{ color: "var(--terra)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-[14px]" style={{ color: "var(--ink)" }}>Copy Invite Link</p>
                    <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>{shareUrl.replace("https://", "")}</p>
                  </div>
                </button>
                {typeof navigator.share === "function" && (
                  <button
                    onClick={handleNativeShare}
                    className="flex items-center gap-4 p-4 rounded-2xl w-full text-left transition-all active:scale-[0.98]"
                    style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                    data-testid="button-share-native"
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
        );
      })()}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setSelectedImage(null)}
          data-testid="overlay-gallery-fullscreen"
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-16 right-5 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center z-10"
            data-testid="button-close-gallery"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={selectedImage}
            alt=""
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}

function ClubDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
      <div className="h-72 w-full bg-gradient-to-b from-[#E8D5B8] to-background flex items-center justify-center">
        <Skeleton className="w-20 h-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2 px-6 mt-4">
        <Skeleton className="h-20 rounded-[14px]" />
        <Skeleton className="h-20 rounded-[14px]" />
        <Skeleton className="h-20 rounded-[14px]" />
      </div>
      <div className="px-6 py-4 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div>
            <Skeleton className="w-16 h-3 mb-1" />
            <Skeleton className="w-24 h-4" />
          </div>
        </div>
      </div>
      <div className="px-6 py-4 space-y-2">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-full h-4" />
        <Skeleton className="w-3/4 h-4" />
      </div>
      <div className="px-6 py-2 flex gap-2 flex-wrap">
        <Skeleton className="w-20 h-7 rounded-full" />
        <Skeleton className="w-16 h-7 rounded-full" />
        <Skeleton className="w-24 h-7 rounded-full" />
      </div>
    </div>
  );
}
