import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin } from "@/hooks/use-login";

export function OrganizerSection() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { login } = useLogin();

  function handleCreateClub() {
    if (user) {
      navigate("/create");
    } else {
      login("/create");
    }
  }

  return (
    <section id="organizer" className="py-16 sm:py-20">
      <div className="max-w-[900px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="rounded-2xl px-6 py-16 sm:px-12 sm:py-20 text-center"
          style={{ background: "var(--ink)", borderRadius: "24px" }}
        >
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-[1.1] mb-4 text-white">
            Got a hobby tribe?{" "}
            <em className="italic" style={{ color: "var(--terra-light)" }}>Bring them here.</em>
          </h2>
          <p className="text-[15px] sm:text-base leading-relaxed max-w-[520px] mx-auto mb-10" style={{ color: "rgba(255,255,255,0.6)" }}>
            Create your club page, manage members, host events — all free.
          </p>
          <button
            onClick={handleCreateClub}
            className="inline-block rounded-full px-9 py-4 text-[15px] font-semibold transition-all"
            style={{
              background: "var(--terra)",
              color: "white",
              boxShadow: "0 4px 24px rgba(196,98,45,0.3)",
            }}
            data-testid="button-create-club-cta"
          >
            Create My Club →
          </button>
        </motion.div>
      </div>
    </section>
  );
}
