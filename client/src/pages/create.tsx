import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, useSearch } from "wouter";
import { CATEGORIES, CITIES } from "@shared/schema";
import type { Club } from "@shared/schema";
import { LogIn, Loader2, Type, AlignLeft, Tag, Repeat, Link, PartyPopper, CalendarPlus, LayoutDashboard, Image } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";

export default function Create() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialTab = params.get("tab") === "event" ? "event" : "club";
  const preselectedClubId = params.get("clubId") || "";
  const fromEventId = params.get("from") || "";

  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isOrganiser = user?.role === "organiser" || user?.role === "admin";
  const safeInitialTab = initialTab === "event" && !isOrganiser ? "club" : initialTab;
  const [activeTab, setActiveTab] = useState<"club" | "event">(safeInitialTab);
  const [createdClub, setCreatedClub] = useState<{ name: string; id: string } | null>(null);
  const [eventClubId, setEventClubId] = useState(preselectedClubId);

  useEffect(() => {
    if (!isOrganiser && activeTab === "event") {
      setActiveTab("club");
    }
    if (isOrganiser && initialTab === "event" && activeTab === "club") {
      setActiveTab("event");
    }
  }, [isOrganiser, activeTab, initialTab]);

  if (createdClub) {
    return (
      <div className="min-h-screen bg-background pb-24 px-4 pt-6">
        <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--terra-pale)' }}>
            <PartyPopper className="w-10 h-10" style={{ color: 'var(--terra)' }} />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground" data-testid="text-club-created-title">
            Your tribe is live!
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm" data-testid="text-club-created-name">
            <span className="font-semibold" style={{ color: 'var(--terra)' }}>{createdClub.name}</span> is now on the map. What would you like to do next?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <button
              onClick={() => {
                setEventClubId(createdClub.id);
                setCreatedClub(null);
                setActiveTab("event");
              }}
              className="flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-4 font-bold text-sm"
              style={{ background: 'var(--terra)', boxShadow: 'var(--warm-shadow)' }}
              data-testid="button-create-first-event"
            >
              <CalendarPlus className="w-5 h-5" />
              Create First Event
            </button>
            <button
              onClick={() => navigate("/organizer")}
              className="flex-1 flex items-center justify-center gap-2 glass-card rounded-xl py-4 font-bold text-sm text-foreground"
              data-testid="button-go-dashboard"
            >
              <LayoutDashboard className="w-5 h-5" />
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 px-4 pt-6">
      <div className="max-w-lg mx-auto">
        <h1 className="font-display italic text-3xl font-bold text-foreground mb-6" data-testid="text-create-title">
          Create
        </h1>

        {isOrganiser && (
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setActiveTab("club")}
              className={`rounded-full px-6 py-2 font-semibold transition-colors ${
                activeTab === "club"
                  ? "text-white"
                  : "glass-card text-muted-foreground"
              }`}
              style={activeTab === "club" ? { background: 'var(--terra)' } : undefined}
              data-testid="tab-new-club"
            >
              New Club
            </button>
            <button
              onClick={() => setActiveTab("event")}
              className={`rounded-full px-6 py-2 font-semibold transition-colors ${
                activeTab === "event"
                  ? "text-white"
                  : "glass-card text-muted-foreground"
              }`}
              style={activeTab === "event" ? { background: 'var(--terra)' } : undefined}
              data-testid="tab-new-event"
            >
              New Event
            </button>
          </div>
        )}

        {activeTab === "club" ? (
          isAuthenticated ? (
            <ClubForm onSuccess={(name, id) => setCreatedClub({ name, id })} />
          ) : (
            <SignInPrompt message="Sign in to create a club" />
          )
        ) : isAuthenticated ? (
          <EventForm preselectedClubId={eventClubId} fromEventId={fromEventId} />
        ) : (
          <SignInPrompt message="Sign in to create an event" />
        )}
      </div>
    </div>
  );
}

function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <LogIn className="w-10 h-10 mx-auto" style={{ color: 'var(--terra)' }} />
      <p className="text-sm text-muted-foreground" data-testid="text-sign-in-prompt">{message}</p>
      <button
        onClick={() => { window.location.href = "/login"; }}
        className="text-white rounded-xl px-8 py-3 text-sm font-semibold"
        style={{ background: 'var(--terra)' }}
        data-testid="button-sign-in-create"
      >
        Sign In
      </button>
    </div>
  );
}

