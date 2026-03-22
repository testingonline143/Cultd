import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail, Lock, User as UserIcon, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const returnTo = new URLSearchParams(window.location.search).get("returnTo") || "/";

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate(returnTo === "/login" ? "/" : returnTo);
    }
  }, [isAuthenticated, authLoading, navigate, returnTo]);

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast({ title: "Enter your email first", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      toast({ title: "Failed to send reset email", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        if (!firstName) throw new Error("Please enter your first name");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: `${firstName} ${lastName}`.trim() } },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Welcome to CultFam. You're now signed in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "You've successfully signed in." });
      }
    } catch (err: any) {
      toast({
        title: isSignUp ? "Sign Up Failed" : "Sign In Failed",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" style={{ color: "var(--terra)" }} />
      </div>
    );
  }

  function renderForgotForm() {
    if (forgotSent) {
      return (
        <div className="text-center space-y-4 py-4">
          <CheckCircle2 className="w-14 h-14 mx-auto" style={{ color: "var(--terra)" }} />
          <h2 className="font-display text-xl font-bold text-foreground">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            We sent a reset link to <strong>{email}</strong>. Click it to set a new password.
          </p>
          <button
            onClick={() => { setIsForgot(false); setForgotSent(false); }}
            className="text-sm font-bold underline underline-offset-4"
            style={{ color: "var(--terra)" }}
          >
            Back to Sign In
          </button>
        </div>
      );
    }
    return (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <p className="text-sm text-muted-foreground -mt-2 mb-2">
          Enter your email and we'll send a reset link.
        </p>
        <div className="space-y-1 pb-4">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Mail className="w-4 h-4 text-muted-foreground" />
            </div>
            <input
              required
              type="email"
              className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
              style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-forgot-email"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-xl text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center disabled:opacity-70"
          style={{ background: "var(--terra)" }}
          data-testid="button-send-reset"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
        </button>
        <button
          type="button"
          onClick={() => setIsForgot(false)}
          className="w-full text-sm text-center text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to Sign In
        </button>
      </form>
    );
  }

  function renderSignInForm() {
    return (
      <>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
                  First Name
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <input
                    required
                    type="text"
                    className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                    style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                    placeholder="Bruce"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
                  Last Name
                </label>
                <input
                  type="text"
                  className="w-full h-12 px-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                  style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                  placeholder="Wayne (Optional)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1 block">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Mail className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                required
                type="email"
                className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1 pb-4">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-xs font-semibold underline underline-offset-2 transition-colors"
                  style={{ color: "var(--terra)" }}
                  data-testid="link-forgot-password"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
              <input
                required
                minLength={6}
                type="password"
                className="w-full h-12 pl-11 pr-4 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-all placeholder:text-muted-foreground/50"
                style={{ borderColor: "var(--warm-border)", background: "var(--cream)", color: "var(--ink)" }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center disabled:opacity-70 disabled:hover:scale-100"
            style={{ background: "var(--terra)" }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          {isSignUp ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => setIsSignUp(false)}
                className="font-bold underline underline-offset-4 decoration-2 cursor-pointer transition-colors"
                style={{ color: "var(--terra)", textDecorationColor: "rgba(196,98,45,0.3)" }}
              >
                Sign in
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => setIsSignUp(true)}
                className="font-bold underline underline-offset-4 decoration-2 cursor-pointer transition-colors"
                style={{ color: "var(--terra)", textDecorationColor: "rgba(196,98,45,0.3)" }}
              >
                Sign up
              </button>
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-4 py-12 relative">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-20" style={{ background: "var(--terra)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-20" style={{ background: "var(--gold)" }} />
      </div>

      <div className="w-full max-w-md mx-auto relative z-10">
        <button
          onClick={() => navigate("/")}
          className="mb-8 w-10 h-10 rounded-full glass-card flex items-center justify-center hover:bg-black/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <div className="glass-card rounded-[2rem] p-8 md:p-10 shadow-2xl" style={{ borderColor: "rgba(196,98,45,0.1)" }}>
          <div className="mb-8 text-center">
            <h1 className="font-display text-4xl font-black tracking-tight mb-2" style={{ color: "var(--ink)" }}>
              {isForgot ? "Reset Password" : isSignUp ? "Join the Tribe" : "Welcome Back"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isForgot
                ? "We'll email you a link to reset your password."
                : isSignUp
                ? "Create an account to discover your next hobby."
                : "Enter your credentials to access your account."}
            </p>
          </div>

          {isForgot ? renderForgotForm() : renderSignInForm()}
        </div>
      </div>
    </div>
  );
}
