import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { IndianRupee, ArrowLeft, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import type { PlatformTransaction } from "@shared/schema";

type EarningsTx = PlatformTransaction & { eventTitle: string; ticketTypeName?: string };

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; icon: typeof CheckCircle2 }> = {
    transferred: { bg: "bg-green-50 border-green-200", color: "text-green-700", icon: CheckCircle2 },
    pending:     { bg: "bg-amber-50 border-amber-200", color: "text-amber-700", icon: Clock },
    failed:      { bg: "bg-red-50 border-red-200", color: "text-red-700", icon: XCircle },
  };
  const s = styles[status] ?? { bg: "bg-gray-50 border-gray-200", color: "text-gray-600", icon: Clock };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.bg} ${s.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function EarningsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const clubId = params.get("club") ?? "";

  const [statusFilter, setStatusFilter] = useState<"all" | "transferred" | "pending" | "failed">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery<{
    transactions: EarningsTx[];
    total: number;
    totalTransferred: number;
    totalPending: number;
    totalFailed: number;
  }>({
    queryKey: ["/api/organizer/clubs", clubId, "earnings/all", statusFilter, page],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== "all") p.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/earnings/all?${p}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!clubId,
  });

  const { data: summary } = useQuery<{ totalTransferred: number; totalPending: number; totalFailed: number }>({
    queryKey: ["/api/organizer/clubs", clubId, "earnings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/earnings`);
      return res.json();
    },
    enabled: !!clubId,
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;
  const transactions = data?.transactions ?? [];

  const totalBase = transactions.reduce((s, t) => s + t.baseAmount, 0);
  const totalFee = transactions.reduce((s, t) => s + t.platformFee, 0);

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate("/organizer")}
            className="p-2 rounded-xl"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
            data-testid="button-back-earnings"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--ink)" }} />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>Earnings History</h1>
            <p className="text-xs" style={{ color: "var(--muted-warm)" }}>Full transaction record</p>
          </div>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3 text-center" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }} data-testid="stat-transferred">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle2 className="w-3 h-3 text-green-600" />
                <span className="text-[10px] font-bold text-green-700">Transferred</span>
              </div>
              <div className="font-bold text-green-800 text-sm">{fmt(summary.totalTransferred)}</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: summary.totalPending > 0 ? "rgba(245,158,11,0.06)" : "var(--warm-white)", border: `1px solid ${summary.totalPending > 0 ? "rgba(245,158,11,0.25)" : "var(--warm-border)"}` }} data-testid="stat-pending">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Clock className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] font-bold text-amber-700">Pending</span>
              </div>
              <div className="font-bold text-amber-800 text-sm">{fmt(summary.totalPending)}</div>
            </div>
            <div className="rounded-2xl p-3 text-center" style={{ background: summary.totalFailed > 0 ? "rgba(220,38,38,0.05)" : "var(--warm-white)", border: `1px solid ${summary.totalFailed > 0 ? "rgba(220,38,38,0.2)" : "var(--warm-border)"}` }} data-testid="stat-failed">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <XCircle className="w-3 h-3 text-red-600" />
                <span className="text-[10px] font-bold text-red-700">Failed</span>
              </div>
              <div className="font-bold text-red-700 text-sm">{fmt(summary.totalFailed)}</div>
              {summary.totalFailed > 0 && <div className="text-[9px] text-red-600">Contact admin</div>}
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="section-status-filters">
          {(["all", "transferred", "pending", "failed"] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
              style={statusFilter === s
                ? { background: "var(--terra)", color: "white" }
                : { background: "var(--warm-white)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }}
              data-testid={`filter-${s}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {data && ` (${s === "all" ? data.total : "-"})`}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-xl ml-auto shrink-0"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--terra)" }} />
          </button>
        </div>

        {/* Transactions table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="empty-transactions">
            <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--terra)" }} />
            <p className="text-sm" style={{ color: "var(--muted-warm)" }}>
              {statusFilter === "all" ? "No transactions yet." : `No ${statusFilter} transactions.`}
            </p>
          </div>
        ) : (
          <div className="rounded-[18px] overflow-hidden" style={{ border: "1.5px solid var(--warm-border)" }} data-testid="section-transaction-history">
            {/* Column headers */}
            <div className="grid px-3 py-2 text-[9px] font-bold uppercase tracking-wider" style={{ background: "var(--cream)", color: "var(--muted-warm)", gridTemplateColumns: "1fr auto auto auto" }}>
              <span>Event / Date</span>
              <span className="text-right pr-2">Total Paid</span>
              <span className="text-right pr-2">You Receive</span>
              <span>Status</span>
            </div>

            {/* Summary row */}
            <div className="grid px-3 py-2 text-[10px] font-bold" style={{ gridTemplateColumns: "1fr auto auto auto", background: "rgba(196,98,45,0.05)", borderTop: "1px solid var(--warm-border)", borderBottom: "1px solid var(--warm-border)" }} data-testid="row-summary">
              <span style={{ color: "var(--muted-warm)" }}>{transactions.length} transactions shown</span>
              <span className="text-right pr-2" style={{ color: "var(--muted-warm)" }}>{fmt(totalBase + totalFee)}</span>
              <span className="text-right pr-2 font-bold" style={{ color: "var(--ink)" }}>{fmt(totalBase)}</span>
              <span></span>
            </div>

            {transactions.map((tx, i) => (
              <div
                key={tx.id}
                className="grid items-center px-3 py-3"
                style={{ gridTemplateColumns: "1fr auto auto auto", borderTop: "1px solid var(--warm-border)", background: i % 2 === 0 ? "var(--warm-white)" : "var(--cream)" }}
                data-testid={`tx-row-${tx.id}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>{tx.eventTitle || "Event"}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-warm)" }}>
                    {new Date(tx.createdAt!).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {tx.ticketTypeName && <span> · {tx.ticketTypeName}</span>}
                  </div>
                </div>
                <div className="text-right pr-2">
                  <div className="text-xs font-bold" style={{ color: "var(--muted-warm)" }}>{fmt(tx.totalAmount)}</div>
                  <div className="text-[9px]" style={{ color: "var(--terra)" }}>fee: {fmt(tx.platformFee)}</div>
                </div>
                <div className="text-right pr-2 font-bold text-xs" style={{ color: "var(--ink)" }}>
                  {fmt(tx.baseAmount)}
                </div>
                <div>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2" data-testid="section-pagination">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
              style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="button-prev-page"
            >
              ← Previous
            </button>
            <span className="text-xs" style={{ color: "var(--muted-warm)" }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
              style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", color: "var(--ink)" }}
              data-testid="button-next-page"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
