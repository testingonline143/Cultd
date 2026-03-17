import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { HOBBY_ICONS } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

const AVAILABILITY_OPTIONS = [
  { value: "early_morning", label: "Early Morning", emoji: "🌅" },
  { value: "evening", label: "Evening", emoji: "🌆" },
  { value: "weekends", label: "Weekends", emoji: "📅" },
];

const VIBE_OPTIONS = [
  { value: "casual", label: "Chill", emoji: "😌", desc: "Relaxed pace, just for fun" },
  { value: "moderate", label: "Moderate", emoji: "⚡", desc: "Regular commitment" },
  { value: "competitive", label: "Intense", emoji: "🔥", desc: "It's part of my identity" },
];

const EXPERIENCE_LEVELS = [
  { value: "beginner", label: "Beginner", emoji: "🌱", desc: "Just getting started" },
  { value: "intermediate", label: "Intermediate", emoji: "🌿", desc: "Some experience" },
  { value: "passionate", label: "Passionate", emoji: "🌳", desc: "Very experienced" },
];

const USER_TYPES = [
  { value: "student", label: "Student", emoji: "🎓", desc: "Currently studying" },
  { value: "working", label: "Working Professional", emoji: "💼", desc: "In the workforce" },
  { value: "other", label: "Other", emoji: "🌟", desc: "Freelancer, homemaker, etc." },
];

