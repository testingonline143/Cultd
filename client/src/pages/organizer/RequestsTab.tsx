import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, X, Loader2, Clock3, CheckCircle2, XCircle, UserMinus, Download, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import type { Club, JoinRequest } from "@shared/schema";

export default function RequestsTab({ clubId, club }: { clubId: string; club: Club }) {
  const [viewFilter, setViewFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  const { data: requests = [], isLoading } = useQuery<JoinRequest[]>({
    queryKey: ["/api/organizer/join-requests", clubId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/join-requests/${clubId}`);
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/organizer/join-requests/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/join-requests", clubId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/organizer/join-requests/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/join-requests", clubId] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("DELETE", `/api/organizer/clubs/${clubId}/members/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/join-requests", clubId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
      ))}
    </div>
  );

  const pending = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected");

  const filteredRequests = viewFilter === "all" ? requests
    : viewFilter === "pending" ? pending
    : viewFilter === "approved" ? approved
    : rejected;

  const filterOptions = [
    { key: "pending" as const, label: "Pending", count: pending.length },
    { key: "approved" as const, label: "Members", count: approved.length },
    { key: "rejected" as const, label: "Rejected", count: rejected.length },
    { key: "all" as const, label: "All", count: requests.length },
  ];

  const handleDownloadMembers = () => {
    const members = requests.filter(r => r.status === "approved");
    if (members.length === 0) return;
    const header = "Name,Phone,Join Date";
    const rows = members.map(m => {
      const name = `"${(m.name || "").replace(/"/g, '""')}"`;
      const phone = `"${(m.phone || "").replace(/"/g, '""')}"`;
      const joinDate = m.createdAt ? new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
      return `${name},${phone},${joinDate}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "members.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="list-organizer-requests">
      <div className="flex gap-2 overflow-x-auto flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setViewFilter(opt.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
              viewFilter === opt.key
                ? "bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]"
                : "bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"
            }`}
            style={{ borderRadius: 14 }}
            data-testid={`filter-requests-${opt.key}`}
          >
            {opt.label}
            <span className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold ${
              viewFilter === opt.key ? "bg-[var(--terra)] text-white" : "bg-muted text-muted-foreground"
            }`}>
              {opt.count}
            </span>
          </button>
        ))}
        {viewFilter === "approved" && approved.length > 0 && (
          <button
            onClick={handleDownloadMembers}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap inline-flex items-center gap-1.5 bg-[var(--terra)] text-white ml-auto"
            style={{ borderRadius: 14 }}
            data-testid="button-download-members"
          >
            <Download className="w-3 h-3" />
            Download CSV
          </button>
        )}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-requests">
          {viewFilter === "pending" ? "No pending requests" : viewFilter === "approved" ? "No approved members yet" : viewFilter === "rejected" ? "No rejected requests" : "No join requests yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)]"
              style={{ borderRadius: 18 }}
              data-testid={`row-request-${req.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground" data-testid={`text-request-name-${req.id}`}>{req.name}</span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        req.status === "pending"
                          ? "bg-chart-4/15 text-chart-4"
                          : req.status === "approved"
                          ? "bg-[var(--green-accent)]/15 text-[var(--green-accent)]"
                          : "bg-destructive/15 text-destructive"
                      }`}
                      data-testid={`badge-status-${req.id}`}
                    >
                      {req.status === "pending" && <Clock3 className="w-2.5 h-2.5" />}
                      {req.status === "approved" && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {req.status === "rejected" && <XCircle className="w-2.5 h-2.5" />}
                      {req.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{req.phone}</div>
                  <div className="text-xs text-muted-foreground">
                    {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </div>
                  {(req as any).answer1 && (
                    <div className="mt-2">
                      <button
                        onClick={() => {
                          const next = new Set(expandedAnswers);
                          if (next.has(req.id)) { next.delete(req.id); } else { next.add(req.id); }
                          setExpandedAnswers(next);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--terra)] transition-colors"
                        data-testid={`button-toggle-answers-${req.id}`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {expandedAnswers.has(req.id) ? "Hide answers" : "View answers"}
                        {expandedAnswers.has(req.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      {expandedAnswers.has(req.id) && (
                        <div className="mt-2 space-y-2 p-2.5 rounded-lg" style={{ background: "var(--terra-pale)", border: "1px solid rgba(196,98,45,0.2)" }}>
                          {club.joinQuestion1 && (
                            <div>
                              <div className="text-[10px] font-bold text-[var(--terra)] uppercase tracking-wider">{club.joinQuestion1}</div>
                              <div className="text-xs text-[var(--ink)] mt-0.5">{(req as any).answer1}</div>
                            </div>
                          )}
                          {club.joinQuestion2 && (req as any).answer2 && (
                            <div>
                              <div className="text-[10px] font-bold text-[var(--terra)] uppercase tracking-wider">{club.joinQuestion2}</div>
                              <div className="text-xs text-[var(--ink)] mt-0.5">{(req as any).answer2}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {req.status === "pending" && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--green-accent)]/15 text-[var(--green-accent)] transition-all whitespace-nowrap inline-flex items-center gap-1"
                        data-testid={`button-approve-${req.id}`}
                      >
                        {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(req.id)}
                        disabled={rejectMutation.isPending}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-destructive/10 text-destructive transition-all whitespace-nowrap inline-flex items-center gap-1"
                        data-testid={`button-reject-${req.id}`}
                      >
                        {rejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                        Reject
                      </button>
                    </>
                  )}
                  {req.status === "approved" && (
                    <button
                      onClick={() => {
                        if (confirm("Remove this member from the club?")) {
                          removeMemberMutation.mutate(req.id);
                        }
                      }}
                      disabled={removeMemberMutation.isPending}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md bg-destructive/10 text-destructive transition-all whitespace-nowrap inline-flex items-center gap-1"
                      data-testid={`button-remove-member-${req.id}`}
                    >
                      {removeMemberMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
