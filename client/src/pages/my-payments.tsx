import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, IndianRupee, CheckCircle2, Clock, XCircle, Ticket } from "lucide-react";

interface UserPayment {
  id: string;
  eventId: string;
  eventTitle: string;
  clubName: string;
  ticketTypeName: string | null;
  razorpayPaymentId: string;
  totalAmount: number;
  baseAmount: number;
  platformFee: number;
  currency: string;
  status: string;
  createdAt: string;
}

function fmt(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "transferred") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200" data-testid="badge-paid">
        <CheckCircle2 className="w-2.5 h-2.5" /> Paid
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" data-testid="badge-pending">
        <Clock className="w-2.5 h-2.5" /> Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200" data-testid="badge-failed">
      <XCircle className="w-2.5 h-2.5" /> Failed
    </span>
  );
}

export default function MyPayments() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const { data: payments = [], isLoading } = useQuery<UserPayment[]>({
    queryKey: ["/api/user/payments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/user/payments");
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <div className="max-w-lg mx-auto px-4 pt-5 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: "var(--ink)" }} />
          </button>
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>My Payments</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="empty-payments">
            <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-25" style={{ color: "var(--terra)" }} />
            <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>No payments yet</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-warm)" }}>Your ticket purchases will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="section-payments-list">
            {payments.map(payment => (
              <div
                key={payment.id}
                className="rounded-2xl p-4"
                style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}
                data-testid={`payment-${payment.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate" style={{ color: "var(--ink)" }} data-testid={`payment-event-${payment.id}`}>
                      {payment.eventTitle}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--muted-warm)" }}>
                      {payment.clubName} · {new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    {payment.ticketTypeName && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)" }} data-testid={`payment-ticket-type-${payment.id}`}>
                        <Ticket className="w-2.5 h-2.5" />
                        {payment.ticketTypeName}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold" style={{ color: "var(--ink)" }} data-testid={`payment-amount-${payment.id}`}>
                      {fmt(payment.totalAmount)}
                    </div>
                    <StatusBadge status={payment.status} />
                  </div>
                </div>

                <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--cream)" }}>
                  <div className="flex justify-between text-xs" style={{ color: "var(--muted-warm)" }}>
                    <span>Ticket price</span>
                    <span data-testid={`payment-base-${payment.id}`}>{fmt(payment.baseAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "var(--muted-warm)" }}>
                    <span>Platform fee</span>
                    <span data-testid={`payment-fee-${payment.id}`}>{fmt(payment.platformFee)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold pt-1" style={{ borderTop: "1px solid var(--warm-border)", color: "var(--ink)" }}>
                    <span>Total paid</span>
                    <span>{fmt(payment.totalAmount)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <Ticket className="w-3 h-3" style={{ color: "var(--muted-warm)" }} />
                  <span className="text-[11px] font-mono" style={{ color: "var(--muted-warm)" }} data-testid={`payment-id-${payment.id}`}>
                    {payment.razorpayPaymentId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
