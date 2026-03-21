import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Heart, Share2, Plus, ChevronRight, MessageCircle, Medal, X, ImagePlus, Repeat, Loader2 } from "lucide-react";
import { formatDistanceToNow, format, isToday, isTomorrow } from "date-fns";
import type { Club, Event, ClubMoment } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface EventWithClub extends Event {
  clubName?: string;
  clubEmoji?: string;
  rsvpCount?: number;
  rsvps?: { status: string }[];
}

interface FeedMoment extends ClubMoment {
  clubName: string;
  clubEmoji: string;
  clubLocation: string;
  commentCount: number;
  userHasLiked: boolean;
  authorName: string | null;
  authorUserId: string | null;
}

function getEventLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

function MomentCardSkeleton() {
  return (
    <div
      className="rounded-[20px] overflow-hidden mb-4 card-native"
    >
      <div className="flex items-center gap-3 p-4 pb-3">
        <Skeleton className="w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
      <div className="mx-4 mb-3">
        <Skeleton className="w-full h-[180px] rounded-[16px]" />
      </div>
      <div className="px-4 pb-4 space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
        <div className="flex items-center gap-5 pt-1">
          <Skeleton className="h-5 w-12 rounded" />
          <Skeleton className="h-5 w-12 rounded" />
        </div>
      </div>
    </div>
  );
}

function ExpandableCaption({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 160;
  return (
    <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--ink)" }}>
      {isLong && !expanded ? (
        <>
          {text.slice(0, 160)}…{" "}
          <button
            onClick={() => setExpanded(true)}
            className="font-semibold"
            style={{ color: "var(--terra)" }}
          >
            more
          </button>
        </>
      ) : (
        text
      )}
    </p>
  );
}

