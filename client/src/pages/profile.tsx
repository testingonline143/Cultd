import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, Link } from "wouter";
import type { JoinRequest, Club } from "@shared/schema";
import type { User } from "@shared/models/auth";
import { ArrowLeft, Edit2, Check, X, Calendar, MapPin, RefreshCw, User as UserIcon, Users, LogIn, Camera, Loader2, LayoutDashboard, ChevronRight, LogOut, Clock3, CheckCircle2, XCircle, Ticket, ChevronDown, BarChart3, ShieldCheck, Medal, PlusCircle } from "lucide-react";

export default function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-4" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full animate-pulse" style={{ background: "var(--warm-border)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-6 w-32 rounded-lg animate-pulse" style={{ background: "var(--warm-border)" }} />
                <div className="h-4 w-48 rounded-lg animate-pulse" style={{ background: "var(--warm-border)" }} />
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-2xl p-4 h-20 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        <div className="glass-card rounded-2xl p-8 text-center max-w-sm w-full space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2" style={{ background: 'var(--terra-pale)', borderColor: 'var(--terra)' }}>
            <UserIcon className="w-8 h-8" style={{ color: 'var(--terra)' }} />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground" data-testid="text-sign-in-heading">
            Your Profile
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="text-sign-in-message">
            Sign in to view your profile, joined clubs, and upcoming events.
          </p>
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="rounded-xl px-8 py-3 text-sm font-semibold inline-flex items-center gap-2 text-white"
            style={{ background: 'var(--terra)' }}
            data-testid="button-sign-in-profile"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8 overflow-x-hidden" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
        {/* Account — avatar, name, bio, actions */}
        <section data-testid="section-account">
          <ProfileHeader user={user} />
          <ProfileActions user={user} />
        </section>

        {/* Activity — upcoming events, joined clubs, past attendance */}
        <section data-testid="section-activity">
          <UserEvents userId={user.id} />
          <JoinedClubs userId={user.id} />
          <AttendanceSection />
        </section>

        {/* Community — proposals, kudos */}
        <section data-testid="section-community">
          <MyProposals />
          <KudosReceived />
        </section>
      </div>
    </div>
  );
}

