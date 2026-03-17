import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Pin, Bell, Trash2 } from "lucide-react";
import type { ClubAnnouncement } from "@shared/schema";

export default function AnnouncementsTab({ clubId }: { clubId: string }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [notifyMembers, setNotifyMembers] = useState(true);

  const { data: announcements = [], isLoading } = useQuery<ClubAnnouncement[]>({
    queryKey: ["/api/organizer/clubs", clubId, "announcements"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/clubs/${clubId}/announcements`); return res.json(); },
  });

  const postMutation = useMutation({
    mutationFn: async (data: { title: string; body: string; isPinned: boolean; notifyMembers: boolean }) => { const res = await apiRequest("POST", `/api/organizer/clubs/${clubId}/announcements`, data); return res.json(); },
    onSuccess: () => { toast({ title: "Announcement posted!" }); setTitle(""); setBody(""); setIsPinned(false); queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "announcements"] }); queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "announcements"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/organizer/clubs/${clubId}/announcements/${id}`, {}); return res; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "announcements"] }); queryClient.invalidateQueries({ queryKey: ["/api/clubs", clubId, "announcements"] }); },
  });

  return (
    <div className="space-y-5" data-testid="section-announcements-manager">
      <div className="p-4 rounded-2xl space-y-3" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
        <div className="flex items-center gap-2 mb-1"><Megaphone className="w-4 h-4 text-[var(--terra)]"/><h3 className="font-display text-base font-bold text-[var(--ink)]">New Announcement</h3></div>
        <input type="text" placeholder="Title (e.g. Weekend trek is on!)" value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-announcement-title"/>
        <textarea placeholder="Write your message to all members..." value={body} onChange={e=>setBody(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-announcement-body"/>
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={()=>setIsPinned(!isPinned)} className={`w-9 h-5 rounded-full transition-all relative ${isPinned?"bg-[var(--terra)]":"bg-[var(--warm-border)]"}`} data-testid="toggle-pin-announcement">
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${isPinned?"left-4":"left-0.5"}`}/>
            </div>
            <span className="text-sm text-foreground flex items-center gap-1.5"><Pin className="w-3 h-3"/>Pin to club page</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={()=>setNotifyMembers(!notifyMembers)} className={`w-9 h-5 rounded-full transition-all relative ${notifyMembers?"bg-[var(--terra)]":"bg-[var(--warm-border)]"}`} data-testid="toggle-notify-members">
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${notifyMembers?"left-4":"left-0.5"}`}/>
            </div>
            <span className="text-sm text-foreground flex items-center gap-1.5"><Bell className="w-3 h-3"/>Notify all members</span>
          </label>
        </div>
        <button onClick={()=>postMutation.mutate({title,body,isPinned,notifyMembers})} disabled={postMutation.isPending||!title.trim()||!body.trim()} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-post-announcement">{postMutation.isPending?"Posting...":"Post Announcement"}</button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i=><div key={i} className="h-20 rounded-2xl animate-pulse" style={{background:"var(--warm-border)"}}/>)}</div>
      ) : announcements.length===0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-announcements">No announcements yet. Post your first one above!</div>
      ) : (
        <div className="space-y-2">
          {announcements.map(ann=>(
            <div key={ann.id} className="p-4 rounded-2xl" style={{background:"var(--warm-white)",border:"1.5px solid var(--warm-border)"}} data-testid={`card-announcement-${ann.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-sm text-[var(--ink)]" data-testid={`text-ann-title-${ann.id}`}>{ann.title}</span>
                    {ann.isPinned&&<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md" style={{background:"var(--terra-pale)",color:"var(--terra)"}}><Pin className="w-2.5 h-2.5"/>Pinned</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{ann.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-1">{ann.createdAt?new Date(ann.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):""}</div>
                </div>
                <button onClick={()=>deleteMutation.mutate(ann.id)} disabled={deleteMutation.isPending} className="w-8 h-8 rounded-lg flex items-center justify-center text-destructive transition-colors shrink-0" style={{background:"rgba(239,68,68,0.08)"}} data-testid={`button-delete-announcement-${ann.id}`}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
