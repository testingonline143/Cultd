import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, CheckCheck, Calendar, Users, Star, Info, CheckCircle, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

const TYPE_ICONS: Record<string, typeof Bell> = {
  join_approved: Users,
  join_rejected: Users,
  new_event: Calendar,
  club_update: Star,
  rsvp_confirmed: CheckCircle,
  waitlist_promoted: ArrowUpCircle,
};

function getIcon(type: string) {
  return TYPE_ICONS[type] || Info;
}

function timeAgo(dateStr: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const [, navigate] = useLocation();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
    }
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div
      className="min-h-screen pb-24"
      style={{ background: "var(--bg-warm)" }}
    >
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" style={{ color: "var(--terra)" }} />
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--ink)" }}
              data-testid="text-notifications-title"
            >
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                className="text-xs font-semibold rounded-full px-2 py-0.5"
                style={{
                  background: "var(--terra)",
                  color: "#fff",
                }}
                data-testid="text-unread-count"
              >
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark All Read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-16" data-testid="text-no-notifications">
            <div className="text-5xl mb-4">🔔</div>
            <h3
              className="text-lg font-semibold mb-1"
              style={{ color: "var(--ink)", fontFamily: "var(--font-body, Outfit, sans-serif)" }}
            >
              All caught up!
            </h3>
            <p
              className="text-sm mb-5"
              style={{ color: "var(--muted-warm)", fontFamily: "var(--font-body, Outfit, sans-serif)" }}
            >
              Notifications about events, approvals, and kudos will show up here.
            </p>
            <a
              href="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: "var(--terra)" }}
            >
              Explore Clubs
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = getIcon(notification.type);
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className="w-full text-left rounded-md p-3 transition-colors"
                  style={{
                    background: notification.isRead
                      ? "transparent"
                      : "rgba(var(--terra-rgb, 183,107,72), 0.06)",
                    borderLeft: notification.isRead
                      ? "3px solid transparent"
                      : "3px solid var(--terra)",
                  }}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                      style={{
                        background: notification.isRead
                          ? "var(--muted-warm-bg, rgba(0,0,0,0.05))"
                          : "rgba(var(--terra-rgb, 183,107,72), 0.15)",
                      }}
                    >
                      <Icon
                        className="w-4 h-4"
                        style={{
                          color: notification.isRead
                            ? "var(--muted-warm)"
                            : "var(--terra)",
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{
                          color: "var(--ink)",
                          opacity: notification.isRead ? 0.7 : 1,
                        }}
                        data-testid={`text-notification-title-${notification.id}`}
                      >
                        {notification.title}
                      </p>
                      <p
                        className="text-xs mt-0.5 line-clamp-2"
                        style={{
                          color: "var(--muted-warm)",
                        }}
                        data-testid={`text-notification-message-${notification.id}`}
                      >
                        {notification.message}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{
                          color: "var(--muted-warm)",
                          opacity: 0.7,
                        }}
                      >
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: "var(--terra)" }}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
