import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ImageUpload } from "@/components/image-upload";
import { Calendar, Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { ClubFaq, ClubScheduleEntry, ClubMoment } from "@shared/schema";

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MOMENT_ICONS = [{label:"Star",icon:"star"},{label:"Fire",icon:"fire"},{label:"Heart",icon:"heart"},{label:"Trophy",icon:"trophy"},{label:"Camera",icon:"camera"},{label:"Mountain",icon:"mountain"},{label:"Music",icon:"music"},{label:"Book",icon:"book"}];

function FaqsManager({ clubId }: { clubId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const { data: faqs = [], isLoading } = useQuery<ClubFaq[]>({
    queryKey: ["/api/clubs", clubId, "faqs"],
    queryFn: async () => { const res = await fetch(`/api/clubs/${clubId}/faqs`); if (!res.ok) return []; return res.json(); },
  });
  const createMutation = useMutation({ mutationFn: async (data: {question:string;answer:string}) => { const res = await apiRequest("POST",`/api/clubs/${clubId}/faqs`,data); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"faqs"]}); resetForm(); } });
  const updateMutation = useMutation({ mutationFn: async ({id,data}:{id:string;data:{question:string;answer:string}}) => { const res = await apiRequest("PATCH",`/api/clubs/${clubId}/faqs/${id}`,data); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"faqs"]}); resetForm(); } });
  const deleteMutation = useMutation({ mutationFn: async (id:string) => { await apiRequest("DELETE",`/api/clubs/${clubId}/faqs/${id}`); }, onSuccess: () => queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"faqs"]}) });

  const resetForm = () => { setQuestion(""); setAnswer(""); setEditingId(null); setShowForm(false); };
  const startEdit = (faq: ClubFaq) => { setQuestion(faq.question); setAnswer(faq.answer); setEditingId(faq.id); setShowForm(true); };
  const handleSubmit = () => { if (!question.trim()||!answer.trim()) return; if (editingId) { updateMutation.mutate({id:editingId,data:{question:question.trim(),answer:answer.trim()}}); } else { createMutation.mutate({question:question.trim(),answer:answer.trim()}); } };

  if (isLoading) return <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-20 rounded-[18px] animate-pulse" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}}/>)}</div>;

  return (
    <div className="space-y-3" data-testid="section-faqs-manager">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display text-base font-bold text-[var(--terra)]">FAQs</h3>
        <button onClick={() => {if(showForm)resetForm();else setShowForm(true);}} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--terra)] text-white" data-testid="button-add-faq"><Plus className="w-3 h-3"/>{showForm?"Cancel":"Add FAQ"}</button>
      </div>
      {showForm && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 space-y-3" style={{borderRadius:18}} data-testid="form-faq">
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Question</label><input type="text" placeholder="e.g. What should I bring?" value={question} onChange={e=>setQuestion(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-faq-question"/></div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Answer</label><textarea placeholder="Write the answer..." value={answer} onChange={e=>setAnswer(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-faq-answer"/></div>
          <button onClick={handleSubmit} disabled={createMutation.isPending||updateMutation.isPending||!question.trim()||!answer.trim()} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-submit-faq">{createMutation.isPending||updateMutation.isPending?"Saving...":editingId?"Update FAQ":"Add FAQ"}</button>
        </div>
      )}
      {faqs.length===0 ? <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-faqs">No FAQs yet. Add some to help members!</div> : (
        <div className="space-y-2">{faqs.map(faq=>(
          <div key={faq.id} className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{borderRadius:18}} data-testid={`faq-item-${faq.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0"><div className="font-semibold text-sm text-foreground" data-testid={`text-faq-question-${faq.id}`}>{faq.question}</div><div className="text-xs text-muted-foreground mt-1" data-testid={`text-faq-answer-${faq.id}`}>{faq.answer}</div></div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={()=>startEdit(faq)} className="p-1.5 rounded-md text-muted-foreground" data-testid={`button-edit-faq-${faq.id}`}><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={()=>deleteMutation.mutate(faq.id)} disabled={deleteMutation.isPending} className="p-1.5 rounded-md text-destructive" data-testid={`button-delete-faq-${faq.id}`}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function ScheduleManager({ clubId }: { clubId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState("Monday");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [activity, setActivity] = useState("");
  const [location, setLocation] = useState("");

  const { data: entries = [], isLoading } = useQuery<ClubScheduleEntry[]>({
    queryKey: ["/api/clubs", clubId, "schedule"],
    queryFn: async () => { const res = await fetch(`/api/clubs/${clubId}/schedule`); if (!res.ok) return []; return res.json(); },
  });
  const createMutation = useMutation({ mutationFn: async (data: any) => { const res = await apiRequest("POST",`/api/clubs/${clubId}/schedule`,data); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"schedule"]}); resetForm(); } });
  const updateMutation = useMutation({ mutationFn: async ({id,data}:{id:string;data:any}) => { const res = await apiRequest("PATCH",`/api/clubs/${clubId}/schedule/${id}`,data); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"schedule"]}); resetForm(); } });
  const deleteMutation = useMutation({ mutationFn: async (id:string) => { await apiRequest("DELETE",`/api/clubs/${clubId}/schedule/${id}`); }, onSuccess: () => queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"schedule"]}) });

  const resetForm = () => { setDayOfWeek("Monday"); setStartTime(""); setEndTime(""); setActivity(""); setLocation(""); setEditingId(null); setShowForm(false); };
  const startEdit = (entry: ClubScheduleEntry) => { setDayOfWeek(entry.dayOfWeek); setStartTime(entry.startTime); setEndTime(entry.endTime||""); setActivity(entry.activity); setLocation(entry.location||""); setEditingId(entry.id); setShowForm(true); };
  const handleSubmit = () => { if(!startTime.trim()||!activity.trim())return; const data={dayOfWeek,startTime:startTime.trim(),endTime:endTime.trim(),activity:activity.trim(),location:location.trim()}; if(editingId){updateMutation.mutate({id:editingId,data});}else{createMutation.mutate(data);} };

  if (isLoading) return <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-20 rounded-[18px] animate-pulse" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}}/>)}</div>;

  return (
    <div className="space-y-3" data-testid="section-schedule-manager">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display text-base font-bold text-[var(--terra)]">Schedule</h3>
        <button onClick={()=>{if(showForm)resetForm();else setShowForm(true);}} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--terra)] text-white" data-testid="button-add-schedule"><Plus className="w-3 h-3"/>{showForm?"Cancel":"Add Entry"}</button>
      </div>
      {showForm && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 space-y-3" style={{borderRadius:18}} data-testid="form-schedule">
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Day of Week</label><select value={dayOfWeek} onChange={e=>setDayOfWeek(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="select-schedule-day">{DAYS_OF_WEEK.map(day=><option key={day} value={day}>{day}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start Time</label><input type="text" placeholder="e.g. 5:30 AM" value={startTime} onChange={e=>setStartTime(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-schedule-start"/></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">End Time</label><input type="text" placeholder="e.g. 7:30 AM" value={endTime} onChange={e=>setEndTime(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-schedule-end"/></div>
          </div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Activity</label><input type="text" placeholder="e.g. Morning Trek" value={activity} onChange={e=>setActivity(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-schedule-activity"/></div>
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location</label><input type="text" placeholder="e.g. University Ground" value={location} onChange={e=>setLocation(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-schedule-location"/></div>
          <button onClick={handleSubmit} disabled={createMutation.isPending||updateMutation.isPending||!startTime.trim()||!activity.trim()} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-submit-schedule">{createMutation.isPending||updateMutation.isPending?"Saving...":editingId?"Update Entry":"Add Entry"}</button>
        </div>
      )}
      {entries.length===0 ? <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-schedule">No schedule entries yet. Add your club's weekly schedule!</div> : (
        <div className="space-y-2">{entries.map(entry=>(
          <div key={entry.id} className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{borderRadius:18}} data-testid={`schedule-item-${entry.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-foreground" data-testid={`text-schedule-activity-${entry.id}`}>{entry.activity}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/>{entry.dayOfWeek}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{entry.startTime}{entry.endTime?` - ${entry.endTime}`:""}</span>
                  {entry.location&&<span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{entry.location}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={()=>startEdit(entry)} className="p-1.5 rounded-md text-muted-foreground" data-testid={`button-edit-schedule-${entry.id}`}><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={()=>deleteMutation.mutate(entry.id)} disabled={deleteMutation.isPending} className="p-1.5 rounded-md text-destructive" data-testid={`button-delete-schedule-${entry.id}`}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

function MomentsManager({ clubId }: { clubId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("");
  const [momentImageUrl, setMomentImageUrl] = useState<string | null>(null);

  const { data: moments = [], isLoading } = useQuery<ClubMoment[]>({
    queryKey: ["/api/clubs", clubId, "moments"],
    queryFn: async () => { const res = await fetch(`/api/clubs/${clubId}/moments`); if (!res.ok) return []; return res.json(); },
  });
  const createMutation = useMutation({ mutationFn: async (data: {caption:string;emoji?:string}) => { const res = await apiRequest("POST",`/api/clubs/${clubId}/moments`,{caption:data.caption,emoji:data.emoji,imageUrl:momentImageUrl??undefined}); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"moments"]}); queryClient.invalidateQueries({queryKey:["/api/feed"]}); resetForm(); } });
  const updateMutation = useMutation({ mutationFn: async ({id,data}:{id:string;data:{caption:string;emoji?:string}}) => { const res = await apiRequest("PATCH",`/api/clubs/${clubId}/moments/${id}`,data); return res.json(); }, onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"moments"]}); resetForm(); } });
  const deleteMutation = useMutation({ mutationFn: async (id:string) => { await apiRequest("DELETE",`/api/clubs/${clubId}/moments/${id}`); }, onSuccess: () => queryClient.invalidateQueries({queryKey:["/api/clubs",clubId,"moments"]}) });

  const resetForm = () => { setCaption(""); setSelectedIcon(""); setMomentImageUrl(null); setEditingId(null); setShowForm(false); };
  const startEdit = (moment: ClubMoment) => { setCaption(moment.caption); setSelectedIcon(moment.emoji||""); setMomentImageUrl(null); setEditingId(moment.id); setShowForm(true); };
  const handleSubmit = () => { if(!caption.trim())return; if(editingId){updateMutation.mutate({id:editingId,data:{caption:caption.trim(),emoji:selectedIcon||undefined}});}else{createMutation.mutate({caption:caption.trim(),emoji:selectedIcon||undefined});} };
  const formatRelativeTime = (dateStr: string | Date | null) => { if(!dateStr)return""; const date=new Date(dateStr),now=new Date(),diffMs=now.getTime()-date.getTime(),diffMins=Math.floor(diffMs/60000); if(diffMins<1)return"Just now"; if(diffMins<60)return`${diffMins}m ago`; const diffHours=Math.floor(diffMins/60); if(diffHours<24)return`${diffHours}h ago`; const diffDays=Math.floor(diffHours/24); if(diffDays<7)return`${diffDays}d ago`; return date.toLocaleDateString("en-IN",{day:"numeric",month:"short"}); };

  if (isLoading) return <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-20 rounded-[18px] animate-pulse" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}}/>)}</div>;

  return (
    <div className="space-y-3" data-testid="section-moments-manager">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display text-base font-bold text-[var(--terra)]">Moments</h3>
        <button onClick={()=>{if(showForm)resetForm();else setShowForm(true);}} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-[var(--terra)] text-white" data-testid="button-add-moment"><Plus className="w-3 h-3"/>{showForm?"Cancel":"Add Moment"}</button>
      </div>
      {showForm && (
        <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4 space-y-3" style={{borderRadius:18}} data-testid="form-moment">
          <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Caption</label><textarea placeholder="Share a highlight or moment..." value={caption} onChange={e=>setCaption(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-moment-caption"/></div>
          {!editingId&&<ImageUpload value={momentImageUrl} onChange={setMomentImageUrl} label="Photo (optional)"/>}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Icon (optional)</label>
            <div className="flex gap-2 flex-wrap">{MOMENT_ICONS.map(item=><button key={item.icon} onClick={()=>setSelectedIcon(selectedIcon===item.icon?"":item.icon)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${selectedIcon===item.icon?"bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]":"bg-[var(--cream)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`} data-testid={`button-icon-${item.icon}`}>{item.label}</button>)}</div>
          </div>
          <button onClick={handleSubmit} disabled={createMutation.isPending||updateMutation.isPending||!caption.trim()} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-submit-moment">{createMutation.isPending||updateMutation.isPending?"Saving...":editingId?"Update Moment":"Post Moment"}</button>
        </div>
      )}
      {moments.length===0 ? <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-moments">No moments yet. Share highlights from your club!</div> : (
        <div className="space-y-2">{moments.map(moment=>(
          <div key={moment.id} className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] p-4" style={{borderRadius:18}} data-testid={`moment-item-${moment.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {moment.emoji&&<span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--terra-pale)] text-[var(--terra)]" data-testid={`text-moment-icon-${moment.id}`}>{moment.emoji}</span>}
                  <span className="text-[11px] text-muted-foreground" data-testid={`text-moment-time-${moment.id}`}>{formatRelativeTime(moment.createdAt)}</span>
                </div>
                <p className="text-sm text-foreground mt-1.5" data-testid={`text-moment-caption-${moment.id}`}>{moment.caption}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={()=>startEdit(moment)} className="p-1.5 rounded-md text-muted-foreground" data-testid={`button-edit-moment-${moment.id}`}><Pencil className="w-3.5 h-3.5"/></button>
                <button onClick={()=>deleteMutation.mutate(moment.id)} disabled={deleteMutation.isPending} className="p-1.5 rounded-md text-destructive" data-testid={`button-delete-moment-${moment.id}`}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

export default function ContentTab({ clubId, initialSection = "faqs" }: { clubId: string; initialSection?: "faqs" | "schedule" | "moments" }) {
  const [activeSection, setActiveSection] = useState<"faqs" | "schedule" | "moments">(initialSection);
  const sections: { key: "faqs" | "schedule" | "moments"; label: string }[] = [{ key:"faqs",label:"FAQs"},{key:"schedule",label:"Schedule"},{key:"moments",label:"Moments"}];
  return (
    <div className="space-y-4" data-testid="section-content-manager">
      <div className="flex gap-2 flex-wrap">
        {sections.map(({key,label})=>(
          <button key={key} onClick={()=>setActiveSection(key)} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeSection===key?"bg-[var(--terra-pale)] text-[var(--terra)] border-[1.5px] border-[rgba(196,98,45,0.3)]":"bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] text-muted-foreground"}`} style={{borderRadius:18}} data-testid={`tab-content-${key}`}>{label}</button>
        ))}
      </div>
      {activeSection==="faqs"&&<FaqsManager clubId={clubId}/>}
      {activeSection==="schedule"&&<ScheduleManager clubId={clubId}/>}
      {activeSection==="moments"&&<MomentsManager clubId={clubId}/>}
    </div>
  );
}