function ClubForm({ onSuccess }: { onSuccess: (name: string, id: string) => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isOrganiser = user?.role === "organiser" || user?.role === "admin";

  const [clubName, setClubName] = useState("");
  const [fullDesc, setFullDesc] = useState("");
  const [category, setCategory] = useState("");
  const [schedule, setSchedule] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [organizerName, setOrganizerName] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("Tirupati");
  const [shortDesc, setShortDesc] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isOrganiser ? "/api/clubs/create" : "/api/club-proposals";
      
      const payload = isOrganiser ? {
        name: clubName,
        category,
        shortDesc,
        fullDesc,
        schedule,
        location,
        organizerName,
        whatsappNumber,
        city,
        coverImageUrl: coverImageUrl ?? undefined,
      } : {
        clubName: clubName,
        category,
        vibe: "casual",
        shortDesc: fullDesc || shortDesc,
        city,
        schedule,
        motivation: fullDesc || "I want to create this community", // Required field for proposals
      };

      const res = await apiRequest("POST", endpoint, payload);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to create club" }));
        throw new Error(data.message || "Failed to create club");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/my-club"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      if (!isOrganiser) {
        toast({ title: "Proposal Submitted!", description: "Your club proposal is pending admin approval." });
        navigate("/home");
      } else {
        toast({ title: "Success!", description: data.message || "Club created live!" });
        onSuccess(clubName, data.club?.id || "");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName || clubName.length < 3) {
      toast({ title: "Club name must be at least 3 characters", variant: "destructive" });
      return;
    }
    if (!category) {
      toast({ title: "Please select a category", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} label="Club Cover Photo" />

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          <Type className="w-3.5 h-3.5" />
          TRIBE NAME
        </label>
        <Input
          placeholder="e.g. Tirupati Trekking Club"
          className="glass-card rounded-xl"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          data-testid="input-club-name"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          <AlignLeft className="w-3.5 h-3.5" />
          DESCRIPTION
        </label>
        <textarea
          placeholder="What is this tribe about?"
          rows={4}
          className="w-full px-3 py-2 glass-card rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          value={fullDesc}
          onChange={(e) => setFullDesc(e.target.value)}
          data-testid="input-full-desc"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            <Tag className="w-3.5 h-3.5" />
            CATEGORY
          </label>
          <Select onValueChange={setCategory} value={category}>
            <SelectTrigger className="glass-card rounded-xl" data-testid="select-category">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            <Repeat className="w-3.5 h-3.5" />
            FREQUENCY
          </label>
          <Input
            placeholder="Weekly"
            className="glass-card rounded-xl"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            data-testid="input-schedule"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          <Link className="w-3.5 h-3.5" />
          WHATSAPP LINK
        </label>
        <Input
          placeholder="https://chat.whatsapp.com/..."
          className="glass-card rounded-xl"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          data-testid="input-whatsapp"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          ORGANIZER NAME
        </label>
        <Input
          placeholder="Your name"
          className="glass-card rounded-xl"
          value={organizerName}
          onChange={(e) => setOrganizerName(e.target.value)}
          data-testid="input-organizer-name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            LOCATION
          </label>
          <Input
            placeholder="e.g. SV University"
            className="glass-card rounded-xl"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            data-testid="input-location"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            CITY
          </label>
          <Select onValueChange={setCity} value={city}>
            <SelectTrigger className="glass-card rounded-xl" data-testid="select-city">
              <SelectValue placeholder="Select City" />
            </SelectTrigger>
            <SelectContent>
              {CITIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          SHORT DESCRIPTION
        </label>
        <Input
          placeholder="One-liner about your club"
          className="glass-card rounded-xl"
          value={shortDesc}
          onChange={(e) => setShortDesc(e.target.value)}
          data-testid="input-short-desc"
        />
      </div>

      <button
        type="submit"
        disabled={createMutation.isPending}
        className="w-full text-white rounded-xl py-4 font-bold text-lg transition-all disabled:opacity-60"
        style={{ background: 'var(--terra)' }}
        data-testid="button-launch-club"
      >
        {createMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating...
          </span>
        ) : (
          "Launch Club"
        )}
      </button>
    </form>
  );
}

function EventForm({ preselectedClubId, fromEventId }: { preselectedClubId?: string; fromEventId?: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: myClubs = [], isLoading: clubsLoading } = useQuery<Club[]>({
    queryKey: ["/api/organizer/my-clubs"],
  });

  const { data: baseEvent } = useQuery<{ id: string; title: string; description: string | null; locationText: string; maxCapacity: number; recurrenceRule: string | null; startsAt: string; clubId: string }>({
    queryKey: ["/api/events", fromEventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${fromEventId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    },
    enabled: !!fromEventId,
  });

  const [selectedClubId, setSelectedClubId] = useState(preselectedClubId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [locationText, setLocationText] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("none");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!baseEvent) return;
    const base = new Date(baseEvent.startsAt);
    if (baseEvent.recurrenceRule === "weekly") base.setDate(base.getDate() + 7);
    else if (baseEvent.recurrenceRule === "biweekly") base.setDate(base.getDate() + 14);
    else if (baseEvent.recurrenceRule === "monthly") base.setMonth(base.getMonth() + 1);
    else base.setDate(base.getDate() + 7);
    const pad = (n: number) => n.toString().padStart(2, "0");
    const nextDate = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
    setTitle(baseEvent.title);
    setDescription(baseEvent.description || "");
    setLocationText(baseEvent.locationText);
    setMaxCapacity(String(baseEvent.maxCapacity));
    setRecurrenceRule(baseEvent.recurrenceRule || "none");
    setDateTime(nextDate);
    if (!preselectedClubId) setSelectedClubId(baseEvent.clubId);
  }, [baseEvent?.id]);

  const effectiveClubId = selectedClubId || (myClubs.length === 1 ? myClubs[0].id : "");

  const createEventMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/clubs/${effectiveClubId}/events`, {
        title,
        description,
        startsAt: new Date(dateTime).toISOString(),
        locationText,
        maxCapacity: parseInt(maxCapacity) || 50,
        recurrenceRule: recurrenceRule !== "none" ? recurrenceRule : null,
        coverImageUrl: coverImageUrl ?? undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Failed to create event" }));
        throw new Error(data.message || "Failed to create event");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Event created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setTitle("");
      setDescription("");
      setDateTime("");
      setLocationText("");
      setMaxCapacity("");
      setRecurrenceRule("none");
      navigate("/organizer");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveClubId) {
      toast({ title: "Please select a club", variant: "destructive" });
      return;
    }
    if (!title) {
      toast({ title: "Please enter an event title", variant: "destructive" });
      return;
    }
    if (!dateTime) {
      toast({ title: "Please select a date and time", variant: "destructive" });
      return;
    }
    createEventMutation.mutate();
  };

  if (clubsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--terra)' }} />
      </div>
    );
  }

  if (myClubs.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 text-center space-y-3">
        <p className="text-muted-foreground text-sm" data-testid="text-no-club">
          Create a club first to add events.
        </p>
        <button
          onClick={() => {
            const tabBtn = document.querySelector('[data-testid="tab-new-club"]') as HTMLButtonElement;
            tabBtn?.click();
          }}
          className="text-sm font-semibold"
          style={{ color: 'var(--terra)' }}
          data-testid="button-switch-to-club"
        >
          Go to New Club
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {myClubs.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            CLUB
          </label>
          <Select onValueChange={setSelectedClubId} value={effectiveClubId}>
            <SelectTrigger className="glass-card rounded-xl" data-testid="select-event-club">
              <SelectValue placeholder="Select a club" />
            </SelectTrigger>
            <SelectContent>
              {myClubs.map((club) => (
                <SelectItem key={club.id} value={club.id}>
                  {club.emoji} {club.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {myClubs.length === 1 && (
        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">{myClubs[0].emoji}</span>
          <span className="text-sm font-medium text-foreground">{myClubs[0].name}</span>
        </div>
      )}

      <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} label="Event Cover Photo" />

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          EVENT TITLE
        </label>
        <Input
          placeholder="Event title"
          className="glass-card rounded-xl"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="input-event-title"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          DESCRIPTION
        </label>
        <textarea
          placeholder="Describe the event..."
          rows={4}
          className="w-full px-3 py-2 glass-card rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 resize-none"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          data-testid="input-event-description"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          DATE & TIME
        </label>
        <Input
          type="datetime-local"
          className="glass-card rounded-xl"
          value={dateTime}
          onChange={(e) => setDateTime(e.target.value)}
          data-testid="input-event-datetime"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          LOCATION
        </label>
        <Input
          placeholder="Event location"
          className="glass-card rounded-xl"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          data-testid="input-event-location"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          MAX CAPACITY
        </label>
        <Input
          type="number"
          placeholder="50"
          className="glass-card rounded-xl"
          value={maxCapacity}
          onChange={(e) => setMaxCapacity(e.target.value)}
          data-testid="input-event-capacity"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          REPEATS
        </label>
        <Select onValueChange={setRecurrenceRule} value={recurrenceRule}>
          <SelectTrigger className="glass-card rounded-xl" data-testid="select-recurrence">
            <SelectValue placeholder="Does not repeat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Does not repeat</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        {recurrenceRule !== "none" && (
          <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5" data-testid="text-recurrence-info">
            <Repeat className="w-3 h-3 shrink-0" />
            Next 4 dates will be auto-created
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={createEventMutation.isPending}
        className="w-full text-white rounded-xl py-4 font-bold text-lg transition-all disabled:opacity-60"
        style={{ background: 'var(--terra)' }}
        data-testid="button-create-event"
      >
        {createEventMutation.isPending ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating...
          </span>
        ) : (
          "Create Event"
        )}
      </button>
    </form>
  );
}