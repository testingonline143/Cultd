import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@/hooks/use-login";
import { Link, useLocation } from "wouter";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { login } = useLogin();

  function handleListClub() {
    if (isAuthenticated) {
      navigate("/create");
    } else {
      login("/create");
    }
  }

  const displayName = user?.firstName || user?.email || "User";

  useEffect(() => {
    const handleScroll = () => {
      const heroEl = document.getElementById("hero");
      if (heroEl) {
        const heroBottom = heroEl.offsetTop + heroEl.offsetHeight;
        setScrolled(window.scrollY > heroBottom - 80);
      } else {
        setScrolled(window.scrollY > 100);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navBg = scrolled
    ? "rgba(245,240,232,0.95)"
    : "transparent";
  const navBorder = scrolled
    ? "var(--warm-border)"
    : "transparent";
  const textColor = scrolled ? "var(--ink)" : "#FFFFFF";
  const mutedColor = scrolled ? "var(--muted-warm)" : "rgba(255,255,255,0.7)";
  const pillBg = scrolled ? "var(--terra-pale)" : "rgba(255,255,255,0.1)";
  const pillColor = scrolled ? "var(--muted-warm)" : "rgba(255,255,255,0.8)";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: navBg,
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: `1px solid ${navBorder}`,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 h-16">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2"
              data-testid="link-home"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--terra)" }} />
              <span className="text-xl font-display font-black tracking-tight transition-colors duration-300" style={{ color: textColor }}>CultFam</span>
            </Link>
            <button
              onClick={() => isAuthenticated ? navigate("/explore") : login("/explore")}
              className="hidden sm:flex items-center gap-1 text-sm transition-colors duration-300 bg-transparent border-0 cursor-pointer"
              style={{ color: mutedColor }}
              data-testid="link-explore"
            >
              <Compass className="w-4 h-4" />
              Explore
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="hidden sm:inline-flex text-[11px] font-semibold tracking-widest uppercase px-3 py-1 rounded-full transition-colors duration-300"
              style={{ color: pillColor, background: pillBg }}
            >
              {user?.city || "Tirupati"}
            </span>
            {isAuthenticated ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href="/profile"
                  className="text-sm font-medium transition-colors duration-300"
                  style={{ color: textColor }}
                  data-testid="link-profile"
                >
                  {displayName}
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs"
                  onClick={() => logout()}
                  data-testid="button-sign-out"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full hidden sm:inline-flex"
                onClick={() => login("/home")}
                data-testid="button-sign-in"
              >
                Sign In
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-full hidden sm:inline-flex"
              onClick={handleListClub}
              data-testid="button-list-club-nav"
            >
              List Your Club
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" style={{ color: textColor }} /> : <Menu className="w-5 h-5" style={{ color: textColor }} />}
            </Button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t"
            style={{ background: "rgba(245,240,232,0.95)", backdropFilter: "blur(16px)", borderColor: "var(--warm-border)" }}
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              <button
                className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 bg-transparent border-0 cursor-pointer w-full text-left"
                style={{ color: "var(--ink)" }}
                onClick={() => { isAuthenticated ? navigate("/explore") : login("/explore"); setMobileOpen(false); }}
                data-testid="link-explore-mobile"
              >
                <Compass className="w-4 h-4" />
                Explore Clubs
              </button>
              {isAuthenticated ? (
                <div className="flex flex-col gap-1 mt-2">
                  <Link href="/profile" className="text-sm font-medium transition-colors px-3 py-1.5" style={{ color: "var(--ink)" }} data-testid="link-profile-mobile" onClick={() => setMobileOpen(false)}>
                    My Profile ({displayName})
                  </Link>
                  {user && !user.quizCompleted && (
                    <Link href="/onboarding" className="text-sm font-medium px-3 py-1.5" style={{ color: "var(--terra)" }} data-testid="link-quiz-mobile" onClick={() => setMobileOpen(false)}>
                      Take Quiz
                    </Link>
                  )}
                  <Button size="sm" variant="outline" className="rounded-full text-xs self-start" onClick={() => logout()} data-testid="button-sign-out-mobile">
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => { login("/home"); setMobileOpen(false); }} data-testid="button-sign-in-mobile">
                  Sign In
                </Button>
              )}
              <Button
                size="sm"
                className="mt-2 rounded-full"
                onClick={() => { handleListClub(); setMobileOpen(false); }}
                data-testid="button-list-club-mobile"
              >
                List Your Club
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
