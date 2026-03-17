import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Mountain, BookOpen, Bike, Camera, Dumbbell, Palette, Music, Gamepad2, ChefHat, MapPin } from "lucide-react";
import { CITIES } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@/hooks/use-login";

const FLOATING_ICONS = [
  { Icon: Mountain, label: "Trekking" },
  { Icon: BookOpen, label: "Books" },
  { Icon: Bike, label: "Cycling" },
  { Icon: Camera, label: "Photography" },
  { Icon: Dumbbell, label: "Fitness" },
  { Icon: Palette, label: "Art" },
  { Icon: Music, label: "Music" },
  { Icon: Gamepad2, label: "Gaming" },
  { Icon: ChefHat, label: "Cooking" },
];

const ICON_POSITIONS = [
  { top: "8%", left: "5%", size: 28, delay: 0 },
  { top: "15%", right: "8%", size: 32, delay: 0.5 },
  { top: "35%", left: "3%", size: 24, delay: 1.2 },
  { top: "55%", right: "5%", size: 30, delay: 0.8 },
  { top: "70%", left: "8%", size: 26, delay: 1.5 },
  { top: "25%", right: "15%", size: 22, delay: 0.3 },
  { top: "80%", right: "12%", size: 28, delay: 1.0 },
  { top: "45%", left: "12%", size: 20, delay: 1.8 },
  { top: "65%", right: "18%", size: 24, delay: 0.6 },
];

export function HeroSection() {
  const [, navigate] = useLocation();
  const [cityIndex, setCityIndex] = useState(0);
  const { user } = useAuth();
  const { login } = useLogin();

  useEffect(() => {
    const interval = setInterval(() => {
      setCityIndex((prev) => (prev + 1) % CITIES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  function handleExploreClubs() {
    if (user) {
      if (!user.quizCompleted) {
        navigate("/onboarding");
      } else {
        navigate("/explore");
      }
    } else {
      sessionStorage.setItem("redirectAfterAuth", "/onboarding");
      login("/onboarding");
    }
  }

  function handleStartClub() {
    if (user) {
      navigate("/create");
    } else {
      login("/create");
    }
  }

  return (
    <section
      id="hero"
      className="relative min-h-[92vh] flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden"
      style={{
        background: "linear-gradient(165deg, var(--ink) 0%, var(--ink2) 40%, var(--terra2) 100%)",
      }}
    >
      {FLOATING_ICONS.map((item, i) => {
        const pos = ICON_POSITIONS[i];
        if (!pos) return null;
        return (
          <motion.div
            key={item.label}
            className="absolute pointer-events-none"
            style={{
              top: pos.top,
              left: "left" in pos ? pos.left : undefined,
              right: "right" in pos ? pos.right : undefined,
              opacity: 0.12,
            }}
            animate={{
              y: [0, -12, 0, 8, 0],
            }}
            transition={{
              duration: 6 + i * 0.5,
              repeat: Infinity,
              delay: pos.delay,
              ease: "easeInOut",
            }}
          >
            <item.Icon
              style={{ width: pos.size, height: pos.size, color: "rgba(255,255,255,0.6)" }}
              strokeWidth={1.5}
            />
          </motion.div>
        );
      })}

      <div className="relative z-10 text-center max-w-[800px] mx-auto">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="font-display font-black leading-[0.95] tracking-tight mb-6"
          style={{
            fontSize: "clamp(40px, 8vw, 80px)",
            letterSpacing: "-2px",
            color: "#FFFFFF",
          }}
          data-testid="text-hero-headline"
        >
          Your city's hobby scene.{" "}
          <em style={{ color: "var(--terra-light)", fontStyle: "italic" }}>
            All in one place.
          </em>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="max-w-[480px] mx-auto mb-10 leading-relaxed"
          style={{
            fontSize: "clamp(16px, 2.2vw, 20px)",
            color: "rgba(255,255,255,0.65)",
          }}
          data-testid="text-hero-subheadline"
        >
          Discover clubs, join meetups, find your people.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
        >
          <button
            onClick={handleExploreClubs}
            className="rounded-full px-10 py-4 text-base font-bold transition-all"
            style={{
              background: "var(--terra)",
              color: "white",
              boxShadow: "0 4px 24px rgba(196,98,45,0.4)",
            }}
            data-testid="button-explore-clubs"
          >
            Explore Clubs &rarr;
          </button>
          <button
            onClick={handleStartClub}
            className="rounded-full px-8 py-4 text-sm font-medium transition-all"
            style={{
              background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.85)",
            }}
            data-testid="button-start-club"
          >
            Start a Club
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex flex-wrap items-center justify-center gap-2"
        >
          {CITIES.slice(0, 6).map((city, i) => (
            <span
              key={city}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide"
              style={{
                background: cityIndex === i ? "rgba(196,98,45,0.25)" : "rgba(255,255,255,0.08)",
                color: cityIndex === i ? "var(--terra-light)" : "rgba(255,255,255,0.45)",
                border: "1px solid",
                borderColor: cityIndex === i ? "rgba(196,98,45,0.3)" : "rgba(255,255,255,0.08)",
                transition: "all 0.4s ease",
              }}
              data-testid={`pill-city-${city.toLowerCase()}`}
            >
              <MapPin style={{ width: 10, height: 10 }} />
              {city}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
