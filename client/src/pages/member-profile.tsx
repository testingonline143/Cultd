import { useParams, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, MapPin, Users, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface MemberPublicProfile {
  id: string;
  name: string;
  bio: string | null;
  city: string | null;
  profileImageUrl: string | null;
  role: string;
  clubs: { id: string; name: string; emoji: string; category: string }[];
}

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: profile, isLoading, error } = useQuery<MemberPublicProfile>({
    queryKey: ["/api/users", id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) throw new Error("User not found");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-lg mx-auto px-5 pt-5">
          <button
            onClick={() => navigate(-1 as any)}
            className="flex items-center gap-1.5 mb-6"
            style={{ color: "var(--muted-warm)" }}
            data-testid="button-back-loading"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex flex-col items-center gap-4 mb-8">
            <Skeleton className="w-24 h-24 rounded-full" />
            <Skeleton className="w-40 h-6 rounded-lg" />
            <Skeleton className="w-24 h-4 rounded-lg" />
            <Skeleton className="w-64 h-4 rounded-lg" />
          </div>

          <Skeleton className="w-20 h-3 rounded mb-3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="w-full h-16 rounded-[16px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 pb-24">
        <div
          className="glass-card rounded-2xl p-8 text-center max-w-sm w-full space-y-4"
          data-testid="section-member-not-found"
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--terra-pale)" }}
          >
            <Users className="w-8 h-8" style={{ color: "var(--terra)" }} />
          </div>
          <h2 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>
            Member not found
          </h2>
          <p className="text-sm" style={{ color: "var(--muted-warm)" }}>
            This profile may no longer be available.
          </p>
          <button
            onClick={() => navigate(-1 as any)}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--terra)" }}
            data-testid="button-back-not-found"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const initial = profile.name.charAt(0).toUpperCase();
  const isOrganiser = profile.role === "organiser" || profile.role === "admin";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-5 pt-5">
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-1.5 mb-6"
          style={{ color: "var(--muted-warm)" }}
          data-testid="button-back"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex flex-col items-center text-center gap-3 mb-8" data-testid="section-member-header">
          <Avatar className="w-24 h-24 border-4" style={{ borderColor: "var(--terra-pale)" }}>
            <AvatarImage src={profile.profileImageUrl || undefined} alt={profile.name} />
            <AvatarFallback
              className="text-3xl font-bold"
              style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
            >
              {initial}
            </AvatarFallback>
          </Avatar>

          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h1
                className="font-display font-bold text-2xl"
                style={{ color: "var(--ink)" }}
                data-testid="text-member-name"
              >
                {profile.name}
              </h1>
              {isOrganiser && (
                <Shield
                  className="w-4 h-4 shrink-0"
                  style={{ color: "var(--terra)" }}
                  data-testid="icon-organiser-badge"
                />
              )}
            </div>

            {profile.city && (
              <div className="flex items-center justify-center gap-1" data-testid="text-member-city">
                <MapPin className="w-3.5 h-3.5" style={{ color: "var(--muted-warm)" }} />
                <span className="text-sm" style={{ color: "var(--muted-warm)" }}>{profile.city}</span>
              </div>
            )}
          </div>

          {profile.bio && (
            <p
              className="text-sm italic max-w-xs leading-relaxed"
              style={{ color: "var(--ink3)" }}
              data-testid="text-member-bio"
            >
              "{profile.bio}"
            </p>
          )}
        </div>

        <div data-testid="section-member-clubs">
          <p
            className="text-xs font-bold uppercase tracking-wider mb-3"
            style={{ color: "var(--muted-warm)" }}
          >
            Clubs · {profile.clubs.length}
          </p>

          {profile.clubs.length === 0 ? (
            <div
              className="glass-card rounded-[16px] p-6 text-center"
              data-testid="text-no-clubs"
            >
              <p className="text-sm" style={{ color: "var(--muted-warm)" }}>No public clubs yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.clubs.map(club => (
                <Link
                  key={club.id}
                  href={`/club/${club.id}`}
                  className="flex items-center gap-4 p-4 rounded-[16px] transition-all active:scale-[0.98]"
                  style={{
                    background: "var(--warm-white)",
                    border: "1.5px solid var(--warm-border)",
                    textDecoration: "none",
                    display: "flex",
                  }}
                  data-testid={`link-club-${club.id}`}
                >
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center shrink-0 text-2xl"
                    style={{ background: "var(--cream)" }}
                  >
                    {club.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-bold text-[15px] truncate"
                      style={{ color: "var(--ink)" }}
                      data-testid={`text-club-name-${club.id}`}
                    >
                      {club.name}
                    </p>
                    <Badge
                      variant="secondary"
                      className="text-[10px] mt-0.5 no-default-active-elevate"
                      data-testid={`badge-club-category-${club.id}`}
                    >
                      {club.category}
                    </Badge>
                  </div>
                  <ChevronLeft
                    className="w-4 h-4 rotate-180 shrink-0"
                    style={{ color: "var(--muted-warm)" }}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
