import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Users, Download, Calendar, CheckCircle2, Medal, Loader2, UserMinus } from "lucide-react";

type EnrichedMember = {
  id: string;
  userId: string | null;
  name: string;
  phone: string;
  profileImageUrl: string | null;
  bio: string | null;
  city: string | null;
  joinedAt: string | null;
  isFoundingMember: boolean | null;
  eventsAttended: number;
};

export default function MembersTab({ clubId }: { clubId: string }) {
  const [search, setSearch] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: members = [], isLoading } = useQuery<EnrichedMember[]>({
    queryKey: ["/api/organizer/clubs", clubId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${clubId}/members`);
      return res.json();
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("DELETE", `/api/organizer/clubs/${clubId}/members/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", clubId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/join-requests", clubId] });
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/my-clubs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clubs"] });
      setRemovingId(null);
      toast({ title: "Member removed" });
    },
  });

  const filtered = search.trim()
    ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : members;

  const handleDownloadCsv = () => {
    if (members.length === 0) return;
    const header = ["Name", "Phone", "Join Date", "Founding Member", "Events Attended"];
    const rows = members.map(m => [
      `"${(m.name || "").replace(/"/g, '""')}"`,
      `"${(m.phone || "").replace(/"/g, '""')}"`,
      m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "",
      m.isFoundingMember ? "Yes" : "No",
      String(m.eventsAttended),
    ]);
    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 rounded-[18px] animate-pulse" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }} />
      ))}
    </div>
  );

  return (
    <div className="space-y-4" data-testid="section-organizer-members">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30"
            data-testid="input-search-members"
          />
        </div>
        {members.length > 0 && (
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[var(--terra)] text-white shrink-0"
            data-testid="button-download-members-csv"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground font-medium" data-testid="text-member-count">
        {members.length} member{members.length !== 1 ? "s" : ""}{search.trim() && ` · ${filtered.length} shown`}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-members">
          {search.trim() ? "No members match your search" : "No approved members yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(member => (
            <div
              key={member.id}
              className="p-4 bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)]"
              style={{ borderRadius: 18 }}
              data-testid={`card-member-${member.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--cream)] flex items-center justify-center shrink-0">
                  {member.profileImageUrl ? (
                    <img src={member.profileImageUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground" data-testid={`text-member-name-${member.id}`}>{member.name}</span>
                    {member.isFoundingMember && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md" style={{ background: "rgba(196,98,45,0.12)", color: "var(--terra)" }} data-testid={`badge-founding-${member.id}`}>
                        <Medal className="w-2.5 h-2.5" />
                        Founding
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{member.phone}</div>
                  {member.city && <div className="text-[11px] text-muted-foreground mt-0.5">{member.city}</div>}
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {member.eventsAttended} event{member.eventsAttended !== 1 ? "s" : ""} attended
                    </span>
                  </div>
                </div>
                <div className="shrink-0">
                  {removingId === member.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeMutation.mutate(member.id)}
                        disabled={removeMutation.isPending}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-destructive text-white disabled:opacity-50"
                        data-testid={`button-confirm-remove-${member.id}`}
                      >
                        {removeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Remove"}
                      </button>
                      <button
                        onClick={() => setRemovingId(null)}
                        className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--cream)] text-muted-foreground"
                        data-testid={`button-cancel-remove-${member.id}`}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRemovingId(member.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-destructive/10 text-destructive inline-flex items-center gap-1"
                      data-testid={`button-remove-member-${member.id}`}
                    >
                      <UserMinus className="w-3 h-3" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
