import { motion } from "framer-motion";
import { Calendar, Users, MapPin, Star, Clock, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Club } from "@shared/schema";

const HEALTH_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  green: { dot: "bg-[var(--green-accent)]", bg: "bg-[var(--green-accent)]/10", text: "text-[var(--green-accent)]" },
  yellow: { dot: "bg-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-600" },
  red: { dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-500" },
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  Trekking: "linear-gradient(135deg, #E8D5B8, #C4A882)",
  Cycling: "linear-gradient(135deg, #B8D4E8, #82A8C4)",
  Photography: "linear-gradient(135deg, #D4B8E8, #A882C4)",
  Fitness: "linear-gradient(135deg, #B8E8C8, #82C498)",
  Books: "linear-gradient(135deg, #E8D8B8, #C4B082)",
  Art: "linear-gradient(135deg, #E8B8B8, #C48282)",
  Arts: "linear-gradient(135deg, #E8B8B8, #C48282)",
};

interface ClubCardProps {
  club: Club & { recentJoins?: number };
  index: number;
}

function shareClub(club: Club, e: React.MouseEvent) {
  e.stopPropagation();
  const url = `${window.location.origin}/club/${club.id}`;
  const text = `Check out ${club.name} on CultFam! ${url}`;

  if (navigator.share) {
    navigator.share({ title: club.name, text: `Check out ${club.name} on CultFam!`, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

export function ClubCard({ club, index }: ClubCardProps) {
  const [, navigate] = useLocation();
  const health = HEALTH_STYLES[club.healthStatus] || HEALTH_STYLES["green"];
  const foundingSpotsLeft = (club.foundingTotal ?? 20) - (club.foundingTaken ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div
        className="overflow-visible transition-all hover-elevate cursor-pointer"
        style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderRadius: "18px" }}
        data-testid={`card-club-${club.id}`}
        onClick={() => navigate(`/club/${club.id}`)}
      >
        <div className="p-5 pb-0 flex justify-between items-start">
          <div
            className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-[26px]"
            style={{ background: CATEGORY_GRADIENTS[club.category] || club.bgColor || "var(--warm-white)" }}
          >
            {club.emoji}
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${health.bg} ${health.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
            {club.healthLabel}
          </div>
        </div>

        <div className="p-5 pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1.5" style={{ color: "var(--muted-warm)" }}>
            {club.category}
          </div>
          <h3
            className="font-display text-xl font-bold tracking-tight leading-tight mb-2"
            style={{ color: "var(--ink)" }}
            data-testid={`text-club-name-${club.id}`}
          >
            {club.name}
          </h3>
          <p
            className="text-[13px] leading-relaxed mb-4 line-clamp-2"
            style={{ color: "var(--muted-warm)" }}
            data-testid={`text-club-desc-${club.id}`}
          >
            {club.shortDesc}
          </p>

          {foundingSpotsLeft > 0 && (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-4" style={{ color: "var(--gold)", background: "var(--gold-pale)", border: "1px solid rgba(201,168,76,0.3)" }}>
              <Star className="w-3 h-3" />
              {foundingSpotsLeft} Founding spots left
            </div>
          )}

          {club.recentJoins != null && club.recentJoins > 0 && (
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-4"
              style={{ color: "var(--terra)", background: "var(--terra-pale)", border: "1px solid rgba(196,98,45,0.2)" }}
              data-testid={`badge-recent-joins-${club.id}`}
            >
              {club.recentJoins} joined this week
            </div>
          )}

          <div className="flex items-center flex-wrap gap-2 mb-4">
            <Badge variant="secondary" data-testid={`badge-members-${club.id}`}>
              <Users className="w-3 h-3 mr-1" />
              <span style={{ color: "var(--terra)", fontWeight: 700 }}>{club.memberCount}</span> members
            </Badge>
            {club.lastActive && (
              <Badge variant="outline" data-testid={`badge-activity-${club.id}`}>
                <Clock className="w-3 h-3 mr-1" />
                {club.lastActive}
              </Badge>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-xs pt-3.5 mb-4" style={{ borderTop: "1px solid var(--warm-border)", color: "var(--muted-warm)" }}>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {club.schedule}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {club.location}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex-1 rounded-[10px] py-2.5 text-[13px] font-semibold transition-all"
              style={{ background: "var(--terra)", color: "white" }}
              data-testid={`button-view-club-${club.id}`}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/club/${club.id}`);
              }}
            >
              View Club
            </button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => shareClub(club, e)}
              data-testid={`button-share-club-${club.id}`}
            >
              <Share2 className="w-4 h-4" />
            </Button>
            {club.whatsappNumber && (
              <a
                href={`https://wa.me/${club.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-[42px] h-[42px] rounded-[10px] text-lg flex items-center justify-center shrink-0 transition-all"
                style={{ background: "var(--green-accent)", color: "white" }}
                data-testid={`button-chat-club-${club.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