export default function HomeFeed() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likeCountOverrides, setLikeCountOverrides] = useState<Record<string, number>>({});
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [seenClubs, setSeenClubs] = useState<Set<string>>(new Set());
  const [postContent, setPostContent] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [kudoSheetOpen, setKudoSheetOpen] = useState(false);
  const [selectedKudoReceiver, setSelectedKudoReceiver] = useState<string | null>(null);
  const [selectedKudoType, setSelectedKudoType] = useState<string | null>(null);
  const [feedPage, setFeedPage] = useState(1);
  const [allFeedMoments, setAllFeedMoments] = useState<FeedMoment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionStartRef = useRef<Date>(new Date());

  const likeMutation = useMutation({
    mutationFn: (momentId: string) => apiRequest("POST", `/api/moments/${momentId}/like`),
    onSuccess: async (res: Response, momentId: string) => {
      const data = await res.json().catch(() => ({}));
      if (typeof data.likesCount === "number") {
        setLikeCountOverrides(prev => ({ ...prev, [momentId]: data.likesCount }));
      }
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: (momentId: string) => apiRequest("DELETE", `/api/moments/${momentId}/like`),
    onSuccess: async (res: Response, momentId: string) => {
      const data = await res.json().catch(() => ({}));
      if (typeof data.likesCount === "number") {
        setLikeCountOverrides(prev => ({ ...prev, [momentId]: data.likesCount }));
      }
    },
  });


  const createPostMutation = useMutation({
    mutationFn: async ({ clubId, caption, imageUrl }: { clubId: string; caption: string; imageUrl?: string }) => {
      return apiRequest("POST", `/api/clubs/${clubId}/moments`, { caption, imageUrl });
    },
    onSuccess: () => {
      setFeedPage(1);
      setAllFeedMoments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      setPostContent("");
      setPostImageFile(null);
      setPostImagePreview(null);
      toast({ description: "Post shared!" });
    },
    onError: () => {
      toast({ description: "Could not share post. Try again.", variant: "destructive" });
    },
  });


  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: userClubs = [] } = useQuery<Club[]>({
    queryKey: ["/api/user/clubs"],
    enabled: !!user,
  });

  const { data: suggestedClubs = [] } = useQuery<Club[]>({
    queryKey: ["/api/clubs", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/clubs?limit=3");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.clubs ?? []).filter((c: Club) => c.isActive);
    },
    enabled: !!user,
  });

  const { data: events = [] } = useQuery<EventWithClub[]>({
    queryKey: ["/api/events"],
  });

  const { data: myEvents = [] } = useQuery<EventWithClub[]>({
    queryKey: ["/api/user/events"],
    enabled: !!user,
  });

  const { data: feedData, isLoading: feedLoading, isFetching: feedFetching } = useQuery<{ moments: FeedMoment[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/feed", feedPage],
    queryFn: async () => {
      const res = await fetch(`/api/feed?page=${feedPage}`);
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
    },
    placeholderData: (prev) => prev,
  });

  const feedMoments: FeedMoment[] = feedPage === 1
    ? (feedData?.moments ?? [])
    : [...allFeedMoments, ...(feedData?.moments ?? []).filter(m => !allFeedMoments.find(a => a.id === m.id))];

  const feedTotal = feedData?.total ?? 0;
  const hasMoments = feedMoments.length < feedTotal;

  function loadMoreFeed() {
    setAllFeedMoments(feedMoments);
    setFeedPage(p => p + 1);
  }

  useEffect(() => {
    if (feedMoments.length === 0) return;
    const alreadyLiked = new Set(feedMoments.filter(m => m.userHasLiked).map(m => m.id));
    if (alreadyLiked.size > 0) {
      setLikedPosts(prev => {
        const merged = new Set(prev);
        alreadyLiked.forEach(id => merged.add(id));
        return merged;
      });
    }
  }, [feedMoments]);

  useEffect(() => {
    if (selectedClubId === null && userClubs.length > 0) {
      setSelectedClubId(userClubs[0].id);
      setSeenClubs(prev => new Set([...Array.from(prev), userClubs[0].id]));
    }
  }, [userClubs, selectedClubId]);

  const unreadCount = unreadData?.count ?? 0;

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const happeningSoon = myEvents
    .filter(e => !e.isCancelled && new Date(e.startsAt) > now && new Date(e.startsAt) <= in48h)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const upcomingEvent = events
    .filter(e => !e.isCancelled && new Date(e.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const kudoCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const kudoPromptEvent = user
    ? myEvents
        .filter(e => !e.isCancelled && new Date(e.startsAt) < kudoCutoff)
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())[0] || null
    : null;

  const { data: kudoStatus } = useQuery<{ hasGiven: boolean }>({
    queryKey: ["/api/events", kudoPromptEvent?.id, "kudos/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/events/${kudoPromptEvent!.id}/kudos/status`);
      return res.json();
    },
    enabled: !!kudoPromptEvent && !!user,
  });

  const { data: kudoAttendees = [] } = useQuery<{ userId: string; userName: string | null }[]>({
    queryKey: ["/api/events", kudoPromptEvent?.id, "attendees-for-kudo"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/events/${kudoPromptEvent!.id}/attendees-for-kudo`);
      return res.json();
    },
    enabled: !!kudoPromptEvent && !!user,
  });

  const KUDO_TYPES = ["Most Welcoming", "Most Energetic", "Best Conversation", "Always On Time"];
  const showKudoPrompt = !!kudoPromptEvent && kudoStatus !== undefined && !kudoStatus.hasGiven;

  const selectedClub = userClubs.find(c => c.id === selectedClubId) || null;
  const filteredMoments = selectedClubId
    ? feedMoments.filter(m => m.clubId === selectedClubId)
    : feedMoments;

  const displayName = user?.firstName || user?.email?.split("@")[0] || "there";
  const initials = displayName.charAt(0).toUpperCase();

  function toggleLike(id: string) {
    if (!user) return;
    const isLiked = likedPosts.has(id);
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (isLiked) {
      unlikeMutation.mutate(id);
    } else {
      likeMutation.mutate(id);
    }
  }

  async function handleShare(moment: FeedMoment) {
    const url = `${window.location.origin}/club/${moment.clubId}`;
    const shareData = {
      title: moment.clubName,
      text: moment.caption || `Check out ${moment.clubName} on CultFam!`,
      url,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ description: "Link copied to clipboard!" });
    } catch {
      toast({ description: "Could not copy link", variant: "destructive" });
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPostImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handlePostSubmit() {
    if (!postContent.trim() || !selectedClubId) return;
    let imageUrl: string | undefined;
    if (postImageFile) {
      try {
        const filename = `posts/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
        const { data, error } = await supabase.storage
          .from('uploads')
          .upload(filename, postImageFile, { cacheControl: '3600', upsert: true });
        if (error) throw new Error(error.message);
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(filename);
        imageUrl = publicUrl;
      } catch {
        toast({ description: "Image upload failed. Posting without image.", variant: "destructive" });
      }
    }
    createPostMutation.mutate({ clubId: selectedClubId, caption: postContent, imageUrl });
  }

  const sendKudoMutation = useMutation({
    mutationFn: async ({ receiverId, kudoType }: { receiverId: string; kudoType: string }) => {
      const res = await apiRequest("POST", `/api/events/${kudoPromptEvent!.id}/kudos`, { receiverId, kudoType });
      if (!res.ok) throw new Error("Failed to send kudo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", kudoPromptEvent?.id, "kudos/status"] });
      setKudoSheetOpen(false);
      setSelectedKudoReceiver(null);
      setSelectedKudoType(null);
      toast({ description: "Kudo sent anonymously! 🏅" });
    },
    onError: () => {
      toast({ description: "Could not send kudo. Try again.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>

      {/* Sticky Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-4"
        style={{
          background: "rgba(245,240,232,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        data-testid="header-home"
      >
        <div className="flex items-center gap-3">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover shrink-0"
              style={{ border: "2px solid var(--terra)" }}
              loading="lazy"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: "var(--terra)" }}
            >
              {initials}
            </div>
          )}
          <div className="leading-tight">
            <p className="text-[11px] font-medium" style={{ color: "var(--muted-warm)" }}>Welcome back,</p>
            <p className="font-display font-bold text-[16px]" style={{ color: "var(--ink)" }} data-testid="text-user-name">
              {displayName}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/notifications")}
          className="relative w-10 h-10 flex items-center justify-center rounded-full card-native"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" style={{ color: "var(--ink)" }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full text-white font-bold px-1"
              style={{ fontSize: "11px", background: "var(--terra)" }}
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-5 space-y-6">

        {/* My Clubs Stories Row */}
        {user && (
          <div data-testid="section-club-stories">
            <div
              className="flex gap-4 overflow-x-auto pb-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {userClubs.map(club => {
                const isActive = selectedClubId === club.id;
                const hasNewPosts = !seenClubs.has(club.id) && feedMoments.some(
                  m => m.clubId === club.id && new Date(m.createdAt ?? 0) > sessionStartRef.current
                );
                return (
                  <button
                    key={club.id}
                    onClick={() => {
                      setSelectedClubId(club.id);
                      setSeenClubs(prev => new Set([...Array.from(prev), club.id]));
                    }}
                    className="flex flex-col items-center gap-2 shrink-0"
                    style={{ minWidth: 72 }}
                    data-testid={`story-club-${club.id}`}
                  >
                    <div style={{ position: "relative", width: 64, height: 64 }}>
                      {hasNewPosts && (
                        <>
                          <div
                            style={{
                              position: "absolute",
                              inset: -4,
                              borderRadius: "50%",
                              border: "3px solid var(--terra)",
                              animation: "story-pulse 2s ease-in-out infinite",
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              top: -2,
                              right: -2,
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: "var(--terra)",
                              border: "2px solid white",
                              zIndex: 10,
                            }}
                          />
                        </>
                      )}
                      {!hasNewPosts && isActive && (
                        <div
                          style={{
                            position: "absolute",
                            inset: -4,
                            borderRadius: "50%",
                            border: "3px solid var(--terra)",
                          }}
                        />
                      )}
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                        style={{ background: club.bgColor || "var(--ink2)" }}
                      >
                        {club.emoji}
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-semibold text-center leading-tight"
                      style={{
                        color: isActive ? "var(--terra)" : "var(--ink)",
                        maxWidth: 68,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as any,
                        overflow: "hidden",
                      }}
                    >
                      {club.name}
                    </span>
                  </button>
                );
              })}
              <Link
                href="/explore"
                className="flex flex-col items-center gap-2 shrink-0"
                style={{ minWidth: 72 }}
                data-testid="story-add-club"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "var(--warm-white)", border: "2px dashed var(--warm-border)" }}
                >
                  <Plus className="w-6 h-6" style={{ color: "var(--muted-warm)" }} />
                </div>
                <span
                  className="text-[11px] font-semibold text-center leading-tight"
                  style={{ color: "var(--muted-warm)" }}
                >
                  Find Clubs
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* Empty state — user has not joined any clubs yet */}
        {user && userClubs.length === 0 && (
          <div data-testid="empty-state-no-clubs">
            <div
              className="rounded-[20px] p-5 flex flex-col items-center text-center gap-3 mb-4"
              style={{ background: "var(--warm-white)", border: "1.5px dashed rgba(196,98,45,0.35)" }}
            >
              <span className="text-4xl">🏘️</span>
              <div>
                <p className="font-display font-bold text-[16px] mb-1" style={{ color: "var(--ink)" }}>
                  You haven't joined a club yet
                </p>
                <p className="text-[13px]" style={{ color: "var(--muted-warm)" }}>
                  Join clubs to see their posts, events, and announcements here.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Link
                  href="/matched-clubs"
                  className="rounded-full px-5 py-2.5 text-[13px] font-bold text-white text-center"
                  style={{ background: "var(--terra)" }}
                  data-testid="button-view-matches"
                >
                  🎯 See My Matches
                </Link>
                <Link
                  href="/explore"
                  className="rounded-full px-5 py-2.5 text-[13px] font-semibold text-center"
                  style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
                  data-testid="button-browse-clubs"
                >
                  Explore All Clubs
                </Link>
              </div>
            </div>

            {suggestedClubs.length > 0 && (
              <div>
                <p className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--muted-warm)" }}>
                  Popular clubs near you
                </p>
                <div className="flex flex-col gap-3">
                  {suggestedClubs.map(club => (
                    <Link
                      key={club.id}
                      href={club.slug ? `/c/${club.slug}` : `/club/${club.id}`}
                      className="flex items-center gap-3 p-3 rounded-[16px] transition-all active:scale-[0.98]"
                      style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", textDecoration: "none" }}
                      data-testid={`card-suggested-club-${club.id}`}
                    >
                      <div
                        className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 text-2xl"
                        style={{ background: "var(--terra-pale)" }}
                      >
                        {club.coverImageUrl
                          ? <img src={club.coverImageUrl} alt={club.name} className="w-full h-full object-cover rounded-[12px]" loading="lazy" />
                          : club.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14px] truncate" style={{ color: "var(--ink)" }}>{club.name}</p>
                        <p className="text-[11px] truncate" style={{ color: "var(--muted-warm)" }}>
                          {club.category}{club.city ? ` · ${club.city}` : ""}
                        </p>
                      </div>
                      <div
                        className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold"
                        style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
                      >
                        Explore
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post Composer */}
        {user && selectedClub && (
          <div
            className="rounded-[20px] p-4 card-native"
            data-testid="section-post-composer"
          >
            <div className="flex items-start gap-3">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  style={{ border: "1.5px solid var(--terra)" }}
                  loading="lazy"
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: "var(--terra)" }}
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <textarea
                  value={postContent}
                  onChange={e => setPostContent(e.target.value)}
                  placeholder={`Share something with ${selectedClub.name}…`}
                  className="w-full text-[14px] bg-transparent resize-none outline-none"
                  style={{ color: "var(--ink)", minHeight: 64 }}
                  rows={3}
                  data-testid="input-post-content"
                />
                {postImagePreview && (
                  <div className="relative mt-2 rounded-[12px] overflow-hidden">
                    <img
                      src={postImagePreview}
                      alt="Preview"
                      className="w-full max-h-40 object-cover rounded-[12px]"
                      loading="lazy"
                    />
                    <button
                      onClick={() => { setPostImageFile(null); setPostImagePreview(null); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.5)" }}
                      data-testid="button-remove-post-image"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid var(--warm-border)" }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: "var(--muted-warm)" }}
                    data-testid="button-attach-image"
                  >
                    <ImagePlus className="w-4 h-4" />
                    Photo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                    data-testid="input-post-image"
                  />
                  <button
                    onClick={handlePostSubmit}
                    disabled={!postContent.trim() || createPostMutation.isPending}
                    className="rounded-full px-4 py-1.5 text-[12px] font-bold text-white disabled:opacity-40 transition-all active:scale-[0.97]"
                    style={{ background: "var(--terra)" }}
                    data-testid="button-submit-post"
                  >
                    {createPostMutation.isPending ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Happening Soon Reminder */}
        {user && happeningSoon.length > 0 && (
          <div data-testid="section-happening-soon">
            {happeningSoon.map(event => {
              const eventDate = new Date(event.startsAt);
              const diffHrs = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));
              return (
                <Link
                  key={event.id}
                  href={`/event/${event.id}`}
                  className="flex items-center gap-4 rounded-2xl p-4 no-underline transition-all active:scale-[0.98]"
                  style={{ background: 'var(--terra)', border: '1.5px solid rgba(255,255,255,0.15)' }}
                  data-testid={`card-happening-soon-${event.id}`}
                >
                  <div className="rounded-xl px-3 py-2 text-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <p className="text-[11px] font-bold uppercase text-white/80 leading-none mb-0.5">
                      {format(eventDate, "MMM")}
                    </p>
                    <p className="text-xl font-black text-white leading-none">{format(eventDate, "d")}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 mb-0.5">
                      {getEventLabel(eventDate).toUpperCase()} · {diffHrs > 0 ? `in ${diffHrs}h` : "very soon"}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-display font-bold text-white text-[16px] leading-tight truncate" data-testid={`text-soon-event-${event.id}`}>
                        {event.title}
                      </p>
                      {event.recurrenceRule && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-white/15 text-white/90" data-testid={`badge-recurring-${event.id}`}>
                          <Repeat className="w-2.5 h-2.5" />
                          {event.recurrenceRule === "weekly" ? "Weekly" : event.recurrenceRule === "biweekly" ? "Bi-weekly" : "Monthly"}
                        </span>
                      )}
                    </div>
                    {event.clubName && (
                      <p className="text-[11px] text-white/70 mt-0.5">{event.clubEmoji} {event.clubName}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Kudos Prompt Card */}
        {showKudoPrompt && kudoPromptEvent && (
          <div
            className="rounded-[20px] p-5"
            style={{ background: "linear-gradient(135deg, var(--terra-pale), rgba(201,168,76,0.08))", border: "1.5px solid rgba(196,98,45,0.25)" }}
            data-testid="card-kudo-prompt"
          >
            <div className="flex items-center gap-2 mb-1">
              <Medal className="w-4 h-4" style={{ color: "var(--terra)" }} />
              <span className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: "var(--terra)" }}>
                Give a Kudo
              </span>
            </div>
            <h3 className="font-display font-bold text-[17px] leading-tight mb-1" style={{ color: "var(--ink)" }}>
              {kudoPromptEvent.title}
            </h3>
            <p className="text-[12px] mb-4" style={{ color: "var(--muted-warm)" }}>
              Recognise someone who made it great — kudos are anonymous.
            </p>
            <button
              onClick={() => setKudoSheetOpen(true)}
              className="rounded-full px-5 py-2 text-[13px] font-bold text-white transition-all active:scale-[0.97]"
              style={{ background: "var(--terra)" }}
              data-testid="button-give-kudo"
            >
              Give Kudo →
            </button>
          </div>
        )}

        {/* Kudos Sheet */}
        {kudoSheetOpen && kudoPromptEvent && (
          <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setKudoSheetOpen(false)} data-testid="overlay-kudo-sheet">
            <div
              className="w-full rounded-t-3xl p-6 space-y-5 pb-10"
              style={{ background: "var(--cream)", maxHeight: "85vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-black text-[var(--ink)]">Give a Kudo</h2>
                <button onClick={() => setKudoSheetOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="button-close-kudo-sheet">
                  <X className="w-4 h-4 text-[var(--ink3)]" />
                </button>
              </div>
              <p className="text-sm text-[var(--muted-warm)]">From: {kudoPromptEvent.title}</p>

              {kudoAttendees.length === 0 ? (
                <div className="text-center py-8 text-sm text-[var(--muted-warm)]" data-testid="text-no-attendees">
                  No other attendees to give kudos to.
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-warm)] mb-3">Choose a person</p>
                    <div className="flex flex-wrap gap-2">
                      {kudoAttendees.map(a => (
                        <button
                          key={a.userId}
                          onClick={() => setSelectedKudoReceiver(a.userId)}
                          className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition-all"
                          style={{
                            background: selectedKudoReceiver === a.userId ? "var(--terra)" : "var(--warm-white)",
                            color: selectedKudoReceiver === a.userId ? "white" : "var(--ink)",
                            border: selectedKudoReceiver === a.userId ? "1.5px solid var(--terra)" : "1.5px solid var(--warm-border)",
                          }}
                          data-testid={`button-kudo-receiver-${a.userId}`}
                        >
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--terra-pale)", color: "var(--terra)" }}>
                            {(a.userName || "?").charAt(0).toUpperCase()}
                          </span>
                          {a.userName || "Member"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-warm)] mb-3">Choose a kudo type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {KUDO_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => setSelectedKudoType(type)}
                          className="px-3 py-2.5 rounded-2xl text-sm font-semibold text-left transition-all"
                          style={{
                            background: selectedKudoType === type ? "var(--terra)" : "var(--warm-white)",
                            color: selectedKudoType === type ? "white" : "var(--ink)",
                            border: selectedKudoType === type ? "1.5px solid var(--terra)" : "1.5px solid var(--warm-border)",
                          }}
                          data-testid={`button-kudo-type-${type.replace(/\s+/g, "-").toLowerCase()}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (selectedKudoReceiver && selectedKudoType) {
                        sendKudoMutation.mutate({ receiverId: selectedKudoReceiver, kudoType: selectedKudoType });
                      }
                    }}
                    disabled={!selectedKudoReceiver || !selectedKudoType || sendKudoMutation.isPending}
                    className="w-full py-3.5 rounded-2xl font-bold text-white text-sm disabled:opacity-40 transition-all active:scale-[0.98]"
                    style={{ background: "var(--terra)" }}
                    data-testid="button-send-kudo"
                  >
                    {sendKudoMutation.isPending ? "Sending..." : "Send Kudo Anonymously 🏅"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Community Feed */}
        {user && userClubs.length > 0 ? (
        <div data-testid="section-feed">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-xl" style={{ color: "var(--ink)" }}>
              {selectedClub ? selectedClub.name : "Community"}
            </h2>
          </div>

          {feedLoading && feedPage === 1 ? (
            <>
              <MomentCardSkeleton />
              <MomentCardSkeleton />
            </>
          ) : filteredMoments.length === 0 ? (
            <div
              className="rounded-[20px] p-6 flex flex-col items-center text-center gap-3"
              style={{ background: "var(--warm-white)", border: "1.5px dashed rgba(196,98,45,0.35)" }}
              data-testid="empty-state-feed"
            >
              <span className="text-4xl">📸</span>
              <div>
                <p className="font-display font-bold text-[15px] mb-1" style={{ color: "var(--ink)" }}>
                  No posts yet
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted-warm)" }}>
                  {selectedClub
                    ? `Be the first to share something with ${selectedClub.name}.`
                    : "Clubs will share moments here once they get going."}
                </p>
              </div>
            </div>
          ) : (
            <>
            {filteredMoments.map((moment) => (
              <div
                key={moment.id}
                className="rounded-[20px] overflow-hidden mb-4 card-native"
                data-testid={`post-${moment.id}`}
              >
                <div className="flex items-center gap-3 p-4 pb-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xl"
                    style={{ background: "var(--ink2)", border: "2px solid var(--terra)" }}
                  >
                    {moment.clubEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/club/${moment.clubId}`}
                      className="font-bold text-[14px] leading-tight truncate block no-underline"
                      style={{ color: "var(--ink)" }}
                    >
                      {moment.clubName}
                    </Link>
                    <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>
                      {moment.authorName ? (
                        <span>
                          <span style={{ color: "var(--terra)", fontWeight: 600 }}>
                            {moment.authorUserId === user?.id ? "You" : moment.authorName}
                          </span>
                          {" · "}
                        </span>
                      ) : null}
                      {moment.createdAt
                        ? `${formatDistanceToNow(new Date(moment.createdAt))} ago`
                        : "Recently"
                      }
                      {moment.clubLocation ? ` · ${moment.clubLocation}` : ""}
                    </p>
                  </div>
                </div>

                {moment.imageUrl ? (
                  <div className="mx-4 rounded-[16px] overflow-hidden mb-3">
                    <img
                      src={moment.imageUrl}
                      alt={moment.caption || ""}
                      className="w-full object-cover"
                      style={{ maxHeight: 260 }}
                      loading="lazy"
                    />
                  </div>
                ) : moment.emoji ? (
                  <div className="mx-4 mb-3 flex items-center gap-2 px-1">
                    <span className="text-2xl">{{ fire: "🔥", star: "⭐" }[moment.emoji] ?? moment.emoji}</span>
                  </div>
                ) : null}

                <div className="px-4 pb-4">
                  {moment.caption && <ExpandableCaption text={moment.caption} />}
                  <div className="flex items-center gap-5">
                    <button
                      onClick={() => toggleLike(moment.id)}
                      className="flex items-center gap-1.5 transition-transform active:scale-90"
                      data-testid={`button-like-${moment.id}`}
                    >
                      <Heart
                        className="w-5 h-5 transition-colors"
                        style={{
                          color: likedPosts.has(moment.id) ? "#e53e3e" : "var(--muted-warm)",
                          fill: likedPosts.has(moment.id) ? "#e53e3e" : "transparent",
                        }}
                      />
                      {((likeCountOverrides[moment.id] ?? moment.likesCount) > 0) && (
                        <span className="text-[11px] font-semibold" style={{ color: likedPosts.has(moment.id) ? "#e53e3e" : "var(--muted-warm)" }} data-testid={`text-likes-${moment.id}`}>
                          {likeCountOverrides[moment.id] ?? moment.likesCount}
                        </span>
                      )}
                    </button>
                    <Link
                      href={`/club/${moment.clubId}?tab=moments`}
                      className="flex items-center gap-1.5 transition-transform active:scale-90"
                      style={{ textDecoration: "none" }}
                      data-testid={`button-comments-${moment.id}`}
                    >
                      <MessageCircle className="w-5 h-5" style={{ color: "var(--muted-warm)" }} />
                      {moment.commentCount > 0 && (
                        <span className="text-[11px] font-semibold" style={{ color: "var(--muted-warm)" }}>
                          {moment.commentCount}
                        </span>
                      )}
                    </Link>
                    <button
                      onClick={() => handleShare(moment)}
                      className="flex items-center gap-1.5 ml-auto transition-transform active:scale-90"
                      data-testid={`button-share-${moment.id}`}
                    >
                      <Share2 className="w-5 h-5" style={{ color: "var(--muted-warm)" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {hasMoments && (
              <button
                onClick={loadMoreFeed}
                disabled={feedFetching}
                className="w-full py-3 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                style={{ background: "var(--warm-white)", color: "var(--terra)", border: "1.5px solid var(--terra)" }}
                data-testid="button-load-more-feed"
              >
                {feedFetching ? <><Loader2 className="w-4 h-4 animate-spin" />Loading...</> : "Load more posts"}
              </button>
            )}
            </>
          )}
        </div>
        ) : null}

      </div>
    </div>
  );
}
