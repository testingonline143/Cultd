import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, TrendingUp, Clock, CheckCircle2, XCircle, ChevronDown, Save, RefreshCw, Banknote, Smartphone, AlertCircle, ExternalLink } from "lucide-react";
import type { Club } from "@shared/schema";

interface EarningsSummary {
  totalTransferred: number;
  totalPending: number;
  totalFailed: number;
  recentTransactions: EarningTransaction[];
}

interface EarningTransaction {
  id: string;
  eventId: string;
  eventTitle?: string;
  totalAmount: number;
  baseAmount: number;
  platformFee: number;
  status: string;
  createdAt: string;
  razorpayPaymentId: string;
  razorpayTransferId?: string | null;
}

interface PayoutSetup {
  payoutsEnabled: boolean;
  payoutMethod: string;
  bankAccountName?: string | null;
  maskedAccountNumber?: string | null;
  maskedIfsc?: string | null;
  maskedUpiId?: string | null;
  payoutConfigured: boolean;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    transferred: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    transferred: "Transferred",
    pending: "Pending",
    failed: "Failed",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function EarningsTab({ club }: { club: Club }) {
  const { toast } = useToast();
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "upi">("bank");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiId, setUpiId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "transferred" | "pending" | "failed">("all");

  const { data: earnings, isLoading: earningsLoading } = useQuery<EarningsSummary>({
    queryKey: ["/api/organizer/clubs", club.id, "earnings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/earnings`);
      if (!res.ok) throw new Error("Failed to fetch earnings");
      return res.json();
    },
  });

  const { data: payoutSetup, isLoading: setupLoading } = useQuery<PayoutSetup>({
    queryKey: ["/api/organizer/clubs", club.id, "payout-setup"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/payout-setup`);
      if (!res.ok) throw new Error("Failed to fetch payout setup");
      return res.json();
    },
  });

  const savePayoutMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { payoutMethod };
      if (payoutMethod === "bank") {
        Object.assign(body, { bankAccountName, bankAccountNumber, bankIfsc });
      } else {
        Object.assign(body, { upiId });
      }
      const res = await apiRequest("POST", `/api/organizer/clubs/${club.id}/payout-setup`, body);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to save" }));
        throw new Error(data.message || "Failed to save payout details");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", club.id, "payout-setup"] });
      setShowPayoutForm(false);
      setBankAccountName(""); setBankAccountNumber(""); setBankIfsc(""); setUpiId("");
      toast({ title: "Payout details saved!", description: "Your payout will be processed after each event." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const hasPending = (earnings?.totalPending ?? 0) > 0 || (earnings?.totalFailed ?? 0) > 0;

  return (
    <div className="space-y-4" data-testid="section-earnings">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-bold text-[var(--ink)]">Earnings</h2>
        {payoutSetup && !payoutSetup.payoutConfigured && (
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Payout not set up
          </span>
        )}
      </div>

      {earningsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="stat-transferred">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">Transferred</div>
            </div>
            <div className="font-display text-xl font-black text-green-700">{fmt(earnings?.totalTransferred ?? 0)}</div>
            <div className="text-[10px] text-[var(--muted-warm)] mt-0.5">paid to you</div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: hasPending ? "rgba(245,158,11,0.06)" : "var(--warm-white)", border: `1.5px solid ${hasPending ? "rgba(245,158,11,0.3)" : "var(--warm-border)"}` }} data-testid="stat-pending">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-warm)]">Pending</div>
            </div>
            <div className="font-display text-xl font-black text-amber-700">{fmt(earnings?.totalPending ?? 0)}</div>
            {(earnings?.totalFailed ?? 0) > 0 && (
              <div className="text-[10px] text-red-600 font-semibold mt-0.5">{fmt(earnings!.totalFailed)} failed</div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="section-payout-setup">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-sm font-bold text-[var(--ink)]">Payout Account</span>
          </div>
          {payoutSetup?.payoutConfigured && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Active</span>
          )}
        </div>

        {setupLoading ? (
          <div className="h-12 animate-pulse rounded-xl" style={{ background: "var(--cream)" }} />
        ) : payoutSetup?.payoutConfigured ? (
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm">
              {payoutSetup.payoutMethod === "upi" ? (
                <><Smartphone className="w-4 h-4 text-[var(--muted-warm)]" /><span className="text-[var(--ink3)]">UPI: <span className="font-mono font-semibold">{payoutSetup.maskedUpiId ?? "••••"}</span></span></>
              ) : (
                <><Banknote className="w-4 h-4 text-[var(--muted-warm)]" /><span className="text-[var(--ink3)]">{payoutSetup.bankAccountName} · <span className="font-mono">{payoutSetup.maskedAccountNumber}</span></span></>
              )}
            </div>
            {payoutSetup.payoutMethod === "bank" && payoutSetup.maskedIfsc && (
              <div className="text-xs text-[var(--muted-warm)]">IFSC: {payoutSetup.maskedIfsc}</div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-warm)] mb-3">Add your bank account or UPI to receive payouts after each paid event.</p>
        )}

        {!showPayoutForm ? (
          <button
            onClick={() => {
              setPayoutMethod(payoutSetup?.payoutMethod as "bank" | "upi" ?? "bank");
              setShowPayoutForm(true);
            }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-[var(--terra)] transition-all"
            style={{ background: "var(--terra-pale)", border: "1.5px solid rgba(196,98,45,0.3)" }}
            data-testid="button-edit-payout"
          >
            {payoutSetup?.payoutConfigured ? "Update Payout Details" : "Set Up Payout"}
          </button>
        ) : (
          <div className="space-y-3 mt-2">
            <div className="flex rounded-xl overflow-hidden border-[1.5px] border-[var(--warm-border)]">
              <button
                onClick={() => setPayoutMethod("bank")}
                className={`flex-1 py-2 text-xs font-bold transition-all ${payoutMethod === "bank" ? "bg-[var(--terra)] text-white" : "bg-[var(--cream)] text-[var(--muted-warm)]"}`}
                data-testid="button-payout-bank"
              >Bank Account</button>
              <button
                onClick={() => setPayoutMethod("upi")}
                className={`flex-1 py-2 text-xs font-bold transition-all ${payoutMethod === "upi" ? "bg-[var(--terra)] text-white" : "bg-[var(--cream)] text-[var(--muted-warm)]"}`}
                data-testid="button-payout-upi"
              >UPI</button>
            </div>

            {payoutMethod === "bank" ? (
              <>
                <input
                  value={bankAccountName}
                  onChange={e => setBankAccountName(e.target.value)}
                  placeholder="Account holder name"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30"
                  data-testid="input-bank-account-name"
                />
                <input
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  placeholder="Bank account number"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30"
                  data-testid="input-bank-account-number"
                />
                <input
                  value={bankIfsc}
                  onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                  placeholder="IFSC code (e.g. HDFC0001234)"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 font-mono"
                  data-testid="input-bank-ifsc"
                />
              </>
            ) : (
              <input
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="UPI ID (e.g. name@upi)"
                className="w-full px-3 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30"
                data-testid="input-upi-id"
              />
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowPayoutForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[var(--muted-warm)] border-[1.5px] border-[var(--warm-border)]"
                style={{ background: "var(--cream)" }}
                data-testid="button-cancel-payout-form"
              >
                Cancel
              </button>
              <button
                onClick={() => savePayoutMutation.mutate()}
                disabled={savePayoutMutation.isPending}
                className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "var(--ink)" }}
                data-testid="button-save-payout"
              >
                {savePayoutMutation.isPending ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Payout Details</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {earnings && (
        <div className="rounded-2xl" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="section-transaction-history">
          <div className="flex items-center justify-between p-4 pb-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">Transaction History</h3>
          </div>
          {/* Filter chips */}
          <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto" data-testid="section-status-filters">
            {(["all", "transferred", "pending", "failed"] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
                style={statusFilter === s
                  ? { background: "var(--terra)", color: "white" }
                  : { background: "var(--cream)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }}
                data-testid={`filter-${s}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {s === "all" && ` (${earnings.recentTransactions.length})`}
                {s === "transferred" && ` (${earnings.recentTransactions.filter(t => t.status === "transferred").length})`}
                {s === "pending" && ` (${earnings.recentTransactions.filter(t => t.status === "pending").length})`}
                {s === "failed" && ` (${earnings.recentTransactions.filter(t => t.status === "failed").length})`}
              </button>
            ))}
          </div>
          {/* Summary row */}
          {(() => {
            const filtered = earnings.recentTransactions.filter(t => statusFilter === "all" || t.status === statusFilter);
            const totalBase = filtered.reduce((sum, t) => sum + t.baseAmount, 0);
            const totalFee = filtered.reduce((sum, t) => sum + t.platformFee, 0);
            return (
              <>
                {filtered.length > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 text-[10px] font-bold" style={{ background: "var(--cream)", borderTop: "1px solid var(--warm-border)", borderBottom: "1px solid var(--warm-border)", color: "var(--muted-warm)" }}>
                    <span>{filtered.length} transactions</span>
                    <div className="flex items-center gap-3">
                      <span>Platform: {fmt(totalFee)}</span>
                      <span className="text-[var(--ink)]">You receive: {fmt(totalBase)}</span>
                    </div>
                  </div>
                )}
                {filtered.length === 0 ? (
                  <div className="p-8 text-center" data-testid="empty-transactions">
                    <IndianRupee className="w-8 h-8 text-[var(--muted-warm)] mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-[var(--muted-warm)]">{statusFilter === "all" ? "No paid tickets sold yet." : `No ${statusFilter} transactions.`}</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: "var(--warm-border)" }}>
                    {filtered.map((tx) => (
                      <div key={tx.id} className="flex items-start justify-between gap-2 px-4 py-3" data-testid={`tx-${tx.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[var(--ink)] truncate">{tx.eventTitle || "Event"}</div>
                          <div className="text-[10px] text-[var(--muted-warm)] mt-0.5">
                            {new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {" · "}
                            <span className="font-mono">{tx.razorpayPaymentId.slice(-6)}</span>
                          </div>
                          <StatusBadge status={tx.status} />
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-[var(--ink)]">{fmt(tx.baseAmount)}</div>
                          <div className="text-[10px] text-[var(--muted-warm)]">fee: {fmt(tx.platformFee)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {!earningsLoading && !earnings && (
        <div className="rounded-2xl p-6 text-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="empty-transactions">
          <IndianRupee className="w-8 h-8 text-[var(--muted-warm)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--muted-warm)]">No paid tickets sold yet.</p>
          <p className="text-xs text-[var(--muted-warm)] mt-1">Earnings will appear here when members book paid tickets.</p>
        </div>
      )}

      {!payoutSetup?.payoutConfigured && ((earnings?.totalTransferred ?? 0) + (earnings?.totalPending ?? 0)) > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.3)" }} data-testid="banner-setup-payout">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-amber-800 mb-0.5">Set up payout to receive money</div>
            <p className="text-xs text-amber-700">You have earnings pending. Add your bank account or UPI above to enable automatic transfers after each ticket sale.</p>
          </div>
        </div>
      )}
    </div>
  );
}
