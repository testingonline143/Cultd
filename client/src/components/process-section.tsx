import { motion } from "framer-motion";
import { Compass, UserPlus, MapPin } from "lucide-react";

const STEPS = [
  { num: "01", icon: Compass, title: "Browse", description: "Find clubs and events in your city" },
  { num: "02", icon: UserPlus, title: "Join", description: "Request to join — organizers approve within 24hrs" },
  { num: "03", icon: MapPin, title: "Show Up", description: "Attend meetups, meet your people" },
];

export function ProcessSection() {
  return (
    <section id="process" className="py-16 sm:py-20" style={{ background: "var(--cream)" }}>
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold tracking-[2px] uppercase mb-3" style={{ color: "var(--terra)" }}>
            <span className="w-5 h-px" style={{ background: "var(--terra)" }} />
            How It Works
            <span className="w-5 h-px" style={{ background: "var(--terra)" }} />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-[1.1]" style={{ color: "var(--ink)" }}>
            Three steps. That's it.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
                className="text-center p-8 rounded-2xl hover-elevate"
                style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", borderRadius: "18px" }}
                data-testid={`card-step-${step.num}`}
              >
                <div className="font-mono text-5xl leading-none mb-5" style={{ color: "rgba(26,20,16,0.08)", letterSpacing: "1px" }}>{step.num}</div>
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: "var(--terra-pale)" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--terra)" }} />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "var(--ink)" }}>{step.title}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: "var(--muted-warm)" }}>{step.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
