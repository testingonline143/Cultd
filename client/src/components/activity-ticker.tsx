import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CATEGORIES, CATEGORY_EMOJI } from "@shared/schema";
import type { Club } from "@shared/schema";

interface ClubsPage {
  clubs: Club[];
  total: number;
}

export function CategoryShowcase() {
  const [, navigate] = useLocation();

  const { data } = useQuery<ClubsPage>({
    queryKey: ["/api/clubs-with-activity"],
    queryFn: async () => {
      const res = await fetch("/api/clubs-with-activity?limit=200");
      if (!res.ok) throw new Error("Failed to fetch clubs");
      return res.json();
    },
  });

  const clubs = data?.clubs ?? [];

  const categoryCounts: Record<string, number> = {};
  for (const club of clubs) {
    categoryCounts[club.category] = (categoryCounts[club.category] || 0) + 1;
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  return (
    <section
      data-testid="section-category-showcase"
      className="py-16 px-4 sm:px-6"
      style={{ background: "var(--warm-white)" }}
    >
      <div className="max-w-5xl mx-auto">
        <h2
          data-testid="text-category-heading"
          className="font-display text-3xl sm:text-4xl font-bold text-center mb-10"
          style={{ color: "var(--ink)" }}
        >
          What's your thing?
        </h2>

        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
          {CATEGORIES.filter((cat) => (categoryCounts[cat] || 0) > 0).map((cat) => (
            <motion.button
              key={cat}
              variants={cardVariants}
              data-testid={`card-category-${cat.toLowerCase()}`}
              onClick={() => navigate(`/explore?category=${encodeURIComponent(cat)}`)}
              className="flex flex-col items-center gap-2 rounded-md p-5 sm:p-6 cursor-pointer transition-colors hover-elevate active-elevate-2"
              style={{
                background: "var(--cream)",
                border: "1.5px solid var(--warm-border)",
              }}
            >
              <span className="text-4xl sm:text-5xl leading-none">{CATEGORY_EMOJI[cat]}</span>
              <span
                className="font-semibold text-sm sm:text-base"
                style={{ color: "var(--ink)" }}
              >
                {cat}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function ActivityTicker() {
  return <CategoryShowcase />;
}
