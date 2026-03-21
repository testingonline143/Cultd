import { motion } from "framer-motion";
import { Users, MapPin, Clock, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Club } from "@shared/schema";

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div
        className="overflow-hidden transition-all cursor-pointer active:scale-[0.97] active:shadow-none card-native"
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
        </div>

        <div className="p-5 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: "var(--muted-warm)" }}>
            {club.category}
          </div>
          <h3
            className="font-display text-xl font-bold tracking-tight leading-tight mb-1.5"
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
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
              {club.location && (
                <Badge variant="outline">
                  <MapPin className="w-3 h-3 mr-1" />
                  {club.location}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
                  className="w-[38px] h-[38px] rounded-[10px] text-lg flex items-center justify-center shrink-0 transition-all"
                  style={{ background: "var(--green-accent)", color: "white" }}
                  data-testid={`button-chat-club-${club.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
