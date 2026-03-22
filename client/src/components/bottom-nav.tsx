import { useState } from "react";
import { useLocation } from "wouter";
import { Home, Users, Calendar, User, Plus, X, PenLine } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Drawer } from "vaul";
import { Link } from "wouter";

const HIDDEN_PATHS = ["/login", "/onboarding", "/scan", "/matched-clubs", "/admin", "/reset-password"];

function getActiveTab(location: string): string {
  if (location === "/home" || location.startsWith("/home/")) return "/home";
  if (location.startsWith("/explore") || location.startsWith("/club/") || location.startsWith("/c/")) return "/explore";
  if (location.startsWith("/events") || location.startsWith("/event/")) return "/events";
  if (location.startsWith("/profile") || location.startsWith("/member/") || location.startsWith("/my-payments")) return "/profile";
  if (location.startsWith("/organizer") || location.startsWith("/create")) return "/organizer";
  if (location.startsWith("/notifications")) return "/notifications";
  return location;
}

export function BottomNav() {
  const [location, navigate] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const isHidden =
    !isAuthenticated ||
    location === "/" ||
    HIDDEN_PATHS.some((p) => location === p || location.startsWith(p + "/"));

  if (isHidden) return null;

  const isOrganiser = user?.role === "organiser" || user?.role === "admin";
  const isCreator = isOrganiser;
  const activeTab = getActiveTab(location);

  const leftTabs = [
    { path: "/explore", label: "CLUBS", icon: Users },
    { path: "/events", label: "EVENTS", icon: Calendar },
  ];

  const rightTabs = [
    { path: "/home", label: "FEED", icon: Home },
    { path: "/profile", label: "PROFILE", icon: User },
  ];

  const renderTab = (tab: { path: string; label: string; icon: React.ElementType }, key: string) => {
    const isActive = activeTab === tab.path;
    const Icon = tab.icon;
    return (
      <button
        key={key}
        onClick={() => navigate(tab.path)}
        className="flex flex-col items-center gap-1 px-3 py-1 transition-colors relative flex-1"
        data-testid={`tab-${tab.label.toLowerCase()}`}
      >
        <div
          className="flex items-center justify-center rounded-full transition-all"
          style={{
            width: isActive ? 44 : 28,
            height: 28,
            background: isActive ? "rgba(196,98,45,0.12)" : "transparent",
          }}
        >
          <Icon
            className={isActive ? "w-6 h-6" : "w-5 h-5"}
            style={{ opacity: isActive ? 1 : 0.45, color: isActive ? "var(--terra)" : "var(--ink)" }}
          />
        </div>
        <span
          className="font-bold tracking-wider uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.6px",
            color: isActive ? "var(--terra)" : "var(--muted-warm)",
          }}
        >
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "rgba(245,240,232,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        data-testid="nav-bottom"
      >
        <div className="flex items-center h-16 max-w-lg mx-auto px-2">
          {leftTabs.map((tab) => renderTab(tab, tab.path))}

          {isCreator && (
            <div className="flex flex-col items-center flex-1 relative" style={{ minWidth: 56 }}>
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                style={{
                  background: "var(--terra)",
                  position: "absolute",
                  bottom: -4,
                  boxShadow: "0 4px 20px rgba(196,98,45,0.45)",
                }}
                data-testid="button-fab"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            </div>
          )}

          {rightTabs.map((tab) => renderTab(tab, tab.path))}
        </div>
      </nav>

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay
            className="fixed inset-0 z-50"
            style={{ background: "rgba(26,20,16,0.5)", backdropFilter: "blur(2px)" }}
          />
          <Drawer.Content
            className="fixed bottom-0 left-0 right-0 z-50 outline-none"
            style={{ maxWidth: 480, margin: "0 auto" }}
            data-testid="drawer-fab-actions"
          >
            <div
              className="rounded-t-[24px] px-5 pt-3 pb-10"
              style={{ background: "var(--warm-white)", borderTop: "1.5px solid var(--warm-border)" }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--warm-border)" }} />
              </div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-xl" style={{ color: "var(--ink)" }}>Create</h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "var(--cream2)" }}
                  data-testid="button-close-drawer"
                >
                  <X className="w-4 h-4" style={{ color: "var(--ink)" }} />
                </button>
              </div>
              <div className="space-y-3">
                <Link
                  href="/create?tab=club"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-4 p-4 rounded-[16px] transition-colors active:scale-[0.98]"
                  style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                  data-testid="action-create-club"
                >
                  <div
                    className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                    style={{ background: "var(--terra-pale)" }}
                  >
                    <Users className="w-5 h-5" style={{ color: "var(--terra)" }} />
                  </div>
                  <div>
                    <p className="font-bold text-[15px]" style={{ color: "var(--ink)" }}>Create Club</p>
                    <p className="text-[12px]" style={{ color: "var(--muted-warm)" }}>Start your own community</p>
                  </div>
                </Link>

                {isOrganiser && (
                  <Link
                    href="/create?tab=event"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-[16px] transition-colors active:scale-[0.98]"
                    style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                    data-testid="action-create-event"
                  >
                    <div
                      className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{ background: "rgba(201,168,76,0.12)" }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: "var(--gold)" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px]" style={{ color: "var(--ink)" }}>Create Event</p>
                      <p className="text-[12px]" style={{ color: "var(--muted-warm)" }}>Schedule a meetup or activity</p>
                    </div>
                  </Link>
                )}

                {isOrganiser && (
                  <Link
                    href="/organizer?tab=content"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-[16px] transition-colors active:scale-[0.98]"
                    style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                    data-testid="action-create-post"
                  >
                    <div
                      className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0"
                      style={{ background: "rgba(61,107,69,0.1)" }}
                    >
                      <PenLine className="w-5 h-5" style={{ color: "var(--green-accent)" }} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px]" style={{ color: "var(--ink)" }}>Create Post</p>
                      <p className="text-[12px]" style={{ color: "var(--muted-warm)" }}>Share a moment with your club</p>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