export default function Onboarding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [interests, setInterests] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [vibePreference, setVibePreference] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [userType, setUserType] = useState("");
  const [showLoading, setShowLoading] = useState(false);

  const totalSteps = 5;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("User must be logged in to save onboarding Data");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session found");

      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          interests,
          experienceLevel,
          vibePreference,
          availability,
          collegeOrWork: userType || null,
          city: user.city || "",
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/matched-clubs");
    },
    onError: () => {
      setShowLoading(false);
    },
  });

  const toggleInterest = (name: string) => {
    setInterests((prev) => {
      if (prev.includes(name)) return prev.filter((i) => i !== name);
      if (prev.length >= 3) {
        toast({ title: "You can select up to 3 interests", description: "Deselect one to choose another" });
        return prev;
      }
      return [...prev, name];
    });
  };

  const toggleAvailability = (value: string) => {
    setAvailability((prev) =>
      prev.includes(value) ? prev.filter((a) => a !== value) : [...prev, value]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1: return interests.length >= 1;
      case 2: return availability.length >= 1;
      case 3: return !!vibePreference;
      case 4: return !!experienceLevel;
      case 5: return !!userType;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      setShowLoading(true);
      setTimeout(() => {
        saveMutation.mutate();
      }, 1500);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  if (!user) {
    navigate("/");
    return null;
  }

  if (showLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: 'var(--terra)' }} />
          <h2 className="font-display text-xl font-bold" style={{ color: 'var(--terra)' }} data-testid="text-loading-matches">
            Finding your tribe{user.city ? ` in ${user.city}` : ""}...
          </h2>
          <p className="text-sm text-muted-foreground mt-2">Matching you with the best clubs</p>
        </motion.div>
      </div>
    );
  }

  const stepTitles = [
    "What are you into?",
    "When are you free?",
    "Your energy vibe?",
    "Experience level?",
    "I am a...",
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="w-full max-w-lg mx-auto px-4 py-6 flex-1 flex flex-col">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h1 className="font-display text-lg font-bold" style={{ color: 'var(--terra)' }} data-testid="text-quiz-title">
              {stepTitles[step - 1]}
            </h1>
            <span className="text-xs text-muted-foreground" data-testid="text-quiz-step">
              Step {step} of {totalSteps}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5" data-testid="progress-bar">
            <motion.div
              className="h-2.5 rounded-full"
              style={{ background: 'var(--terra)', boxShadow: 'var(--warm-shadow2)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -50, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {step === 1 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">Pick 1 to 3 hobbies you love</p>
                  <div className="grid grid-cols-3 gap-3">
                    {HOBBY_ICONS.map((hobby) => {
                      const selected = interests.includes(hobby.name);
                      return (
                        <button
                          key={hobby.name}
                          onClick={() => toggleInterest(hobby.name)}
                          className={`flex flex-col items-center p-3.5 rounded-xl border transition-all ${selected ? "glass-card" : "glass-card glass-card-hover"}`}
                          style={selected ? { borderColor: 'var(--terra)', background: 'var(--terra-pale)', boxShadow: 'var(--warm-shadow2)' } : undefined}
                          data-testid={`hobby-${hobby.name.toLowerCase()}`}
                        >
                          <span className="text-2xl mb-1">{hobby.emoji}</span>
                          <span className={`text-xs font-medium ${selected ? "" : "text-foreground"}`} style={selected ? { color: 'var(--terra)' } : undefined}>{hobby.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">{interests.length}/3 selected</p>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">Select all time slots that work for you</p>
                  <div className="space-y-3">
                    {AVAILABILITY_OPTIONS.map((slot) => {
                      const selected = availability.includes(slot.value);
                      return (
                        <button
                          key={slot.value}
                          onClick={() => toggleAvailability(slot.value)}
                          className={`w-full flex items-center p-5 rounded-xl border transition-all text-left ${selected ? "glass-card" : "glass-card glass-card-hover"}`}
                          style={selected ? { borderColor: 'var(--terra)', background: 'var(--terra-pale)', boxShadow: 'var(--warm-shadow2)' } : undefined}
                          data-testid={`availability-${slot.value}`}
                        >
                          <span className="text-3xl mr-4">{slot.emoji}</span>
                          <span className={`font-semibold text-lg ${selected ? "" : "text-foreground"}`} style={selected ? { color: 'var(--terra)' } : undefined}>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">How do you like your activities?</p>
                  <div className="grid grid-cols-3 gap-3">
                    {VIBE_OPTIONS.map((vibe) => {
                      const selected = vibePreference === vibe.value;
                      return (
                        <button
                          key={vibe.value}
                          onClick={() => setVibePreference(vibe.value)}
                          className={`flex flex-col items-center p-5 rounded-xl border transition-all text-center ${selected ? "glass-card" : "glass-card glass-card-hover"}`}
                          style={selected ? { borderColor: 'var(--terra)', background: 'var(--terra-pale)', boxShadow: 'var(--warm-shadow2)' } : undefined}
                          data-testid={`vibe-${vibe.value}`}
                        >
                          <span className="text-4xl mb-2">{vibe.emoji}</span>
                          <span className={`font-semibold text-sm ${selected ? "" : "text-foreground"}`} style={selected ? { color: 'var(--terra)' } : undefined}>{vibe.label}</span>
                          <p className={`text-xs mt-1 ${selected ? "" : "text-muted-foreground"}`} style={selected ? { color: 'var(--terra)', opacity: 0.7 } : undefined}>{vibe.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">This helps us match you with the right crowd</p>
                  <div className="space-y-3">
                    {EXPERIENCE_LEVELS.map((level) => {
                      const selected = experienceLevel === level.value;
                      return (
                        <button
                          key={level.value}
                          onClick={() => setExperienceLevel(level.value)}
                          className={`w-full flex items-center p-5 rounded-xl border transition-all text-left ${selected ? "glass-card" : "glass-card glass-card-hover"}`}
                          style={selected ? { borderColor: 'var(--terra)', background: 'var(--terra-pale)', boxShadow: 'var(--warm-shadow2)' } : undefined}
                          data-testid={`experience-${level.value}`}
                        >
                          <span className="text-3xl mr-4">{level.emoji}</span>
                          <div>
                            <span className={`font-semibold ${selected ? "" : "text-foreground"}`} style={selected ? { color: 'var(--terra)' } : undefined}>{level.label}</span>
                            <p className={`text-xs ${selected ? "" : "text-muted-foreground"}`} style={selected ? { color: 'var(--terra)', opacity: 0.7 } : undefined}>{level.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">Tell us a bit about yourself</p>
                  <div className="space-y-3">
                    {USER_TYPES.map((type) => {
                      const selected = userType === type.value;
                      return (
                        <button
                          key={type.value}
                          onClick={() => setUserType(type.value)}
                          className={`w-full flex items-center p-5 rounded-xl border transition-all text-left ${selected ? "glass-card" : "glass-card glass-card-hover"}`}
                          style={selected ? { borderColor: 'var(--terra)', background: 'var(--terra-pale)', boxShadow: 'var(--warm-shadow2)' } : undefined}
                          data-testid={`usertype-${type.value}`}
                        >
                          <span className="text-3xl mr-4">{type.emoji}</span>
                          <div>
                            <span className={`font-semibold ${selected ? "" : "text-foreground"}`} style={selected ? { color: 'var(--terra)' } : undefined}>{type.label}</span>
                            <p className={`text-xs ${selected ? "" : "text-muted-foreground"}`} style={selected ? { color: 'var(--terra)', opacity: 0.7 } : undefined}>{type.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-2 pt-6 border-t border-border mt-6">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              data-testid="button-quiz-back"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || saveMutation.isPending}
            className="flex items-center gap-1 text-white px-6 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--terra)', boxShadow: 'var(--warm-shadow)' }}
            data-testid="button-quiz-next"
          >
            {step === totalSteps ? "Find My Clubs" : "Next"}
            {step < totalSteps && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4"
          data-testid="button-skip-quiz"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
