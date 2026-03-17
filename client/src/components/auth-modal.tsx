import { useState } from "react";
import { X, Eye, EyeOff } from "lucide-react";

interface AuthModalProps {
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, name: string) => Promise<void>;
}

export function AuthModal({ onClose, onSignIn, onSignUp }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (mode === "signin") {
        await onSignIn(email, password);
      } else {
        if (!name.trim()) {
          setError("Please enter your name");
          setIsLoading(false);
          return;
        }
        await onSignUp(email, password, name);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "var(--cream, #faf9f6)" }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: "var(--ink, #1a1a1a)" }}
        >
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold mb-1" style={{ color: "var(--ink, #1a1a1a)" }}>
            {mode === "signin" ? "Welcome back" : "Join the community"}
          </h2>
          <p className="text-sm opacity-60" style={{ color: "var(--ink, #1a1a1a)" }}>
            {mode === "signin" ? "Sign in to your account" : "Create your free account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold mb-1 opacity-70" style={{ color: "var(--ink, #1a1a1a)" }}>
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="What should we call you?"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 transition-all"
                style={{
                  background: "white",
                  borderColor: "rgba(0,0,0,0.12)",
                  color: "var(--ink, #1a1a1a)",
                }}
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-70" style={{ color: "var(--ink, #1a1a1a)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 transition-all"
              style={{
                background: "white",
                borderColor: "rgba(0,0,0,0.12)",
                color: "var(--ink, #1a1a1a)",
              }}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-70" style={{ color: "var(--ink, #1a1a1a)" }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                className="w-full rounded-xl border px-4 py-3 pr-10 text-sm outline-none focus:ring-2 transition-all"
                style={{
                  background: "white",
                  borderColor: "rgba(0,0,0,0.12)",
                  color: "var(--ink, #1a1a1a)",
                }}
                required
                minLength={mode === "signup" ? 6 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-70"
                style={{ color: "var(--ink, #1a1a1a)" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--terra, #c2714f)" }}
          >
            {isLoading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(null); }}
            className="text-xs opacity-60 hover:opacity-100 transition-opacity underline"
            style={{ color: "var(--ink, #1a1a1a)" }}
          >
            {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
