import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { CategoryShowcase } from "@/components/activity-ticker";
import { ClubsSection } from "@/components/clubs-section";
import { ProcessSection } from "@/components/process-section";
import { OrganizerSection } from "@/components/organizer-section";
import { Footer } from "@/components/footer";
import type { Club } from "@shared/schema";

interface ClubsPage {
  clubs: (Club & { recentJoins?: number })[];
  total: number;
}

export default function Home() {
  const { data, isLoading } = useQuery<ClubsPage>({
    queryKey: ["/api/clubs-with-activity"],
    queryFn: async () => {
      const res = await fetch("/api/clubs-with-activity?limit=200");
      if (!res.ok) throw new Error("Failed to fetch clubs");
      return res.json();
    },
  });
  const clubs = data?.clubs ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--cream)" }}>
      <Navbar />
      <HeroSection />
      <CategoryShowcase />
      <ClubsSection clubs={clubs} isLoading={isLoading} />
      <ProcessSection />
      <OrganizerSection />
      <Footer />
    </div>
  );
}