function ProfileHeader({ user }: { user: User }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(user.firstName || "");
  const [editBio, setEditBio] = useState(user.bio || "");
  const [editCity, setEditCity] = useState(user.city || "");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: attendanceStats = [] } = useQuery<{ clubId: string; attended: number }[]>({
    queryKey: ["/api/user/attendance-stats"],
  });
  const totalAttended = attendanceStats.reduce((sum, s) => sum + s.attended, 0);

  const { data: foundingData } = useQuery<{ clubs: { clubId: string; clubName: string; isFoundingMember: boolean | null }[] }>({
    queryKey: ["/api/user/founding-status"],
  });
  const isAnyFoundingMember = foundingData?.clubs?.some(c => c.isFoundingMember);

  const photoMutation = useMutation({
    mutationFn: async (file: File) => {
      const filename = `avatars/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
      const { error } = await supabase.storage
        .from("uploads")
        .upload(filename, file, { cacheControl: "3600", upsert: true });
      if (error) throw new Error(error.message);
      const { data: { publicUrl } } = supabase.storage.from("uploads").getPublicUrl(filename);
      const res = await apiRequest("PATCH", "/api/user/profile", { profileImageUrl: publicUrl });
      if (!res.ok) throw new Error("Failed to save photo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile photo updated!" });
    },
    onError: () => {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    },
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    photoMutation.mutate(file);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string; bio: string; city: string }) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setEditing(false);
      setError("");
    },
    onError: () => {
      setError("Failed to update profile");
    },
  });

  const handleSave = () => {
    if (!editName || editName.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    updateMutation.mutate({ name: editName, bio: editBio, city: editCity });
  };

  const displayName = user.firstName || (user.email ? user.email.split("@")[0] : "User");

  return (
    <div className="glass-card rounded-2xl p-6 mb-4" data-testid="card-profile">
      <div className="flex items-start gap-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-16 h-16 rounded-full flex items-center justify-center shrink-0 overflow-hidden border-2 group"
          style={{ background: 'var(--terra-pale)', borderColor: 'var(--terra)' }}
          disabled={photoMutation.isPending}
          data-testid="button-upload-photo"
        >
          {photoMutation.isPending ? (
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--terra)' }} />
          ) : user.profileImageUrl ? (
            <img src={user.profileImageUrl} alt="" className="w-full h-full object-cover rounded-full" />
          ) : (
            <UserIcon className="w-7 h-7" style={{ color: 'var(--terra)' }} />
          )}
          {!photoMutation.isPending && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-5 h-5 text-white" />
            </div>
          )}
        </button>
        <span className="text-[11px] text-muted-foreground mt-1 block text-center sm:hidden">Tap to change</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handlePhotoSelect}
          data-testid="input-photo-upload"
        />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--warm-border)', background: 'var(--cream)' }}
                  data-testid="input-edit-name"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="e.g. Tirupati"
                  className="w-full px-3 py-2 rounded-md border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: 'var(--warm-border)', background: 'var(--cream)' }}
                  data-testid="input-edit-city"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 200))}
                  placeholder="Tell the club about yourself"
                  rows={3}
                  className="w-full px-3 py-2 rounded-md border text-sm text-foreground focus:outline-none focus:ring-2 resize-none"
                  style={{ borderColor: 'var(--warm-border)', background: 'var(--cream)' }}
                  data-testid="input-edit-bio"
                />
                <p className="text-xs text-muted-foreground text-right mt-0.5">{editBio.length}/200</p>
              </div>
              {error && <p className="text-xs text-destructive" data-testid="text-edit-error">{error}</p>}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-50 text-white"
                  style={{ background: 'var(--terra)' }}
                  data-testid="button-save-profile"
                >
                  <Check className="w-3.5 h-3.5" />
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditName(user.firstName || ""); setEditBio(user.bio || ""); setEditCity(user.city || ""); setError(""); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md glass-card text-muted-foreground text-xs font-semibold"
                  data-testid="button-cancel-edit"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <h1 className="font-display text-2xl font-bold truncate" style={{ color: 'var(--terra)' }} data-testid="text-profile-name">{displayName}</h1>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="w-7 h-7 rounded-full glass-card text-muted-foreground flex items-center justify-center transition-all shrink-0"
                  data-testid="button-edit-name"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {user.email && <p className="text-sm text-muted-foreground mt-0.5 truncate" data-testid="text-profile-email">{user.email}</p>}
              {user.city && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap"><MapPin className="w-3 h-3" /> {user.city}</p>}
              {user.bio && <p className="text-sm text-foreground mt-2" data-testid="text-profile-bio">{user.bio}</p>}
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {totalAttended > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--terra-pale)', color: 'var(--terra)', border: '1px solid rgba(196,98,45,0.25)' }} data-testid="badge-attended-total">
                    <CheckCircle2 className="w-3 h-3" />
                    {totalAttended} event{totalAttended === 1 ? "" : "s"} attended
                  </span>
                )}
                {isAnyFoundingMember && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#92400e', border: '1px solid rgba(251,191,36,0.4)' }} data-testid="badge-founding-member">
                    ⚡ Founding Member
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileActions({ user }: { user: User }) {
  const [, navigate] = useLocation();
  const { logout, isLoggingOut } = useAuth();

  const { data: adminStatus } = useQuery<{ configured: boolean; isCurrentUserAdmin: boolean }>({
    queryKey: ["/api/admin/status"],
    retry: false,
  });

  const handleRedoQuiz = () => {
    navigate("/onboarding");
  };

  const isAdmin = adminStatus?.isCurrentUserAdmin === true;
  const isOrganiserOrAdmin = user.role === "organiser" || user.role === "admin" || isAdmin;

  return (
    <div className="space-y-3 mb-6">
      {isAdmin && (
        <Link href="/admin" data-testid="link-admin-dashboard">
          <div className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer group transition-all" style={{ borderColor: 'rgba(196,98,45,0.4)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}>
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--terra)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm font-bold" style={{ color: 'var(--terra)' }} data-testid="text-admin-dashboard-label">Admin Dashboard</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage users, clubs & platform settings</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}
      {isOrganiserOrAdmin && (
        <Link href="/organizer" data-testid="link-organiser-dashboard">
          <div className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer group transition-all" style={{ borderColor: 'rgba(196,98,45,0.3)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}>
              <LayoutDashboard className="w-5 h-5" style={{ color: 'var(--terra)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm font-bold" style={{ color: 'var(--terra)' }} data-testid="text-organiser-dashboard-label">Organiser Dashboard</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage your clubs, events & members</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}
      {!isOrganiserOrAdmin && (
        <Link href="/explore" data-testid="link-propose-club">
          <div className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer group transition-all" style={{ borderColor: "rgba(196,98,45,0.3)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--terra-pale)" }}>
              <PlusCircle className="w-5 h-5" style={{ color: "var(--terra)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-sm font-bold" style={{ color: "var(--terra)" }}>Propose a Club</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Start your own community around a hobby</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}
      <Link href="/my-payments" data-testid="link-my-payments">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 cursor-pointer group transition-all">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--terra-pale)" }}>
            <Ticket className="w-5 h-5" style={{ color: "var(--terra)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm font-bold" style={{ color: "var(--ink)" }}>My Payments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">View your ticket purchase history</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </Link>
      <div className="flex gap-2 flex-wrap">
        {user.quizCompleted && (
          <button
            onClick={handleRedoQuiz}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md glass-card text-xs font-semibold text-muted-foreground transition-all"
            data-testid="button-redo-quiz"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Redo Quiz
          </button>
        )}
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md glass-card text-xs font-semibold text-muted-foreground transition-all disabled:opacity-50"
          data-testid="button-logout"
        >
          {isLoggingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          {isLoggingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </div>
  );
}

interface UserRsvp {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  eventLocation: string;
  clubName: string;
  clubEmoji: string;
  status: string;
  checkedIn?: boolean | null;
  checkedInAt?: string | null;
}

function UserEvents({ userId }: { userId: string }) {
  const { data: rsvps = [], isLoading } = useQuery<UserRsvp[]>({
    queryKey: ["/api/user/events", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/events");
      return res.json();
    },
  });

  const now = new Date();
  const upcomingRsvps = rsvps.filter((r) => new Date(r.eventStartsAt) > now);
  const pastRsvps = rsvps.filter((r) => new Date(r.eventStartsAt) <= now);

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="h-5 w-48 bg-muted/20 rounded animate-pulse mb-4" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (upcomingRsvps.length === 0 && pastRsvps.length === 0) return null;

  return (
    <div className="mb-6">
      {upcomingRsvps.length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground mb-4" data-testid="text-your-events-title">
            Your Upcoming Events ({upcomingRsvps.length})
          </h2>
          <div className="space-y-2 mb-6" data-testid="list-user-events">
            {upcomingRsvps.map((rsvp) => (
              <EventTicketCard key={rsvp.id} rsvp={rsvp} isPast={false} />
            ))}
          </div>
        </>
      )}

      {pastRsvps.length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold text-foreground mb-4" data-testid="text-past-events-title">
            Past Events ({pastRsvps.length})
          </h2>
          <div className="space-y-2" data-testid="list-past-events">
            {pastRsvps.map((rsvp) => (
              <EventTicketCard key={rsvp.id} rsvp={rsvp} isPast={true} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EventTicketCard({ rsvp, isPast }: { rsvp: UserRsvp; isPast: boolean }) {
  const [showTicket, setShowTicket] = useState(false);
  const d = new Date(rsvp.eventStartsAt);

  return (
    <div
      className={`glass-card rounded-2xl overflow-hidden ${isPast ? "opacity-60" : ""}`}
      data-testid={`card-rsvp-event-${rsvp.eventId}`}
    >
      <div className="flex items-center gap-4 p-4">
        <div className="text-2xl shrink-0">{rsvp.clubEmoji}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{rsvp.eventTitle}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{rsvp.clubName}</div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} &middot; {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {rsvp.eventLocation}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isPast ? (
            rsvp.checkedIn ? (
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--green-accent)' }} data-testid={`badge-attended-${rsvp.eventId}`}>
                <CheckCircle2 className="w-3 h-3" /> Attended
              </span>
            ) : (
              <span className="text-xs font-semibold flex items-center gap-1 text-muted-foreground" data-testid={`badge-missed-${rsvp.eventId}`}>
                <XCircle className="w-3 h-3" /> Missed
              </span>
            )
          ) : (
            <>
              <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--green-accent)' }}>
                <Check className="w-3 h-3" /> Going
              </span>
              <button
                onClick={() => setShowTicket(!showTicket)}
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all"
                style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}
                data-testid={`button-show-ticket-${rsvp.eventId}`}
              >
                <Ticket className="w-3 h-3" />
                {showTicket ? "Hide" : "Ticket"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showTicket ? "rotate-180" : ""}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {showTicket && !isPast && (
        <div className="px-4 pb-4 pt-0">
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'var(--cream)', border: '1.5px dashed var(--warm-border)' }}
            data-testid={`ticket-qr-${rsvp.eventId}`}
          >
            {(() => {
              const storedToken = localStorage.getItem(`ticket-token-${rsvp.id}`);
              if (!storedToken) {
                return (
                  <div className="w-[200px] h-[200px] mx-auto mb-3 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground" data-testid={`div-qr-unavailable-${rsvp.eventId}`}>
                    <Ticket className="w-8 h-8 opacity-40" />
                    <p className="text-xs">Ticket QR only available on the device used to RSVP</p>
                  </div>
                );
              }
              return (
                <img
                  src={`/api/rsvps/${rsvp.id}/qr?token=${encodeURIComponent(storedToken)}`}
                  alt="QR Ticket"
                  className="w-[200px] h-[200px] mx-auto mb-3 rounded-lg"
                  style={{ imageRendering: 'pixelated' }}
                  data-testid={`img-qr-${rsvp.eventId}`}
                />
              );
            })()}
            <p className="text-xs font-semibold text-foreground mb-0.5">{rsvp.eventTitle}</p>
            <p className="text-[11px] text-muted-foreground">Show this at the door</p>
          </div>
        </div>
      )}
    </div>
  );
}

function JoinedClubs({ userId }: { userId: string }) {
  const { toast } = useToast();
  const { data: joinRequests = [], isLoading: loadingRequests } = useQuery<JoinRequest[]>({
    queryKey: ["/api/user/join-requests", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/join-requests");
      return res.json();
    },
  });

  const clubIds = Array.from(new Set(joinRequests.map((r) => r.clubId)));

  const { data: clubsData, isLoading: loadingClubs } = useQuery<{ clubs: Club[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/clubs"],
  });
  const clubs = clubsData?.clubs ?? [];

  const leaveMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const res = await apiRequest("DELETE", `/api/clubs/${clubId}/leave`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      toast({ title: "You've left the club" });
    },
    onError: () => {
      toast({ title: "Failed to leave club", variant: "destructive" });
    },
  });

  const [confirmingLeaveId, setConfirmingLeaveId] = useState<string | null>(null);

  const approvedRequests = joinRequests.filter((r) => (r as any).status === "approved");
  const pendingRequests = joinRequests.filter((r) => (r as any).status === "pending");
  const rejectedRequests = joinRequests.filter((r) => (r as any).status === "rejected");
  const approvedClubs = clubs.filter((c) => approvedRequests.some((r) => r.clubId === c.id));
  const pendingClubs = clubs.filter((c) => pendingRequests.some((r) => r.clubId === c.id));

  if (loadingRequests || loadingClubs) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 bg-muted/20 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-4 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-foreground mb-4" data-testid="text-joined-clubs-title">
        Your Clubs ({approvedClubs.length})
      </h2>

      {approvedClubs.length === 0 && pendingClubs.length === 0 ? (
        <div className="text-center py-12 glass-card rounded-2xl" data-testid="text-no-joined-clubs">
          <div className="text-5xl mb-3">🏕️</div>
          <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>No clubs yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--muted-warm)" }}>Find a hobby community and join your first club.</p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
            style={{ background: "var(--terra)" }}
            data-testid="link-explore-clubs"
          >
            Explore Clubs
          </Link>
        </div>
      ) : (
        <>
          {approvedClubs.length > 0 && (
            <div className="space-y-3 mb-6" data-testid="list-joined-clubs">
              {approvedClubs.map((club) => {
                const request = approvedRequests.find((r) => r.clubId === club.id);
                return (
                  <div
                    key={club.id}
                    className="flex items-center gap-4 p-4 glass-card rounded-2xl"
                    data-testid={`card-joined-club-${club.id}`}
                  >
                    <Link href={`/club/${club.id}`} className="text-3xl shrink-0">{club.emoji}</Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/club/${club.id}`}>
                        <div className="font-semibold text-sm text-foreground" data-testid={`text-club-name-${club.id}`}>{club.name}</div>
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{club.category} &middot; {club.memberCount} members</div>
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--green-accent)' }}>
                        <CheckCircle2 className="w-3 h-3" /> Member
                      </div>
                    </div>
                    {confirmingLeaveId === club.id ? (
                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            leaveMutation.mutate(club.id);
                            setConfirmingLeaveId(null);
                          }}
                          disabled={leaveMutation.isPending}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive transition-colors"
                          data-testid={`button-confirm-leave-${club.id}`}
                        >
                          {leaveMutation.isPending ? "..." : "Leave"}
                        </button>
                        <button
                          onClick={() => setConfirmingLeaveId(null)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground transition-colors"
                          style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                          data-testid={`button-cancel-leave-${club.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingLeaveId(club.id)}
                        className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                        data-testid={`button-leave-club-${club.id}`}
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pendingClubs.length > 0 && (
            <>
              <h2 className="font-display text-lg font-bold text-foreground mb-4" data-testid="text-pending-clubs-title">
                Pending Requests ({pendingClubs.length})
              </h2>
              <div className="space-y-3 mb-6" data-testid="list-pending-clubs">
                {pendingClubs.map((club) => (
                  <div
                    key={club.id}
                    className="flex items-center gap-4 p-4 glass-card rounded-2xl"
                    data-testid={`card-pending-club-${club.id}`}
                  >
                    <Link href={`/club/${club.id}`} className="text-3xl shrink-0">{club.emoji}</Link>
                    <div className="flex-1 min-w-0">
                      <Link href={`/club/${club.id}`}>
                        <div className="font-semibold text-sm text-foreground">{club.name}</div>
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{club.category}</div>
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--gold)' }}>
                        <Clock3 className="w-3 h-3" /> Awaiting approval
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {joinRequests.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-lg font-bold text-foreground mb-4" data-testid="text-request-history-title">
            Request History ({joinRequests.length})
          </h2>
          <div className="space-y-2" data-testid="list-request-history">
            {joinRequests.map((req) => {
              const status = (req as any).status || "pending";
              return (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 glass-card rounded-2xl"
                  data-testid={`row-request-${req.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{req.clubName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </div>
                  {status === "approved" ? (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--green-accent)' }} data-testid={`text-status-${req.id}`}><CheckCircle2 className="w-3 h-3" /> Approved</span>
                  ) : status === "rejected" ? (
                    <span className="text-xs font-semibold flex items-center gap-1 text-destructive" data-testid={`text-status-${req.id}`}><XCircle className="w-3 h-3" /> Rejected</span>
                  ) : (
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--gold)' }} data-testid={`text-status-${req.id}`}><Clock3 className="w-3 h-3" /> Pending</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AttendanceSection() {
  const { data: stats = [], isLoading } = useQuery<{ clubId: string; clubName: string; clubEmoji: string; totalRsvps: number; attended: number }[]>({
    queryKey: ["/api/user/attendance-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/attendance-stats");
      return res.json();
    },
  });

  if (isLoading || stats.length === 0) return null;

  return (
    <div className="mt-8 pb-2" data-testid="section-attendance">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4" style={{ color: 'var(--terra)' }} />
        <h2 className="font-display text-lg font-bold text-foreground" data-testid="text-attendance-title">
          Attendance History
        </h2>
      </div>
      <div className="space-y-3">
        {stats.map((stat) => {
          const pct = stat.totalRsvps > 0 ? Math.round((stat.attended / stat.totalRsvps) * 100) : 0;
          return (
            <div
              key={stat.clubId}
              className="glass-card rounded-2xl p-4 flex items-center gap-4"
              data-testid={`card-attendance-${stat.clubId}`}
            >
              <div className="text-2xl shrink-0">{stat.clubEmoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground truncate">{stat.clubName}</div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--warm-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--terra)' }} />
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color: 'var(--terra)' }} data-testid={`text-attendance-pct-${stat.clubId}`}>{pct}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-foreground" data-testid={`text-attended-${stat.clubId}`}>{stat.attended}/{stat.totalRsvps}</div>
                <div className="text-[11px] text-muted-foreground">attended</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyProposals() {
  const { user } = useAuth();
  const { data: proposals = [], isLoading } = useQuery<{
    id: string;
    clubName: string;
    category: string;
    status: string;
    reviewNote: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/club-proposals/mine"],
    enabled: !!user,
  });

  if (isLoading || proposals.length === 0) return null;

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    pending: { label: "Under Review", bg: "rgba(251,191,36,0.12)", color: "#92400e" },
    approved: { label: "Approved", bg: "rgba(22,163,74,0.12)", color: "#15803d" },
    rejected: { label: "Not Approved", bg: "rgba(239,68,68,0.12)", color: "#dc2626" },
  };

  return (
    <div className="mt-8" data-testid="section-my-proposals">
      <div className="flex items-center gap-2 mb-4">
        <Clock3 className="w-4 h-4" style={{ color: "var(--terra)" }} />
        <h2 className="font-display text-lg font-bold text-foreground" data-testid="text-proposals-title">
          My Club Proposals
        </h2>
      </div>
      <div className="space-y-3">
        {proposals.map((p) => {
          const cfg = statusConfig[p.status] || statusConfig.pending;
          return (
            <div key={p.id} className="glass-card rounded-2xl p-4" data-testid={`proposal-${p.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold text-foreground truncate">{p.clubName}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.category}</p>
                </div>
                <span
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: cfg.bg, color: cfg.color }}
                  data-testid={`proposal-status-${p.id}`}
                >
                  {cfg.label}
                </span>
              </div>
              {p.status === "rejected" && p.reviewNote && (
                <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "#dc2626" }}>
                  {p.reviewNote}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KudosReceived() {
  const { user } = useAuth();
  const { data: kudos = [], isLoading } = useQuery<{ id: string; kudoType: string; eventTitle: string; createdAt: string | null }[]>({
    queryKey: ["/api/user/kudos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/kudos");
      return res.json();
    },
    enabled: !!user,
  });

  if (isLoading || !user) return null;

  return (
    <div className="mt-8" data-testid="section-kudos-received">
      <div className="flex items-center gap-2 mb-4">
        <Medal className="w-4 h-4" style={{ color: 'var(--terra)' }} />
        <h2 className="font-display text-lg font-bold text-foreground" data-testid="text-kudos-title">
          Kudos Received
        </h2>
        {kudos.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>
            {kudos.length}
          </span>
        )}
      </div>
      {kudos.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center" data-testid="text-no-kudos">
          <span className="text-3xl block mb-2">🏅</span>
          <p className="text-sm font-semibold text-foreground mb-1">No kudos yet</p>
          <p className="text-xs text-muted-foreground">Attend events to earn kudos from fellow members.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" data-testid="list-kudos">
          {kudos.map((kudo) => (
            <div
              key={kudo.id}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#92400e', border: '1px solid rgba(251,191,36,0.4)' }}
              data-testid={`badge-kudo-${kudo.id}`}
            >
              <Medal className="w-3.5 h-3.5 shrink-0" />
              <span>{kudo.kudoType}</span>
              <span className="text-[11px] opacity-70 truncate max-w-[120px]">· {kudo.eventTitle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
