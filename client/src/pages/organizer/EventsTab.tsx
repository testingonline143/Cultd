import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ImageUpload } from "@/components/image-upload";
import { Calendar, MapPin, Users, QrCode, Check, Copy, Loader2, Pencil, Clock, AlertTriangle, Link2, Zap, BarChart3, Download, Repeat, UserCheck, Clock3, Ban, ChevronDown, ChevronUp, RefreshCw, ClipboardList, Trash2, Plus, FileText, ToggleLeft, ToggleRight, Ticket, IndianRupee } from "lucide-react";
import type { Event, EventRsvp, EventFormQuestion, EventTicketType } from "@shared/schema";

type AttendeeData = EventRsvp & { userName: string | null; checkedIn: boolean | null; checkedInAt: Date | null; ticketTypeName: string | null; ticketTypeId: number | null };
type AttendanceRow = { userId: string; userName: string | null; status: string; checkedIn: boolean | null; checkedInAt: string | null; phone: string | null };
type AttendanceReport = { attendees: AttendanceRow[]; goingCount: number; waitlistCount: number; checkedInCount: number };

function RecurringEventGroup({ group, clubId, onDuplicate, onExtend, extendPending }: { group: { key: string; rule: string; label: string; events: (Event & { rsvpCount: number })[] }; clubId: string; onDuplicate: (event: Event & { rsvpCount: number }) => void; onExtend: (event: Event & { rsvpCount: number }) => void; extendPending: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date();
  const allPast = group.events.every(e => new Date(e.startsAt) < now && !e.isCancelled);
  const anyActive = group.events.some(e => new Date(e.startsAt) >= now && !e.isCancelled);
  const seedEvent = group.events[group.events.length - 1];
  return (
    <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] overflow-hidden" style={{ borderRadius: 18 }} data-testid={`recurring-group-${group.key}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 p-4 text-left" data-testid={`button-toggle-group-${group.key}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}><Repeat className="w-4 h-4 text-[var(--terra)]" /></div>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-foreground block truncate">{group.label}</span>
          {allPast && <span className="text-[11px] text-muted-foreground">All instances completed</span>}
          {anyActive && <span className="text-[11px] text-[var(--terra)]">Series active</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {allPast && (
        <div className="px-4 pb-4 pt-0">
          <button onClick={() => onExtend(seedEvent)} disabled={extendPending} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border-[1.5px] border-dashed border-[rgba(196,98,45,0.4)] text-[var(--terra)] disabled:opacity-50" style={{ background: 'var(--terra-pale)' }} data-testid={`button-extend-series-${group.key}`}>
            {extendPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {extendPending ? "Scheduling..." : "Schedule next 4 instances"}
          </button>
        </div>
      )}
      {expanded && <div className="border-t border-[var(--warm-border)] space-y-0">{group.events.map((event) => <EventCard key={event.id} event={event} clubId={clubId} onDuplicate={onDuplicate} />)}</div>}
    </div>
  );
}

function EventTodayBanner({ event }: { event: Event & { rsvpCount: number } }) {
  const d = new Date(event.startsAt);
  const { toast } = useToast();
  return (
    <div className="relative overflow-hidden p-5" style={{ borderRadius: 18, background: "linear-gradient(135deg, var(--ink) 0%, #2d1810 100%)" }} data-testid={`banner-event-today-${event.id}`}>
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--terra)] text-white text-[10px] font-bold uppercase tracking-wider"><Zap className="w-3 h-3" />Today</div>
      <div className="mb-4">
        <h3 className="font-display text-lg font-bold text-white pr-16" data-testid={`text-today-event-title-${event.id}`}>{event.title}</h3>
        <div className="flex items-center gap-3 text-xs text-white/60 mt-2 flex-wrap">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.locationText}</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.rsvpCount}/{event.maxCapacity} RSVPs</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href={`/scan/${event.id}`} className="flex-1 flex items-center justify-center gap-2 bg-[var(--terra)] text-white rounded-xl py-3.5 text-sm font-bold" data-testid={`button-today-checkin-${event.id}`}><QrCode className="w-5 h-5" />Check In Attendees</Link>
        <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/scan/${event.id}`).then(() => toast({ title: "Scanner link copied!" })).catch(() => toast({ title: "Couldn't copy link", description: "Please copy it manually.", variant: "destructive" }))} className="flex items-center justify-center gap-1.5 px-4 rounded-xl text-xs font-semibold bg-white/10 text-white/80" data-testid={`button-today-copy-link-${event.id}`}><Link2 className="w-3.5 h-3.5" />Share</button>
      </div>
    </div>
  );
}

