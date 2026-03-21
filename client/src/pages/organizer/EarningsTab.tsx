import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  IndianRupee, TrendingUp, Clock, CheckCircle2, XCircle,
  Save, RefreshCw, Banknote, Smartphone, AlertCircle,
  ArrowRight, Wallet, Sparkles, ChevronRight, Lock,
  ShieldCheck, CircleDot, X
} from "lucide-react";
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

function fmtShort(paise: number) {
  const val = paise / 100;
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toFixed(0)}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    transferred: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Transferred" },
    pending:     { cls: "bg-amber-50 text-amber-700 border-amber-200",   label: "Pending" },
    failed:      { cls: "bg-red-50 text-red-700 border-red-200",         label: "Failed" },
  };
  const { cls, label } = cfg[status] ?? { cls: "bg-gray-50 text-gray-600 border-gray-200", label: status };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
  );
}

function StatCard({ label, value, sub, color, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between min-h-[90px] relative overflow-hidden"
      style={{ background: accent ?? "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] rounded-2xl"
        style={{ background: `radial-gradient(circle at top right, ${color}, transparent 70%)` }}
      />
      <div className="flex items-center gap-1.5 mb-2 relative">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-warm)" }}>{label}</span>
      </div>
      <div className="relative">
        <div className="font-display text-2xl font-black leading-none" style={{ color }}>{value}</div>
        {sub && <div className="text-[10px] mt-1" style={{ color: "var(--muted-warm)" }}>{sub}</div>}
      </div>
    </div>
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
  const [payoutSkipped, setPayoutSkipped] = useState(false);

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
      toast({ title: "Payout details saved!", description: "Your details are ready for when payouts go live." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const totalEarnings = (earnings?.totalTransferred ?? 0) + (earnings?.totalPending ?? 0);
  const filteredTxs = earnings?.recentTransactions.filter(t => statusFilter === "all" || t.status === statusFilter) ?? [];
  const totalBase = filteredTxs.reduce((s, t) => s + t.baseAmount, 0);
  const totalFee = filteredTxs.reduce((s, t) => s + t.platformFee, 0);
  const hasPending = (earnings?.totalPending ?? 0) > 0 || (earnings?.totalFailed ?? 0) > 0;
  const showSetupCta = !payoutSkipped && !payoutSetup?.payoutConfigured && !showPayoutForm;

  return (
    <div className="space-y-5" data-testid="section-earnings">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="rounded-[22px] p-5 relative overflow-hidden"
        style={{ background: "var(--ink)", border: "1.5px solid var(--ink2)" }}
        data-testid="section-earnings-hero"
      >
        {/* Background glow */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20"
          style={{ background: "var(--terra)", transform: "translate(30%, -30%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--terra-light)" }} />
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
              Your Earnings
            </span>
          </div>

          {earningsLoading ? (
            <div className="h-10 w-40 rounded-xl animate-pulse mt-1" style={{ background: "rgba(255,255,255,0.1)" }} />
          ) : (
            <div className="font-display text-4xl font-black text-white leading-none mt-1">
              {fmtShort(totalEarnings)}
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            {earningsLoading ? (
              <div className="h-4 w-48 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {fmt(earnings?.totalTransferred ?? 0)} transferred
                  </span>
                </div>
                {(earnings?.totalPending ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {fmt(earnings!.totalPending)} pending
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Payout status indicator inside hero */}
          <div
            className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: payoutSetup?.payoutConfigured ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)", border: `1px solid ${payoutSetup?.payoutConfigured ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.12)"}` }}
          >
            {setupLoading ? (
              <div className="h-4 w-36 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
            ) : payoutSetup?.payoutConfigured ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-emerald-300 font-semibold">
                  Payout account configured
                  {payoutSetup.payoutMethod === "upi"
                    ? ` · UPI: ${payoutSetup.maskedUpiId}`
                    : ` · ${payoutSetup.bankAccountName}`}
                </span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-amber-300 font-semibold">Payout account not set up yet</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      {earningsLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Transferred"
            value={fmt(earnings?.totalTransferred ?? 0)}
            sub="paid to your account"
            color="#16a34a"
            icon={CheckCircle2}
            accent={earnings?.totalTransferred ? "rgba(22,163,74,0.05)" : undefined}
          />
          <StatCard
            label="Pending"
            value={fmt(earnings?.totalPending ?? 0)}
            sub={(earnings?.totalFailed ?? 0) > 0 ? `${fmt(earnings!.totalFailed)} failed` : "in transit"}
            color={hasPending ? "#d97706" : "var(--muted-warm)"}
            icon={Clock}
            accent={hasPending ? "rgba(245,158,11,0.05)" : undefined}
          />
        </div>
      )}

      {/* ── Setup Wizard ─────────────────────────────────────────────────── */}
      <div
        className="rounded-[22px] overflow-hidden"
        style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
        data-testid="section-payout-setup"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--warm-border)" }}>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: payoutSetup?.payoutConfigured ? "rgba(22,163,74,0.12)" : "var(--terra-pale)" }}
            >
              <Banknote className="w-3.5 h-3.5" style={{ color: payoutSetup?.payoutConfigured ? "#16a34a" : "var(--terra)" }} />
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>Payout Account</span>
          </div>
          {payoutSetup?.payoutConfigured && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          )}
        </div>

        <div className="p-4">
          {/* Platform coming-soon notice */}
          <div
            className="flex items-start gap-2.5 p-3 rounded-xl mb-4"
            style={{ background: "rgba(196,98,45,0.06)", border: "1.5px solid rgba(196,98,45,0.15)" }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--terra)] shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-bold text-[var(--terra)] mb-0.5">Automatic payouts launching soon</div>
              <p className="text-[11px]" style={{ color: "var(--muted-warm)" }}>
                Save your details now so you're ready the moment payouts go live. Transfers happen automatically after each paid event.
              </p>
            </div>
          </div>

          {/* Existing account info */}
          {setupLoading ? (
            <div className="h-10 animate-pulse rounded-xl mb-3" style={{ background: "var(--cream)" }} />
          ) : payoutSetup?.payoutConfigured && !showPayoutForm ? (
            <div
              className="flex items-center gap-3 p-3 rounded-xl mb-3"
              style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.15)" }}
            >
              {payoutSetup.payoutMethod === "upi" ? (
                <>
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-emerald-800">UPI</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--muted-warm)" }}>{payoutSetup.maskedUpiId ?? "••••"}</div>
                  </div>
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-emerald-800 truncate">{payoutSetup.bankAccountName}</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--muted-warm)" }}>
                      {payoutSetup.maskedAccountNumber}{payoutSetup.maskedIfsc ? ` · ${payoutSetup.maskedIfsc}` : ""}
                    </div>
                  </div>
                </>
              )}
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto" />
            </div>
          ) : null}

          {/* Payout form */}
          {showPayoutForm ? (
            <div className="space-y-3" data-testid="form-payout-setup">
              {/* Method selector */}
              <div
                className="flex rounded-xl overflow-hidden"
                style={{ border: "1.5px solid var(--warm-border)" }}
              >
                <button
                  onClick={() => setPayoutMethod("bank")}
                  className="flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  style={payoutMethod === "bank"
                    ? { background: "var(--terra)", color: "white" }
                    : { background: "var(--cream)", color: "var(--muted-warm)" }}
                  data-testid="button-payout-bank"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Bank Account
                </button>
                <button
                  onClick={() => setPayoutMethod("upi")}
                  className="flex-1 py-2.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  style={payoutMethod === "upi"
                    ? { background: "var(--terra)", color: "white" }
                    : { background: "var(--cream)", color: "var(--muted-warm)" }}
                  data-testid="button-payout-upi"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  UPI
                </button>
              </div>

              {payoutMethod === "bank" ? (
                <div className="space-y-2.5">
                  <input
                    value={bankAccountName}
                    onChange={e => setBankAccountName(e.target.value)}
                    placeholder="Account holder full name"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra)]/20 transition-all"
                    data-testid="input-bank-account-name"
                  />
                  <input
                    value={bankAccountNumber}
                    onChange={e => setBankAccountNumber(e.target.value)}
                    placeholder="Bank account number"
                    type="tel"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra)]/20 transition-all"
                    data-testid="input-bank-account-number"
                  />
                  <input
                    value={bankIfsc}
                    onChange={e => setBankIfsc(e.target.value.toUpperCase())}
                    placeholder="IFSC code (e.g. HDFC0001234)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra)]/20 transition-all"
                    data-testid="input-bank-ifsc"
                  />
                </div>
              ) : (
                <input
                  value={upiId}
                  onChange={e => setUpiId(e.target.value)}
                  placeholder="UPI ID (e.g. name@upi)"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:border-[var(--terra)] focus:ring-2 focus:ring-[var(--terra)]/20 transition-all"
                  data-testid="input-upi-id"
                />
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowPayoutForm(false); }}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "var(--cream)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }}
                  data-testid="button-cancel-payout-form"
                >
                  Cancel
                </button>
                <button
                  onClick={() => savePayoutMutation.mutate()}
                  disabled={savePayoutMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  style={{ background: "var(--ink)", color: "white" }}
                  data-testid="button-save-payout"
                >
                  {savePayoutMutation.isPending
                    ? <><RefreshCw className="w-4 h-4 animate-spin" />Saving...</>
                    : <><Save className="w-4 h-4" />Save Details</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setPayoutMethod(payoutSetup?.payoutMethod as "bank" | "upi" ?? "bank");
                  setShowPayoutForm(true);
                  setPayoutSkipped(false);
                }}
                className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: "var(--terra)", color: "white" }}
                data-testid="button-edit-payout"
              >
                {payoutSetup?.payoutConfigured ? (
                  <><Banknote className="w-4 h-4" />Update Payout Details</>
                ) : (
                  <><Wallet className="w-4 h-4" />Set Up Payout Account</>
                )}
              </button>

              {/* Skip for now — only show if not configured and not already dismissed */}
              {!payoutSetup?.payoutConfigured && !payoutSkipped && (
                <button
                  onClick={() => setPayoutSkipped(true)}
                  className="w-full py-2 text-xs font-semibold transition-all rounded-xl"
                  style={{ color: "var(--muted-warm)" }}
                  data-testid="button-skip-payout"
                >
                  Skip for now
                </button>
              )}

              {/* Show subtle CTA if skipped */}
              {payoutSkipped && !payoutSetup?.payoutConfigured && (
                <button
                  onClick={() => setPayoutSkipped(false)}
                  className="w-full py-2 text-xs font-semibold text-[var(--terra)] underline underline-offset-2 transition-all"
                  data-testid="button-undo-skip-payout"
                >
                  Set up payout later ↩
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Pending alert ─────────────────────────────────────────────────── */}
      {!payoutSetup?.payoutConfigured && ((earnings?.totalTransferred ?? 0) + (earnings?.totalPending ?? 0)) > 0 && (
        <div
          className="rounded-[18px] p-4 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.06)", border: "1.5px solid rgba(245,158,11,0.3)" }}
          data-testid="banner-setup-payout"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-amber-800 mb-0.5">You have earnings — set up payout to receive them</div>
            <p className="text-xs text-amber-700">Add your bank account or UPI above to enable transfers when the payout system launches.</p>
          </div>
        </div>
      )}

      {/* ── Transaction History ───────────────────────────────────────────── */}
      {earnings && (
        <div
          className="rounded-[22px] overflow-hidden"
          style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
          data-testid="section-transaction-history"
        >
          {/* Section header */}
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid var(--warm-border)" }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--terra)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>Transaction History</h3>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "var(--cream)", color: "var(--muted-warm)" }}>
              {earnings.recentTransactions.length} total
            </span>
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto" data-testid="section-status-filters">
            {(["all", "transferred", "pending", "failed"] as const).map(s => {
              const count = s === "all"
                ? earnings.recentTransactions.length
                : earnings.recentTransactions.filter(t => t.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all"
                  style={statusFilter === s
                    ? { background: "var(--terra)", color: "white" }
                    : { background: "var(--cream)", color: "var(--muted-warm)", border: "1.5px solid var(--warm-border)" }}
                  data-testid={`filter-${s}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {/* Summary row */}
          {filteredTxs.length > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2 text-[10px] font-bold"
              style={{ background: "var(--cream)", borderTop: "1px solid var(--warm-border)", borderBottom: "1px solid var(--warm-border)", color: "var(--muted-warm)" }}
            >
              <span>{filteredTxs.length} transactions</span>
              <div className="flex items-center gap-3">
                <span>Platform fee: {fmt(totalFee)}</span>
                <span style={{ color: "var(--ink)" }}>You receive: {fmt(totalBase)}</span>
              </div>
            </div>
          )}

          {filteredTxs.length === 0 ? (
            <div className="p-10 text-center" data-testid="empty-transactions">
              <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--terra)" }} />
              <p className="text-sm" style={{ color: "var(--muted-warm)" }}>
                {statusFilter === "all" ? "No paid tickets sold yet." : `No ${statusFilter} transactions.`}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--warm-border)" }}>
              {filteredTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between gap-3 px-4 py-3.5"
                  data-testid={`tx-${tx.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink)" }}>
                      {tx.eventTitle || "Event"}
                    </div>
                    <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--muted-warm)" }}>
                      <span>{new Date(tx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <CircleDot className="w-2 h-2 opacity-40" />
                      <span className="font-mono">{tx.razorpayPaymentId.slice(-8)}</span>
                    </div>
                    <div className="mt-1.5">
                      <StatusBadge status={tx.status} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>{fmt(tx.baseAmount)}</div>
                    <div className="text-[10px]" style={{ color: "var(--muted-warm)" }}>fee: {fmt(tx.platformFee)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!earningsLoading && !earnings && (
        <div
          className="rounded-[22px] p-10 text-center"
          style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
          data-testid="empty-transactions"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "var(--terra-pale)" }}
          >
            <IndianRupee className="w-7 h-7" style={{ color: "var(--terra)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>No paid tickets sold yet</p>
          <p className="text-xs mt-1" style={{ color: "var(--muted-warm)" }}>
            Earnings will appear here when members book paid event tickets.
          </p>
        </div>
      )}
    </div>
  );
}
