import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12 relative">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-20" style={{ background: "var(--terra)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-20" style={{ background: "var(--gold)" }} />
      </div>

      <div className="w-full max-w-md mx-auto">
        <div className="glass-card rounded-[2rem] p-8 md:p-10 shadow-2xl" style={{ borderColor: "rgba(196,98,45,0.1)" }}>
          {done ? (
            <div className="text-center space-y-4 py-4">
              <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: "var(--terra)" }} />
              <h2 className="font-display text-2xl font-bold text-foreground">Password Updated!</h2>
              <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="font-display text-3xl font-black tracking-tight mb-2" style={{ color: "var(--ink)" }}>
                  Set New Password
                </h1>
                <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
              </div>

              {!sessionReady && (
                <p className="text-xs text-center text-muted-foreground mb-4 px-2 py-2 rounded-lg" style={{ background: "rgba(196,98,45,0.07)" }}>
                  Waiting for the reset link to be verified… If this takes too long, go back and request a new link.
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <input
                      required
                      type="password"
                      minLength={6}
                      placeholder="At least 6 characters"
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                      style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-new-password"
                    />
                  </div>
                </div>

                <div className="space-y-1 pb-4">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <input
                      required
                      type="password"
                      placeholder="Repeat password"
                      className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                      style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !sessionReady}
                  className="w-full h-12 rounded-xl text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:hover:scale-100"
                  style={{ background: "var(--terra)" }}
                  data-testid="button-update-password"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
