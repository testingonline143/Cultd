import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Plus, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Copy, Check, ExternalLink, Globe, Loader2, Calendar, MapPin, X, Pencil, LayoutGrid, List, Columns } from "lucide-react";
import type { Club, ClubPageSection, Event } from "@shared/schema";

interface SectionEvent {
  id: string;
  sectionId: string;
  eventId: string;
  position: number;
  eventTitle: string;
  eventStartsAt: string;
  eventLocation: string;
}

interface SectionWithEvents extends ClubPageSection {
  events: SectionEvent[];
}

const SECTION_EMOJIS = ["📌", "🎯", "🏆", "📸", "🎉", "📅", "💡", "🔥", "⭐", "🎵", "🏃", "📚"];
const LAYOUT_OPTIONS = [
  { value: "full", label: "Full Width", icon: LayoutGrid },
  { value: "list", label: "Compact List", icon: List },
  { value: "scroll", label: "Horizontal Scroll", icon: Columns },
] as const;

export default function PageBuilder() {
  const searchString = useSearch();
  const clubId = new URLSearchParams(searchString).get("club") || "";
  const [, navigate] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: club, isLoading: clubLoading } = useQuery<Club>({
    queryKey: ["/api/clubs", clubId],
    enabled: !!clubId,
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SectionWithEvents[]>({
    queryKey: ["/api/organizer/clubs", clubId, "page-sections"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/page-sections`);
      return res.json();
    },
    enabled: !!clubId,
  });

  const { data: clubEvents = [] } = useQuery<Event[]>({
    queryKey: ["/api/clubs", clubId, "events"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${clubId}/events`);
      return res.json();
    },
    enabled: !!clubId,
  });

  const [slug, setSlug] = useState("");
  const [slugSaved, setSlugSaved] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  const [editName, setEditName] = useState("");
  const [editShortDesc, setEditShortDesc] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [profileDirty, setProfileDirty] = useState(false);

  const generateSlugMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizer/clubs/${clubId}/generate-slug`, {});
      return res.json();
    },
    onSuccess: (data: { slug: string }) => {
      setSlug(data.slug);
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId] });
    },
  });

  useEffect(() => {
    if (club) {
      if (club.slug) {
        setSlug(club.slug);
      } else if (clubId && !generateSlugMutation.isPending) {
        generateSlugMutation.mutate();
      }
      setEditName(club.name || "");
      setEditShortDesc(club.shortDesc || "");
      setEditSchedule(club.schedule || "");
      setEditLocation(club.location || "");
    }
  }, [club]);

  const slugMutation = useMutation({
    mutationFn: async (newSlug: string) => {
      const res = await apiRequest("PATCH", `/api/organizer/clubs/${clubId}/slug`, { slug: newSlug });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId] });
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 2000);
      toast({ title: "URL updated!" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to update URL", variant: "destructive" });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: { shortDesc?: string; schedule?: string; location?: string; name?: string }) => {
      const res = await apiRequest("PATCH", `/api/organizer/clubs/${clubId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId] });
      setProfileDirty(false);
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (data: { title: string; emoji: string; description?: string; layout?: string }) => {
      const res = await apiRequest("POST", `/api/organizer/clubs/${clubId}/page-sections`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
      toast({ title: "Section added!" });
      setNewSectionTitle("");
      setNewSectionEmoji("📌");
      setNewSectionDesc("");
      setNewSectionLayout("full");
      setShowNewSection(false);
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ sectionId, data }: { sectionId: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/organizer/clubs/${clubId}/page-sections/${sectionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      await apiRequest("DELETE", `/api/organizer/clubs/${clubId}/page-sections/${sectionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
      toast({ title: "Section deleted" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (sectionIds: string[]) => {
      await apiRequest("PATCH", `/api/organizer/clubs/${clubId}/page-sections/reorder`, { sectionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async ({ sectionId, eventId }: { sectionId: string; eventId: string }) => {
      const res = await apiRequest("POST", `/api/organizer/clubs/${clubId}/page-sections/${sectionId}/events`, { eventId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
    },
  });

  const removeEventMutation = useMutation({
    mutationFn: async ({ sectionId, seId }: { sectionId: string; seId: string }) => {
      await apiRequest("DELETE", `/api/organizer/clubs/${clubId}/page-sections/${sectionId}/events/${seId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "page-sections"] });
    },
  });

  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionEmoji, setNewSectionEmoji] = useState("📌");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [newSectionLayout, setNewSectionLayout] = useState("full");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionDesc, setEditSectionDesc] = useState("");
  const [editSectionLayout, setEditSectionLayout] = useState("full");
  const [addingEventToSection, setAddingEventToSection] = useState<string | null>(null);

  if (authLoading || clubLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--cream)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--terra)]" />
      </div>
    );
  }

  if (!clubId || !isAuthenticated || !club) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--cream)" }}>
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-2" data-testid="text-access-denied">Access Denied</h2>
          <p className="text-sm text-[var(--muted-warm)]">You need to be logged in and be a club manager to access this page.</p>
        </div>
      </div>
    );
  }

  const publicUrl = club.slug ? `${window.location.origin}/c/${club.slug}` : null;

  const moveSection = (index: number, direction: "up" | "down") => {
    const ids = sections.map(s => s.id);
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ids.length) return;
    [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
    reorderMutation.mutate(ids);
  };

  const handleCopyUrl = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setSlugCopied(true);
      setTimeout(() => setSlugCopied(false), 2000);
    }
  };

  const startEditSection = (section: SectionWithEvents) => {
    setEditingSection(section.id);
    setEditSectionTitle(section.title);
    setEditSectionDesc(section.description || "");
    setEditSectionLayout(section.layout || "full");
  };

  const saveEditSection = (sectionId: string) => {
    updateSectionMutation.mutate({
      sectionId,
      data: { title: editSectionTitle, description: editSectionDesc || null, layout: editSectionLayout },
    });
    setEditingSection(null);
  };

  const handleProfileFieldChange = (field: string, value: string) => {
    if (field === "name") setEditName(value);
    if (field === "shortDesc") setEditShortDesc(value);
    if (field === "schedule") setEditSchedule(value);
    if (field === "location") setEditLocation(value);
    setProfileDirty(true);
  };

  const saveProfileField = (field: string) => {
    const data: any = {};
    if (field === "name" && editName !== club?.name) data.name = editName;
    else if (field === "shortDesc" && editShortDesc !== (club?.shortDesc || "")) data.shortDesc = editShortDesc;
    else if (field === "schedule" && editSchedule !== (club?.schedule || "")) data.schedule = editSchedule;
    else if (field === "location" && editLocation !== (club?.location || "")) data.location = editLocation;
    if (Object.keys(data).length > 0) {
      profileMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen pb-32" style={{ background: "var(--cream)" }}>
      <div className="sticky top-0 z-30 px-5 pt-14 pb-3 flex items-center justify-between" style={{ background: "var(--cream)", borderBottom: "1.5px solid var(--warm-border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/organizer")} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} data-testid="button-back">
            <ChevronLeft className="w-4 h-4 text-[var(--ink)]" />
          </button>
          <div>
            <h1 className="font-display text-lg font-bold text-[var(--ink)]">Page Builder</h1>
            <p className="text-[10px] text-[var(--muted-warm)]">{club.name}</p>
          </div>
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--terra)]" style={{ background: "var(--terra-pale)" }} data-testid="link-preview-page">
            <Eye className="w-3.5 h-3.5" /> Preview
          </a>
        )}
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-2xl p-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-[var(--terra)]" />
            <h2 className="font-display text-sm font-bold text-[var(--ink)]">Public URL</h2>
          </div>
          <p className="text-xs text-[var(--muted-warm)] mb-3">Set a custom URL for your club's public page. Share it anywhere!</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center rounded-lg overflow-hidden" style={{ border: "1.5px solid var(--warm-border)", background: "var(--cream)" }}>
              <span className="text-xs text-[var(--muted-warm)] px-2.5 shrink-0 select-none">/c/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="your-club-name"
                className="flex-1 py-2.5 pr-2.5 text-sm bg-transparent outline-none text-[var(--ink)]"
                data-testid="input-slug"
              />
            </div>
            <button
              onClick={() => slug.length >= 2 && slugMutation.mutate(slug)}
              disabled={slug.length < 2 || slugMutation.isPending}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--terra)" }}
              data-testid="button-save-slug"
            >
              {slugMutation.isPending ? "..." : slugSaved ? "Saved!" : "Save"}
            </button>
          </div>
          {publicUrl && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 text-xs text-[var(--terra)] font-medium truncate" data-testid="text-public-url">{publicUrl}</div>
              <button onClick={handleCopyUrl} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "var(--terra-pale)", color: "var(--terra)" }} data-testid="button-copy-url">
                {slugCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {slugCopied ? "Copied!" : "Copy"}
              </button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "var(--terra-pale)", color: "var(--terra)" }} data-testid="link-open-page">
                <ExternalLink className="w-3 h-3" /> Open
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[var(--terra)]" />
            <h2 className="font-display text-sm font-bold text-[var(--ink)]">Club Profile</h2>
            {profileMutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-[var(--terra)]" />}
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider">Club Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => handleProfileFieldChange("name", e.target.value)}
              onBlur={() => saveProfileField("name")}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)] font-semibold"
              style={{ border: "1.5px solid var(--warm-border)" }}
              placeholder="Club name"
              data-testid="input-name"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider">Tagline</label>
            <input
              type="text"
              value={editShortDesc}
              onChange={(e) => handleProfileFieldChange("shortDesc", e.target.value)}
              onBlur={() => saveProfileField("shortDesc")}
              className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)]"
              style={{ border: "1.5px solid var(--warm-border)" }}
              placeholder="Short description..."
              data-testid="input-short-desc"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider">Schedule</label>
              <input
                type="text"
                value={editSchedule}
                onChange={(e) => handleProfileFieldChange("schedule", e.target.value)}
                onBlur={() => saveProfileField("schedule")}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)]"
                style={{ border: "1.5px solid var(--warm-border)" }}
                placeholder="e.g. Sun 5:30 AM"
                data-testid="input-schedule"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider">Location</label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => handleProfileFieldChange("location", e.target.value)}
                onBlur={() => saveProfileField("location")}
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)]"
                style={{ border: "1.5px solid var(--warm-border)" }}
                placeholder="e.g. Alipiri Gate"
                data-testid="input-location"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-bold text-[var(--ink)] flex items-center gap-2">
            Sections
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "var(--terra-pale)", color: "var(--terra)" }}>{sections.length}</span>
          </h2>
          <button
            onClick={() => setShowNewSection(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--terra)" }}
            data-testid="button-add-section"
          >
            <Plus className="w-3.5 h-3.5" /> Add Section
          </button>
        </div>

        {showNewSection && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--warm-white)", border: "1.5px solid rgba(196,98,45,0.3)" }}>
            <div className="flex flex-wrap gap-1 mb-3">
              {SECTION_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewSectionEmoji(e)} className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${newSectionEmoji === e ? "ring-2 ring-[var(--terra)] scale-110" : ""}`} style={{ background: "var(--cream)" }}>
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Section title (e.g. Featured Events)"
              className="w-full px-3 py-2.5 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)]"
              style={{ border: "1.5px solid var(--warm-border)" }}
              data-testid="input-section-title"
            />
            <input
              type="text"
              value={newSectionDesc}
              onChange={(e) => setNewSectionDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full mt-2 px-3 py-2.5 rounded-lg text-sm bg-[var(--cream)] outline-none text-[var(--ink)]"
              style={{ border: "1.5px solid var(--warm-border)" }}
              data-testid="input-section-desc"
            />
            <div className="mt-3">
              <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-1.5 block">Layout</label>
              <div className="flex gap-2">
                {LAYOUT_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNewSectionLayout(opt.value)}
                      className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all ${newSectionLayout === opt.value ? "ring-2 ring-[var(--terra)]" : ""}`}
                      style={{ background: newSectionLayout === opt.value ? "var(--terra-pale)" : "var(--cream)", color: newSectionLayout === opt.value ? "var(--terra)" : "var(--muted-warm)" }}
                      data-testid={`button-layout-${opt.value}`}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setShowNewSection(false); setNewSectionTitle(""); setNewSectionDesc(""); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-[var(--muted-warm)]"
                style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => newSectionTitle.trim() && createSectionMutation.mutate({ title: newSectionTitle.trim(), emoji: newSectionEmoji, description: newSectionDesc.trim() || undefined, layout: newSectionLayout })}
                disabled={!newSectionTitle.trim() || createSectionMutation.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "var(--terra)" }}
                data-testid="button-create-section"
              >
                {createSectionMutation.isPending ? "Creating..." : "Create Section"}
              </button>
            </div>
          </div>
        )}

        {sectionsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[var(--terra)]" /></div>
        ) : sections.length === 0 && !showNewSection ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: "var(--warm-white)", border: "1.5px dashed var(--warm-border)" }}>
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-semibold text-[var(--ink)] mb-1" data-testid="text-no-sections">No sections yet</p>
            <p className="text-xs text-[var(--muted-warm)]">Add sections to organize your public page with events, highlights, and more.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, idx) => (
              <div key={section.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
                <div className="p-3 flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveSection(idx, "up")} disabled={idx === 0} className="text-[var(--muted-warm)] disabled:opacity-30" data-testid={`button-move-up-${section.id}`}><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveSection(idx, "down")} disabled={idx === sections.length - 1} className="text-[var(--muted-warm)] disabled:opacity-30" data-testid={`button-move-down-${section.id}`}><ArrowDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="text-lg">{section.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm font-bold text-[var(--ink)] truncate">{section.title}</div>
                    {section.description && <p className="text-xs text-[var(--muted-warm)] truncate">{section.description}</p>}
                    <span className="text-[9px] text-[var(--muted-warm)] uppercase tracking-wider">{section.layout || "full"}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => editingSection === section.id ? setEditingSection(null) : startEditSection(section)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--cream)" }}
                      data-testid={`button-edit-section-${section.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 text-[var(--terra)]" />
                    </button>
                    <button
                      onClick={() => updateSectionMutation.mutate({ sectionId: section.id, data: { isVisible: !section.isVisible } })}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--cream)" }}
                      data-testid={`button-toggle-visibility-${section.id}`}
                    >
                      {section.isVisible !== false ? <Eye className="w-3.5 h-3.5 text-[var(--terra)]" /> : <EyeOff className="w-3.5 h-3.5 text-[var(--muted-warm)]" />}
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this section?")) deleteSectionMutation.mutate(section.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(239,68,68,0.08)" }}
                      data-testid={`button-delete-section-${section.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>

                {editingSection === section.id && (
                  <div className="px-3 pb-3 space-y-2" style={{ background: "var(--cream)" }}>
                    <input
                      type="text"
                      value={editSectionTitle}
                      onChange={(e) => setEditSectionTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--warm-white)] outline-none text-[var(--ink)]"
                      style={{ border: "1.5px solid var(--warm-border)" }}
                      placeholder="Section title"
                      data-testid={`input-edit-title-${section.id}`}
                    />
                    <input
                      type="text"
                      value={editSectionDesc}
                      onChange={(e) => setEditSectionDesc(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--warm-white)] outline-none text-[var(--ink)]"
                      style={{ border: "1.5px solid var(--warm-border)" }}
                      placeholder="Description (optional)"
                      data-testid={`input-edit-desc-${section.id}`}
                    />
                    <div>
                      <label className="text-[10px] font-bold text-[var(--muted-warm)] uppercase tracking-wider mb-1 block">Layout</label>
                      <div className="flex gap-2">
                        {LAYOUT_OPTIONS.map(opt => {
                          const Icon = opt.icon;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setEditSectionLayout(opt.value)}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${editSectionLayout === opt.value ? "ring-2 ring-[var(--terra)]" : ""}`}
                              style={{ background: editSectionLayout === opt.value ? "var(--terra-pale)" : "var(--warm-white)", color: editSectionLayout === opt.value ? "var(--terra)" : "var(--muted-warm)" }}
                              data-testid={`button-edit-layout-${opt.value}-${section.id}`}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => saveEditSection(section.id)}
                      className="w-full py-2 rounded-lg text-xs font-bold text-white"
                      style={{ background: "var(--terra)" }}
                      data-testid={`button-save-section-${section.id}`}
                    >
                      Save Changes
                    </button>
                  </div>
                )}

                <div className="px-3 pb-3">
                  {section.events.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {section.events.map((evt) => (
                        <div key={evt.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: "var(--cream)" }}>
                          <Calendar className="w-3.5 h-3.5 text-[var(--terra)] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[var(--ink)] truncate">{evt.eventTitle}</div>
                            <div className="text-[10px] text-[var(--muted-warm)]">
                              {new Date(evt.eventStartsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              {evt.eventLocation && ` · ${evt.eventLocation}`}
                            </div>
                          </div>
                          <button
                            onClick={() => removeEventMutation.mutate({ sectionId: section.id, seId: evt.id })}
                            className="text-red-400 hover:text-red-500"
                            data-testid={`button-remove-event-${evt.id}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {addingEventToSection === section.id ? (
                    <EventPickerSheet
                      events={clubEvents}
                      existingEventIds={section.events.map(e => e.eventId)}
                      onSelect={(eventId) => {
                        addEventMutation.mutate({ sectionId: section.id, eventId });
                        setAddingEventToSection(null);
                      }}
                      onCancel={() => setAddingEventToSection(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingEventToSection(section.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-[var(--terra)] transition-colors"
                      style={{ background: "var(--terra-pale)" }}
                      data-testid={`button-add-event-to-${section.id}`}
                    >
                      <Plus className="w-3 h-3" /> Add Event
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 px-5 pb-6 pt-3" style={{ background: "linear-gradient(to top, var(--cream) 80%, transparent)" }}>
        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }} data-testid="bar-save-status">
          <div className="flex items-center gap-2">
            {(profileMutation.isPending || updateSectionMutation.isPending || createSectionMutation.isPending || reorderMutation.isPending || addEventMutation.isPending || removeEventMutation.isPending)
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--terra)]" /><span className="text-xs font-semibold text-[var(--terra)]">Saving...</span></>
              : <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-xs font-semibold text-green-700">All changes saved</span></>
            }
          </div>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "var(--terra)", textDecoration: "none" }} data-testid="link-view-live">
              <Eye className="w-3 h-3" /> View Live
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EventPickerSheet({ events, existingEventIds, onSelect, onCancel }: {
  events: Event[];
  existingEventIds: string[];
  onSelect: (eventId: string) => void;
  onCancel: () => void;
}) {
  const available = events.filter(e => !existingEventIds.includes(e.id) && !e.isCancelled);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-5 pt-3 max-h-[70vh] overflow-y-auto" style={{ background: "var(--warm-white)" }} data-testid="sheet-event-picker">
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--warm-border)" }} />
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-bold text-[var(--ink)]">Add Event</h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--cream)" }} data-testid="button-cancel-picker">
            <X className="w-4 h-4 text-[var(--ink)]" />
          </button>
        </div>
        {available.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-sm text-[var(--muted-warm)]">No available events to add.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {available.map((event) => (
              <button
                key={event.id}
                onClick={() => onSelect(event.id)}
                className="w-full flex items-center gap-3 rounded-xl p-3 text-left transition-all active:scale-[0.98]"
                style={{ background: "var(--cream)", border: "1.5px solid var(--warm-border)" }}
                data-testid={`button-pick-event-${event.id}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--terra-pale)" }}>
                  <Calendar className="w-4 h-4 text-[var(--terra)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--ink)] truncate">{event.title}</div>
                  <div className="text-xs text-[var(--muted-warm)] mt-0.5">
                    {new Date(event.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {event.locationText && ` · ${event.locationText}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