function EventTicketEditor({ event }: { event: Event & { rsvpCount: number } }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const { data: tickets = [], refetch } = useQuery<EventTicketType[]>({
    queryKey: ["/api/events", event.id, "tickets"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/tickets`);
      return res.json();
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/organizer/events/${event.id}/tickets`, {
        name: newName.trim(),
        price: parseInt(newPrice) || 0,
        description: newDesc.trim() || undefined,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed"); }
      return res.json();
    },
    onSuccess: () => { refetch(); setNewName(""); setNewPrice(""); setNewDesc(""); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await apiRequest("PATCH", `/api/organizer/events/${event.id}/tickets/${ticketId}`, {
        name: editName.trim(),
        price: parseInt(editPrice) || 0,
        description: editDesc.trim() || undefined,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed to update"); }
      return res.json();
    },
    onSuccess: () => { refetch(); setEditingId(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      const res = await apiRequest("DELETE", `/api/organizer/events/${event.id}/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => refetch(),
    onError: () => toast({ title: "Failed to delete ticket type", variant: "destructive" }),
  });

  const startEdit = (t: EventTicketType) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditPrice(String(t.price));
    setEditDesc(t.description ?? "");
  };

  const minPrice = tickets.length > 0 ? Math.min(...tickets.map(t => t.price)) : null;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--warm-border)]" data-testid={`section-ticket-editor-${event.id}`}>
      <button
        onClick={() => setExpanded(p => !p)}
        className="flex items-center justify-between w-full gap-2 mb-2"
        data-testid={`button-toggle-ticket-editor-${event.id}`}
      >
        <div className="flex items-center gap-2">
          <Ticket className="w-3.5 h-3.5 text-[var(--terra)]" />
          <span className="text-xs font-semibold text-foreground">Ticket Types</span>
          {tickets.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)" }}>
              {tickets.length}
            </span>
          )}
          {minPrice !== null && (
            <span className="text-[10px] font-semibold" style={{ color: "var(--terra)" }}>
              · from ₹{minPrice}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="text-center py-3 rounded-xl" style={{ background: "var(--cream)", border: "1.5px dashed var(--warm-border)" }} data-testid={`empty-tickets-${event.id}`}>
              <Ticket className="w-5 h-5 mx-auto mb-1 text-muted-foreground/50" />
              <p className="text-[11px] text-muted-foreground">No ticket types yet · event is free to join</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {tickets.map((t) => (
                <div key={t.id} className="rounded-lg overflow-hidden" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }} data-testid={`ticket-row-${t.id}`}>
                  {editingId === t.id ? (
                    <div className="px-3 py-2 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Edit Ticket</p>
                      <div className="flex gap-2">
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Ticket name"
                          className="flex-[2] px-3 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
                          data-testid={`input-edit-ticket-name-${t.id}`}
                        />
                        <div className="relative flex-1">
                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                          <input
                            value={editPrice}
                            onChange={e => setEditPrice(e.target.value)}
                            type="number"
                            min="0"
                            placeholder="0"
                            className="w-full pl-6 pr-2 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
                            data-testid={`input-edit-ticket-price-${t.id}`}
                          />
                        </div>
                      </div>
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full px-3 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
                        data-testid={`input-edit-ticket-desc-${t.id}`}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { if (editName.trim()) updateMutation.mutate(t.id); }}
                          disabled={!editName.trim() || updateMutation.isPending}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1"
                          style={{ background: "var(--terra)" }}
                          data-testid={`button-save-ticket-${t.id}`}
                        >
                          {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground"
                          style={{ background: "var(--warm-white)", border: "1px solid var(--warm-border)" }}
                          data-testid={`button-cancel-edit-ticket-${t.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{t.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)" }}>₹{t.price}</span>
                        </div>
                        {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                      </div>
                      <button
                        onClick={() => startEdit(t)}
                        className="shrink-0 text-muted-foreground/60 hover:text-[var(--terra)] transition-colors mt-0.5"
                        data-testid={`button-edit-ticket-${t.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(t.id)}
                        disabled={deleteMutation.isPending}
                        className="shrink-0 text-muted-foreground/60 hover:text-destructive transition-colors mt-0.5"
                        data-testid={`button-delete-ticket-${t.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 p-3 rounded-xl" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Add Ticket Type</p>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name (e.g. Single Pass)"
                className="flex-[2] px-3 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
                data-testid={`input-ticket-name-${event.id}`}
              />
              <div className="relative flex-1">
                <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder="0"
                  type="number"
                  min="0"
                  className="w-full pl-6 pr-2 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
                  data-testid={`input-ticket-price-${event.id}`}
                />
              </div>
            </div>
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
              data-testid={`input-ticket-desc-${event.id}`}
            />
            <button
              onClick={() => { if (newName.trim()) addMutation.mutate(); }}
              disabled={!newName.trim() || addMutation.isPending}
              className="w-full py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ background: "var(--terra)" }}
              data-testid={`button-add-ticket-${event.id}`}
            >
              {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5" />Add Ticket Type</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const COMMON_QUESTIONS = [
  "What is your phone number?",
  "What is your email address?",
  "What is your gender?",
  "What is your name?",
];

type FormResponseRow = { userId: string; userName: string | null; answers: { question: string; answer: string }[] };

function EventSurveyFormEditor({ event }: { event: Event & { rsvpCount: number } }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");
  const [showResponses, setShowResponses] = useState(false);

  const { data: formData, refetch: refetchForm } = useQuery<{ formMandatory: boolean; questions: EventFormQuestion[] }>({
    queryKey: ["/api/events", event.id, "form"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/form`);
      return res.json();
    },
  });

  const { data: responses = [], isLoading: responsesLoading } = useQuery<FormResponseRow[]>({
    queryKey: ["/api/organizer/events", event.id, "form-responses"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/events/${event.id}/form-responses`);
      return res.json();
    },
    enabled: showResponses,
  });

  const toggleMandatoryMutation = useMutation({
    mutationFn: async (mandatory: boolean) => {
      const res = await apiRequest("PATCH", `/api/organizer/events/${event.id}/form/mandatory`, { mandatory });
      return res.json();
    },
    onSuccess: () => refetchForm(),
    onError: () => toast({ title: "Failed to update setting", variant: "destructive" }),
  });

  const addQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", `/api/organizer/events/${event.id}/form/questions`, { question });
      return res.json();
    },
    onSuccess: () => { refetchForm(); setCustomQuestion(""); },
    onError: () => toast({ title: "Failed to add question", variant: "destructive" }),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const res = await apiRequest("DELETE", `/api/organizer/events/${event.id}/form/questions/${questionId}`);
      return res.json();
    },
    onSuccess: () => refetchForm(),
    onError: () => toast({ title: "Failed to delete question", variant: "destructive" }),
  });

  const questions = formData?.questions ?? [];
  const isMandatory = formData?.formMandatory ?? false;
  const existingText = new Set(questions.map(q => q.question));

  return (
    <div className="mt-3 pt-3 border-t border-[var(--warm-border)]" data-testid={`section-survey-form-${event.id}`}>
      <button
        onClick={() => setExpanded(p => !p)}
        className="flex items-center justify-between w-full gap-2 mb-2"
        data-testid={`button-toggle-survey-form-${event.id}`}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-[var(--terra)]" />
          <span className="text-xs font-semibold text-foreground">Survey Form</span>
          {questions.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--terra-pale)", color: "var(--terra)" }}>
              {questions.length} Q
            </span>
          )}
          {isMandatory && <span className="text-[10px] font-semibold" style={{ color: "var(--terra)" }}>· Required</span>}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && <div className="space-y-3">
        <div className="flex items-center justify-end">
          <button
            onClick={() => toggleMandatoryMutation.mutate(!isMandatory)}
            disabled={toggleMandatoryMutation.isPending}
            className="flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: isMandatory ? "var(--terra)" : "var(--muted-warm)" }}
            data-testid={`toggle-form-mandatory-${event.id}`}
          >
            {isMandatory ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {isMandatory ? "Mandatory" : "Optional"}
          </button>
        </div>

      {questions.length === 0 ? (
        <div className="text-center py-3 rounded-xl" style={{ background: "var(--cream)", border: "1.5px dashed var(--warm-border)" }} data-testid={`empty-form-${event.id}`}>
          <FileText className="w-5 h-5 mx-auto mb-1 text-muted-foreground/50" />
          <p className="text-[11px] text-muted-foreground">No questions yet</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {questions.map((q) => (
            <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--cream)", border: "1px solid var(--warm-border)" }} data-testid={`question-row-${q.id}`}>
              <span className="flex-1 text-xs text-foreground">{q.question}</span>
              <button
                onClick={() => deleteQuestionMutation.mutate(q.id)}
                disabled={deleteQuestionMutation.isPending}
                className="shrink-0 text-muted-foreground/60 hover:text-destructive transition-colors"
                data-testid={`button-delete-question-${q.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Quick Add</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_QUESTIONS.filter(q => !existingText.has(q)).map((q) => (
            <button
              key={q}
              onClick={() => addQuestionMutation.mutate(q)}
              disabled={addQuestionMutation.isPending}
              className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-full border-[1.5px] transition-all"
              style={{ background: "var(--warm-white)", borderColor: "var(--warm-border)", color: "var(--ink3)" }}
              data-testid={`button-quick-add-${q.replace(/\s+/g, "-").toLowerCase()}-${event.id}`}
            >
              <Plus className="w-3 h-3" />{q}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={customQuestion}
          onChange={e => setCustomQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && customQuestion.trim()) addQuestionMutation.mutate(customQuestion.trim()); }}
          placeholder="Type a custom question..."
          className="flex-1 px-3 py-2 rounded-lg text-xs border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] focus:outline-none focus:ring-1 focus:ring-[var(--terra)]/30"
          data-testid={`input-custom-question-${event.id}`}
        />
        <button
          onClick={() => { if (customQuestion.trim()) addQuestionMutation.mutate(customQuestion.trim()); }}
          disabled={!customQuestion.trim() || addQuestionMutation.isPending}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--terra)" }}
          data-testid={`button-add-custom-question-${event.id}`}
        >
          {addQuestionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
        </button>
      </div>

      {questions.length > 0 && (
        <button
          onClick={() => setShowResponses(p => !p)}
          className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
          style={{ background: "var(--terra-pale)", color: "var(--terra)" }}
          data-testid={`button-view-form-responses-${event.id}`}
        >
          <ClipboardList className="w-3 h-3" />
          {showResponses ? "Hide Responses" : `View Responses${responses.length > 0 ? ` (${responses.length})` : ""}`}
        </button>
      )}

      {showResponses && (
        <div className="rounded-xl overflow-hidden border border-[var(--warm-border)]" data-testid={`section-form-responses-${event.id}`}>
          {responsesLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--terra)]" /></div>
          ) : responses.length === 0 ? (
            <div className="text-center py-4 text-xs text-muted-foreground" data-testid={`text-no-responses-${event.id}`}>No responses yet</div>
          ) : (
            <div className="divide-y divide-[var(--warm-border)]">
              {responses.map((resp, i) => (
                <div key={resp.userId} className="p-3" data-testid={`response-row-${event.id}-${i}`}>
                  <div className="text-xs font-semibold text-foreground mb-1.5">{resp.userName || "Anonymous"}</div>
                  <div className="space-y-1">
                    {resp.answers.map((a, j) => (
                      <div key={j} className="text-[11px]">
                        <span className="text-muted-foreground">{a.question}: </span>
                        <span className="font-medium text-foreground">{a.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>}
    </div>
  );
}

function EventCard({ event, clubId, onDuplicate }: { event: Event & { rsvpCount: number }; clubId: string; onDuplicate: (event: Event & { rsvpCount: number }) => void }) {
  const [showAttendees, setShowAttendees] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { toast } = useToast();
  const [editTitle, setEditTitle] = useState(event.title);
  const [editDescription, setEditDescription] = useState(event.description || "");
  const [editStartsAt, setEditStartsAt] = useState(() => {
    const d = new Date(event.startsAt);
    const p = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [editLocationText, setEditLocationText] = useState(event.locationText);
  const [editMaxCapacity, setEditMaxCapacity] = useState(String(event.maxCapacity));
  const [editCoverImageUrl, setEditCoverImageUrl] = useState<string | null>(event.coverImageUrl ?? null);
  const [editError, setEditError] = useState("");
  const d = new Date(event.startsAt);
  const isPast = d < new Date();
  const isCancelled = event.isCancelled;

  const { data: attendeeData } = useQuery<{ attendees: AttendeeData[]; checkedInCount: number; totalRsvps: number }>({
    queryKey: ["/api/events", event.id, "attendees"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/events/${event.id}/attendees`); return res.json(); },
    enabled: showAttendees,
  });

  const { data: reportData, isLoading: reportLoading } = useQuery<AttendanceReport>({
    queryKey: ["/api/organizer/events", event.id, "attendance"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/organizer/events/${event.id}/attendance`); return res.json(); },
    enabled: showReport,
  });

  const editMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("PATCH", `/api/clubs/${clubId}/events/${event.id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "events"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); setShowEditForm(false); setEditError(""); },
    onError: (err: Error) => setEditError(err.message || "Failed to update event"),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/organizer/events/${event.id}/cancel`);
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || "Failed to cancel"); }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "events"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); setShowCancelConfirm(false); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const checkedInCount = attendeeData?.checkedInCount ?? 0;
  const totalRsvps = attendeeData?.totalRsvps ?? event.rsvpCount;
  const attendees = attendeeData?.attendees ?? [];

  const handleDownloadCsv = () => {
    if (!reportData) return;
    const rows = reportData.attendees.map(a => [`"${a.userName??""}"`, `"${a.phone??""}"`, a.status==="going"?"Going":"Waitlisted", a.checkedIn?"Yes":"No", a.checkedInAt?new Date(a.checkedInAt).toLocaleString("en-IN"):"—"].join(","));
    const csv = [["Name","Phone","RSVP","Checked In","Time"].join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `${event.title.replace(/\s+/g,"_")}_attendance.csv` }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 ${isCancelled||isPast?"opacity-50":""}`} style={{ borderRadius: 18 }} data-testid={`event-card-${event.id}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="font-semibold text-sm text-foreground">{event.title}</span>
        {isCancelled && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-destructive/15 text-destructive" data-testid={`badge-cancelled-${event.id}`}><Ban className="w-2.5 h-2.5"/>Cancelled</span>}
        {!isCancelled && isPast && <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-md text-muted-foreground">Past</span>}
        {event.recurrenceRule && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{background:'rgba(196,98,45,0.1)',color:'var(--terra)'}} data-testid={`badge-recurring-${event.id}`}><Repeat className="w-2.5 h-2.5"/>{event.recurrenceRule==="weekly"?"Weekly":event.recurrenceRule==="biweekly"?"Bi-weekly":"Monthly"}</span>}
      </div>

      {showCancelConfirm && (
        <div className="mb-3 p-3 rounded-md bg-destructive/10 border border-destructive/30" data-testid={`confirm-cancel-event-${event.id}`}>
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-destructive"/><span className="text-sm font-semibold text-destructive">Cancel this event?</span></div>
          <p className="text-xs text-muted-foreground mb-3">This will mark the event as cancelled.</p>
          <div className="flex gap-2">
            <button onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} className="flex-1 py-2 rounded-md text-xs font-semibold bg-destructive text-white" data-testid={`button-confirm-cancel-${event.id}`}>{cancelMutation.isPending?"Cancelling...":"Yes, Cancel Event"}</button>
            <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-2 rounded-md text-xs font-semibold bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground" data-testid={`button-dismiss-cancel-${event.id}`}>Keep Event</button>
          </div>
        </div>
      )}

      {showEditForm && (
        <div className="mb-3 p-3 rounded-md bg-[var(--cream)] border-[1.5px] border-[var(--warm-border)] space-y-3" data-testid={`form-edit-event-${event.id}`}>
          <ImageUpload value={editCoverImageUrl} onChange={setEditCoverImageUrl} label="Event Cover Photo" />
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Title</label><input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid={`input-edit-event-title-${event.id}`}/></div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label><textarea value={editDescription} onChange={e=>setEditDescription(e.target.value)} rows={2} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid={`input-edit-event-desc-${event.id}`}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date & Time</label><input type="datetime-local" value={editStartsAt} onChange={e=>setEditStartsAt(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid={`input-edit-event-datetime-${event.id}`}/></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Capacity</label><input type="number" value={editMaxCapacity} onChange={e=>setEditMaxCapacity(e.target.value)} min="2" max="500" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid={`input-edit-event-capacity-${event.id}`}/></div>
          </div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location</label><input value={editLocationText} onChange={e=>setEditLocationText(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--warm-white)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid={`input-edit-event-location-${event.id}`}/></div>
          {editError && <p className="text-xs text-destructive font-medium text-center" data-testid={`text-edit-event-error-${event.id}`}>{editError}</p>}
          <div className="flex gap-2">
            <button onClick={() => editMutation.mutate({title:editTitle.trim(),description:editDescription.trim(),startsAt:editStartsAt,locationText:editLocationText.trim(),maxCapacity:parseInt(editMaxCapacity)||20,coverImageUrl:editCoverImageUrl})} disabled={editMutation.isPending||!editTitle.trim()||!editStartsAt||!editLocationText.trim()} className="flex-1 bg-[var(--terra)] text-white rounded-md py-2.5 text-sm font-semibold disabled:opacity-50" data-testid={`button-submit-edit-event-${event.id}`}>{editMutation.isPending?"Saving...":"Save Changes"}</button>
            <button onClick={() => {setShowEditForm(false);setEditError("");}} className="px-4 py-2.5 rounded-md text-sm font-semibold bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground" data-testid={`button-cancel-edit-event-${event.id}`}>Cancel</button>
          </div>
        </div>
      )}

      {event.description && <p className="text-xs text-muted-foreground mb-2">{event.description}</p>}
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{d.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})} &middot; {d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{event.locationText}</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3"/>{event.rsvpCount}/{event.maxCapacity}</span>
      </div>

      {!isCancelled && !isPast && (
        <div className="mt-3 pt-3 border-t border-[var(--warm-border)]">
          <div className="flex gap-2 mb-2">
            <Link href={`/scan/${event.id}`} className="flex-1 flex items-center justify-center gap-2 bg-[var(--terra)] text-white rounded-xl py-2.5 text-sm font-bold" data-testid={`button-scan-attendees-${event.id}`}><QrCode className="w-4 h-4"/>Scan & Check In</Link>
            <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/scan/${event.id}`).then(()=>toast({title:"Scanner link copied!"})).catch(()=>toast({title:"Could not copy link",variant:"destructive"}))} className="flex items-center justify-center gap-1.5 px-3 rounded-xl text-xs font-semibold bg-[var(--terra-pale)] text-[var(--terra)]" data-testid={`button-copy-scan-link-${event.id}`}><Link2 className="w-3.5 h-3.5"/></button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={()=>setShowEditForm(!showEditForm)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--cream)] text-muted-foreground" data-testid={`button-edit-event-${event.id}`}><Pencil className="w-2.5 h-2.5"/>Edit</button>
            <button onClick={()=>onDuplicate(event)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--cream)] text-muted-foreground" data-testid={`button-duplicate-${event.id}`}><Copy className="w-2.5 h-2.5"/>Duplicate</button>
            <button onClick={()=>setShowCancelConfirm(true)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--cream)] text-destructive/70" data-testid={`button-cancel-event-${event.id}`}><Ban className="w-2.5 h-2.5"/>Cancel</button>
          </div>
        </div>
      )}

      {!isCancelled && isPast && (
        <div className="mt-3 pt-3 border-t border-[var(--warm-border)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-foreground" data-testid={`text-attendance-stats-${event.id}`}>{checkedInCount} of {totalRsvps} attended</span>
            <span className="text-xs font-bold text-[var(--terra)]">{totalRsvps>0?Math.round((checkedInCount/totalRsvps)*100):0}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--cream)] overflow-hidden mb-2"><div className="h-full rounded-full transition-all" style={{width:`${totalRsvps>0?Math.round((checkedInCount/totalRsvps)*100):0}%`,background:"var(--terra)"}}/></div>
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <button onClick={()=>setShowReport(p=>!p)} className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[var(--terra-pale)] text-[var(--terra)]" data-testid={`button-view-report-${event.id}`}><BarChart3 className="w-2.5 h-2.5"/>{showReport?"Hide Report":"View Report"}</button>
            <button onClick={()=>onDuplicate(event)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--cream)] text-muted-foreground" data-testid={`button-duplicate-${event.id}`}><Copy className="w-2.5 h-2.5"/>Duplicate</button>
          </div>
          {showReport && (
            <div className="mt-2 p-3 rounded-xl bg-[var(--cream)] border border-[var(--warm-border)] space-y-3" data-testid={`section-report-${event.id}`}>
              {reportLoading ? <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-[var(--terra)]"/></div> : (
                <>
                  <div className="flex items-center gap-3 flex-wrap" data-testid={`report-summary-${event.id}`}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--warm-white)] border border-[var(--warm-border)]"><Users className="w-3 h-3 text-muted-foreground"/><span className="text-[11px] font-semibold">{reportData?.goingCount??0} Going</span></div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--terra-pale)] border border-[rgba(196,98,45,0.2)]"><UserCheck className="w-3 h-3" style={{color:"var(--terra)"}}/><span className="text-[11px] font-semibold" style={{color:"var(--terra)"}}>{reportData?.checkedInCount??0} Checked In</span></div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--warm-white)] border border-[var(--warm-border)]"><Clock3 className="w-3 h-3 text-muted-foreground"/><span className="text-[11px] font-semibold text-muted-foreground">{reportData?.waitlistCount??0} Waitlisted</span></div>
                  </div>
                  {(reportData?.attendees.length??0)>0 ? (
                    <div className="overflow-x-auto" data-testid={`report-table-${event.id}`}>
                      <table className="w-full text-[11px]">
                        <thead><tr className="border-b border-[var(--warm-border)]"><th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Name</th><th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">Status</th><th className="text-left py-1.5 font-semibold text-muted-foreground">Checked In</th></tr></thead>
                        <tbody>{reportData!.attendees.map((a,i)=>(<tr key={i} className="border-b border-[var(--warm-border)] last:border-0" data-testid={`report-row-${event.id}-${i}`}><td className="py-1.5 pr-3 font-medium">{a.userName??"—"}</td><td className="py-1.5 pr-3"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${a.status==="going"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{a.status==="going"?"Going":"Waitlisted"}</span></td><td className="py-1.5">{a.checkedIn?<span className="text-[var(--terra)] font-semibold">{a.checkedInAt?new Date(a.checkedInAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"Yes"}</span>:<span className="text-muted-foreground">—</span>}</td></tr>))}</tbody>
                      </table>
                    </div>
                  ) : <p className="text-[11px] text-muted-foreground text-center py-2">No RSVPs for this event</p>}
                  <button onClick={handleDownloadCsv} disabled={!reportData||reportData.attendees.length===0} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[var(--warm-white)] border border-[var(--warm-border)] disabled:opacity-40" data-testid={`button-download-csv-${event.id}`}><Download className="w-3.5 h-3.5"/>Download CSV</button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {isCancelled && <div className="mt-3 pt-3 border-t border-[var(--warm-border)]"><button onClick={()=>onDuplicate(event)} className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-[var(--cream)] text-muted-foreground" data-testid={`button-duplicate-${event.id}`}><Copy className="w-2.5 h-2.5"/>Duplicate</button></div>}

      {!isCancelled && <EventTicketEditor event={event} />}
      {!isCancelled && <EventSurveyFormEditor event={event} />}

      {!isCancelled && (
        <div className="mt-2">
          <button onClick={()=>setShowAttendees(!showAttendees)} className="flex items-center gap-2 text-xs font-semibold text-muted-foreground" data-testid={`button-toggle-attendees-${event.id}`}><Users className="w-3 h-3"/><span>{showAttendees?"Hide":"Show"} attendees ({totalRsvps})</span></button>
          {showAttendees && (
            <div className="mt-2 space-y-1" data-testid={`list-attendees-${event.id}`}>
              {attendees.length===0 ? <div className="text-xs text-muted-foreground py-2" data-testid={`text-no-attendees-${event.id}`}>No attendees yet</div> : attendees.map((a)=>(
                <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md" data-testid={`attendee-row-${a.id}`}>
                  {a.checkedIn?<Check className="w-3.5 h-3.5 text-[var(--terra)]" data-testid={`icon-checked-in-${a.id}`}/>:<Check className="w-3.5 h-3.5 text-muted-foreground/30" data-testid={`icon-not-checked-in-${a.id}`}/>}
                  <span className="text-xs text-foreground" data-testid={`text-attendee-name-${a.id}`}>{a.userName||"Anonymous"}</span>
                  {a.ticketTypeName && <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-1" style={{ background: "var(--terra-pale)", color: "var(--terra)" }} data-testid={`text-attendee-ticket-${a.id}`}>{a.ticketTypeName}</span>}
                  {a.checkedIn&&<span className="text-[10px] text-[var(--terra)] ml-auto" data-testid={`text-checkin-status-${a.id}`}>Checked in</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EventsTab({ clubId }: { clubId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [locationText, setLocationText] = useState("");
  const [maxCapacity, setMaxCapacity] = useState("20");
  const [recurrenceRule, setRecurrenceRule] = useState("none");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [duplicatingFrom, setDuplicatingFrom] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const { data: events = [], isLoading } = useQuery<(Event & { rsvpCount: number })[]>({
    queryKey: ["/api/clubs", clubId, "events"],
    queryFn: async () => { const res = await fetch(`/api/clubs/${clubId}/events`); if (!res.ok) return []; return res.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", `/api/clubs/${clubId}/events`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "events"] }); queryClient.invalidateQueries({ queryKey: ["/api/events"] }); resetForm(); setShowCreate(false); },
    onError: (err: Error) => setCreateError(err.message || "Failed to create event"),
  });

  const { toast } = useToast();

  const extendMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/clubs/${clubId}/events/${eventId}/extend-series`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: `Series extended — ${data.count} new instances scheduled` });
    },
    onError: () => toast({ title: "Failed to extend series", variant: "destructive" }),
  });

  const handleDuplicate = (event: Event & { rsvpCount: number }) => {
    setTitle(event.title); setDescription(event.description||""); setLocationText(event.locationText);
    setMaxCapacity(String(event.maxCapacity)); setStartsAt(""); setCreateError(""); setDuplicatingFrom(event.title);
    setRecurrenceRule(event.recurrenceRule || "none");
    setShowCreate(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleExtend = (event: Event & { rsvpCount: number }) => {
    extendMutation.mutate(event.id);
  };

  const resetForm = () => { setTitle(""); setDescription(""); setStartsAt(""); setLocationText(""); setMaxCapacity("20"); setRecurrenceRule("none"); setCoverImageUrl(null); setCreateError(""); setDuplicatingFrom(null); };

  if (isLoading) return <div className="space-y-3"><div className="h-12 rounded-md animate-pulse" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}}/>{[1,2].map(i=><div key={i} className="h-32 rounded-[18px] animate-pulse" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}}/>)}</div>;

  return (
    <div className="space-y-4" data-testid="section-organizer-events">
      <button onClick={() => { if(showCreate){resetForm();setShowCreate(false);}else{resetForm();setShowCreate(true);} }} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold" data-testid="button-create-event">{showCreate?"Cancel":"+ Create Event"}</button>

      {showCreate && (
        <div ref={formRef} className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 space-y-3" style={{ borderRadius: 18 }} data-testid="form-create-event">
          {duplicatingFrom && <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[var(--terra-pale)] border border-[rgba(196,98,45,0.3)]" data-testid="banner-duplicating"><div className="flex items-center gap-2 min-w-0"><Copy className="w-3.5 h-3.5 text-[var(--terra)] shrink-0"/><span className="text-xs font-medium text-[var(--terra)] truncate">Duplicating: {duplicatingFrom}</span></div><button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground shrink-0" data-testid="button-clear-duplicate">Clear</button></div>}
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Event Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Weekend Trek to Talakona" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-event-title"/></div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} placeholder="What's this event about?" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-event-desc"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Date & Time</label><input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-event-datetime"/></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Max Capacity</label><input type="number" value={maxCapacity} onChange={e=>setMaxCapacity(e.target.value)} min="2" max="500" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-event-capacity"/></div>
          </div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location</label><input value={locationText} onChange={e=>setLocationText(e.target.value)} placeholder="Sri Venkateswara University Ground" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-event-location"/></div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block flex items-center gap-1.5"><Repeat className="w-3 h-3"/>Repeat</label>
            <div className="flex gap-2 flex-wrap">{[["none","Once"],["weekly","Weekly"],["biweekly","Bi-weekly"],["monthly","Monthly"]].map(([val,label])=><button key={val} type="button" onClick={()=>setRecurrenceRule(val)} className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${recurrenceRule===val?"bg-[var(--terra-pale)] text-[var(--terra)] border-[rgba(196,98,45,0.4)]":"bg-[var(--warm-white)] border-[var(--warm-border)] text-muted-foreground"}`} data-testid={`button-recurrence-${val}`}>{label}</button>)}</div>
            {recurrenceRule!=="none"&&<p className="text-[11px] text-muted-foreground mt-1.5">We'll create 4 instances automatically</p>}
          </div>
          <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} label="Cover Photo (optional)"/>
          {createError&&<p className="text-xs text-destructive font-medium text-center" data-testid="text-event-error">{createError}</p>}
          <button onClick={()=>{if(!title.trim()||!startsAt||!locationText.trim())return;createMutation.mutate({title:title.trim(),description:description.trim(),startsAt,locationText:locationText.trim(),maxCapacity:parseInt(maxCapacity)||20,...(recurrenceRule!=="none"?{recurrenceRule}:{}),...(coverImageUrl?{coverImageUrl}:{})});}} disabled={createMutation.isPending||!title.trim()||!startsAt||!locationText.trim()} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-submit-event">{createMutation.isPending?"Creating...":"Create Event"}</button>
        </div>
      )}

      {events.length===0 ? <div className="text-center py-8 text-muted-foreground" data-testid="text-no-events">No events yet. Create one to engage your members!</div> : (
        <div className="space-y-2">{(()=>{
          const now=new Date(),todayStr=now.toDateString();
          const todayEvents=events.filter(e=>!e.isCancelled&&new Date(e.startsAt).toDateString()===todayStr);
          const otherEvents=events.filter(e=>e.isCancelled||new Date(e.startsAt).toDateString()!==todayStr);
          const grouped: { key: string; rule: string; label: string; events: typeof otherEvents }[]=[];
          const standalone: typeof otherEvents=[];
          const processed=new Set<string>();
          for(const ev of otherEvents){
            if(processed.has(ev.id))continue;
            if(ev.recurrenceRule){
              const siblings=otherEvents.filter(e=>e.title===ev.title&&e.recurrenceRule===ev.recurrenceRule&&!processed.has(e.id));
              if(siblings.length>1){
                const ruleLabel=ev.recurrenceRule==="weekly"?"Weekly":ev.recurrenceRule==="biweekly"?"Bi-weekly":"Monthly";
                grouped.push({key:`${ev.title}__${ev.recurrenceRule}`,rule:ev.recurrenceRule,label:`${ev.title} — ${ruleLabel} · ${siblings.length} instances`,events:siblings.sort((a,b)=>new Date(a.startsAt).getTime()-new Date(b.startsAt).getTime())});
                siblings.forEach(s=>processed.add(s.id));continue;
              }
            }
            standalone.push(ev);processed.add(ev.id);
          }
          return (<>{todayEvents.map(event=><EventTodayBanner key={`today-${event.id}`} event={event}/>)}{grouped.map(group=><RecurringEventGroup key={group.key} group={group} clubId={clubId} onDuplicate={handleDuplicate} onExtend={handleExtend} extendPending={extendMutation.isPending}/>)}{standalone.map(event=><EventCard key={event.id} event={event} clubId={clubId} onDuplicate={handleDuplicate}/>)}</>);
        })()}</div>
      )}
    </div>
  );
}
