import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/image-upload";
import { Loader2, MessageSquare, Plus, Users2, Banknote, Smartphone, CheckCircle2, ChevronDown } from "lucide-react";
import type { Club } from "@shared/schema";

function CoOrganiserSection({ club }: { club: Club }) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: coOrganisers = [], isLoading: loadingCo } = useQuery<{ userId: string; name: string; profileImageUrl: string | null }[]>({
    queryKey: ["/api/organizer/clubs", club.id, "co-organisers"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/co-organisers`); return res.json(); },
  });

  const { data: members = [] } = useQuery<{ id: string; userId: string; name: string; status: string }[]>({
    queryKey: ["/api/organizer/clubs", club.id, "members"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/members`); return res.json(); },
  });

  const coIds = new Set(coOrganisers.map(c => c.userId));
  const searchableMembers = members
    .filter(m => m.status==="approved" && m.userId && !coIds.has(m.userId) && m.userId!==club.creatorUserId)
    .filter(m => searchQuery.length>=2 && m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const addMutation = useMutation({
    mutationFn: async (userId: string) => { const res = await apiRequest("POST",`/api/organizer/clubs/${club.id}/co-organisers`,{userId}); return res.json(); },
    onSuccess: () => { setSearchQuery(""); queryClient.invalidateQueries({queryKey:["/api/organizer/clubs",club.id,"co-organisers"]}); toast({title:"Co-organiser added"}); },
    onError: () => toast({title:"Failed to add co-organiser",variant:"destructive"}),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => { const res = await apiRequest("DELETE",`/api/organizer/clubs/${club.id}/co-organisers/${userId}`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({queryKey:["/api/organizer/clubs",club.id,"co-organisers"]}); toast({title:"Co-organiser removed"}); },
    onError: () => toast({title:"Failed to remove co-organiser",variant:"destructive"}),
  });

  return (
    <div className="pt-2 border-t border-[var(--warm-border)]" data-testid="section-co-organisers">
      <div className="flex items-center gap-1.5 mb-3"><Users2 className="w-3.5 h-3.5 text-[var(--terra)]"/><span className="text-xs font-bold text-[var(--terra)] uppercase tracking-wider">Co-Organisers</span></div>
      <p className="text-[11px] text-muted-foreground mb-3">Add club members as co-organisers so they can help manage the dashboard.</p>

      {loadingCo ? <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground"/></div> : coOrganisers.length>0 ? (
        <div className="space-y-2 mb-3">{coOrganisers.map(co=>(
          <div key={co.userId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--warm-white)] border border-[var(--warm-border)]" data-testid={`co-organiser-${co.userId}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[var(--terra)]/10 flex items-center justify-center flex-shrink-0 overflow-hidden">{co.profileImageUrl?<img src={co.profileImageUrl} alt="" className="w-full h-full object-cover rounded-full"/>:<span className="text-xs font-bold text-[var(--terra)]">{co.name.charAt(0)}</span>}</div>
              <span className="text-sm font-medium text-foreground truncate">{co.name}</span>
            </div>
            <button onClick={()=>removeMutation.mutate(co.userId)} disabled={removeMutation.isPending} className="text-xs text-red-500 hover:text-red-700 font-medium flex-shrink-0" data-testid={`button-remove-co-${co.userId}`}>Remove</button>
          </div>
        ))}</div>
      ) : <p className="text-xs text-muted-foreground mb-3 italic">No co-organisers yet</p>}

      <div className="relative">
        <input type="text" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search members to add..." className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-search-co-organiser"/>
        {searchableMembers.length>0&&<div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[var(--warm-border)] rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">{searchableMembers.map(m=><button key={m.userId} onClick={()=>addMutation.mutate(m.userId)} disabled={addMutation.isPending} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--cream)] transition-colors" data-testid={`button-add-co-${m.userId}`}><Plus className="w-3.5 h-3.5 text-[var(--terra)]"/><span className="font-medium">{m.name}</span></button>)}</div>}
        {searchQuery.length>=2&&searchableMembers.length===0&&<p className="text-[11px] text-muted-foreground mt-1">No matching members found</p>}
      </div>
    </div>
  );
}

interface PayoutSetup {
  payoutsEnabled: boolean;
  payoutMethod: string;
  bankAccountName?: string | null;
  maskedAccountNumber?: string | null;
  maskedIfsc?: string | null;
  maskedUpiId?: string | null;
  payoutConfigured: boolean;
}

function PayoutSettingsCard({ club }: { club: Club }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"bank" | "upi">("bank");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upiId, setUpiId] = useState("");

  const { data: payout, isLoading } = useQuery<PayoutSetup>({
    queryKey: ["/api/organizer/clubs", club.id, "payout-setup"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/organizer/clubs/${club.id}/payout-setup`);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (method === "bank") {
        if (!bankName.trim() || !accountNumber.trim() || !ifsc.trim()) throw new Error("All bank fields are required");
        if (accountNumber !== confirmAccountNumber) throw new Error("Account numbers do not match");
      } else {
        if (!upiId.trim()) throw new Error("UPI ID is required");
      }
      const payload = method === "bank"
        ? { payoutMethod: "bank", bankAccountName: bankName.trim(), bankAccountNumber: accountNumber.trim(), bankIfsc: ifsc.trim() }
        : { payoutMethod: "upi", upiId: upiId.trim() };
      const res = await apiRequest("POST", `/api/organizer/clubs/${club.id}/payout-setup`, payload);
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error(e.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizer/clubs", club.id, "payout-setup"] });
      toast({ title: "Payout settings saved!" });
      setOpen(false);
      setAccountNumber("");
      setConfirmAccountNumber("");
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="rounded-[18px] overflow-hidden" style={{ border: "1.5px solid var(--warm-border)" }} data-testid="card-payout-settings">
      {!isLoading && !payout?.payoutConfigured && (
        <div className="flex items-start gap-2 px-4 py-3" style={{ background: "#fef3c7", borderBottom: "1.5px solid #fde68a" }}>
          <span className="text-amber-700 text-lg leading-none mt-0.5">⚠</span>
          <div>
            <div className="text-xs font-bold text-amber-800">Payout not set up</div>
            <div className="text-[11px] text-amber-700">Set up your bank account or UPI to receive earnings from paid events.</div>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3" style={{ background: "var(--warm-white)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-[var(--terra)]" />
          <span className="text-sm font-bold text-[var(--ink)]">Payout Settings</span>
        </div>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--muted-warm)]" />
        ) : payout?.payoutConfigured ? (
          <span className="flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        ) : (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Not set up</span>
        )}
      </div>

      {payout?.payoutConfigured && !open && (
        <div className="text-xs space-y-0.5" style={{ color: "var(--muted-warm)" }}>
          {payout.payoutMethod === "bank" ? (
            <>
              <div>Account: <span className="font-semibold text-[var(--ink)]">{payout.bankAccountName}</span></div>
              <div>Number: <span className="font-mono">{payout.maskedAccountNumber}</span></div>
              <div>IFSC: <span className="font-mono">{payout.maskedIfsc}</span></div>
            </>
          ) : (
            <div>UPI: <span className="font-semibold text-[var(--ink)]">{payout.maskedUpiId}</span></div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: "var(--terra)" }}
        data-testid="button-toggle-payout-form"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {payout?.payoutConfigured ? "Update payout details" : "Set up payouts"}
      </button>

      {open && (
        <div className="space-y-3 pt-2" style={{ borderTop: "1px solid var(--warm-border)" }}>
          <div className="flex rounded-lg overflow-hidden border-[1.5px] border-[var(--warm-border)]">
            <button
              onClick={() => setMethod("bank")}
              className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${method === "bank" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
              data-testid="button-payout-method-bank"
            >
              <Banknote className="w-3.5 h-3.5" /> Bank Account
            </button>
            <button
              onClick={() => setMethod("upi")}
              className={`flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${method === "upi" ? "bg-[var(--terra)] text-white" : "bg-[var(--warm-white)] text-[var(--muted-warm)]"}`}
              data-testid="button-payout-method-upi"
            >
              <Smartphone className="w-3.5 h-3.5" /> UPI
            </button>
          </div>

          {method === "bank" ? (
            <div className="space-y-2">
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="Account holder name"
                className="w-full px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--cream)]"
                data-testid="input-bank-name"
              />
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="Account number"
                className="w-full px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--cream)] font-mono"
                data-testid="input-account-number"
              />
              <div>
                <input
                  type="text"
                  value={confirmAccountNumber}
                  onChange={e => setConfirmAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="Confirm account number"
                  className={`w-full px-3 py-2 rounded-lg text-sm border-[1.5px] focus:outline-none bg-[var(--cream)] font-mono ${confirmAccountNumber && accountNumber !== confirmAccountNumber ? "border-red-400" : "border-[var(--warm-border)]"}`}
                  data-testid="input-confirm-account-number"
                />
                {confirmAccountNumber && accountNumber !== confirmAccountNumber && (
                  <p className="text-[11px] text-red-600 mt-0.5">Account numbers do not match</p>
                )}
              </div>
              <input
                type="text"
                value={ifsc}
                onChange={e => setIfsc(e.target.value.toUpperCase())}
                placeholder="IFSC code (e.g. SBIN0001234)"
                className="w-full px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--cream)] font-mono"
                data-testid="input-ifsc"
              />
            </div>
          ) : (
            <input
              type="text"
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="your@upi or number@bank"
              className="w-full px-3 py-2 rounded-lg text-sm border-[1.5px] border-[var(--warm-border)] focus:outline-none bg-[var(--cream)]"
              data-testid="input-upi-id"
            />
          )}

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (method === "bank" && accountNumber !== confirmAccountNumber)}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            style={{ background: "var(--ink)" }}
            data-testid="button-save-payout"
          >
            {saveMutation.isPending ? "Saving..." : "Save Payout Details"}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

export default function EditTab({ club }: { club: Club }) {
  const [shortDesc, setShortDesc] = useState(club.shortDesc);
  const [fullDesc, setFullDesc] = useState(club.fullDesc || "");
  const [organizerName, setOrganizerName] = useState(club.organizerName || "");
  const [whatsappNumber, setWhatsappNumber] = useState(club.whatsappNumber || "");
  const [schedule, setSchedule] = useState(club.schedule);
  const [location, setLocation] = useState(club.location);
  const [joinQuestion1, setJoinQuestion1] = useState((club as any).joinQuestion1 || "");
  const [joinQuestion2, setJoinQuestion2] = useState((club as any).joinQuestion2 || "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(club.coverImageUrl ?? null);
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("PATCH", `/api/organizer/club/${club.id}`, data); return res.json(); },
    onSuccess: () => { setSaved(true); setTimeout(()=>setSaved(false),2000); queryClient.invalidateQueries({queryKey:["/api/clubs"]}); queryClient.invalidateQueries({queryKey:["/api/organizer/my-clubs"]}); },
  });

  return (
    <div className="space-y-4" data-testid="section-edit-club">
      <ImageUpload value={coverImageUrl} onChange={setCoverImageUrl} label="Club Cover Photo"/>
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Short Description</label><textarea value={shortDesc} onChange={e=>setShortDesc(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-edit-shortdesc"/></div>
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Description</label><textarea value={fullDesc} onChange={e=>setFullDesc(e.target.value)} rows={5} placeholder="Write a detailed description of your club..." className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30 resize-none" data-testid="input-edit-fulldesc"/><p className="text-[11px] text-muted-foreground mt-1">Shown on your club's detail page.</p></div>
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Organizer Name</label><input type="text" value={organizerName} onChange={e=>setOrganizerName(e.target.value)} placeholder="Your name as the organizer" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-organizer-name"/></div>
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">WhatsApp Number</label><input type="tel" value={whatsappNumber} onChange={e=>setWhatsappNumber(e.target.value)} placeholder="e.g. +91 98765 43210" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-whatsapp"/><p className="text-[11px] text-muted-foreground mt-1">Members can reach you on WhatsApp.</p></div>
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Schedule</label><input type="text" value={schedule} onChange={e=>setSchedule(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-schedule"/></div>
        <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location</label><input type="text" value={location} onChange={e=>setLocation(e.target.value)} className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-location"/></div>
        <div className="pt-2 border-t border-[var(--warm-border)]">
          <div className="flex items-center gap-1.5 mb-3"><MessageSquare className="w-3.5 h-3.5 text-[var(--terra)]"/><span className="text-xs font-bold text-[var(--terra)] uppercase tracking-wider">Join Questions</span></div>
          <p className="text-[11px] text-muted-foreground mb-3">Applicants will see these when requesting to join.</p>
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Question 1 (optional)</label><input type="text" value={joinQuestion1} onChange={e=>setJoinQuestion1(e.target.value)} placeholder="What's your experience level?" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-join-q1"/></div>
            <div><label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Question 2 (optional)</label><input type="text" value={joinQuestion2} onChange={e=>setJoinQuestion2(e.target.value)} placeholder="How did you hear about us?" className="w-full px-4 py-3 rounded-md border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30" data-testid="input-edit-join-q2"/></div>
          </div>
        </div>
      </div>
      <button onClick={()=>updateMutation.mutate({shortDesc,fullDesc,organizerName,whatsappNumber,schedule,location,joinQuestion1:joinQuestion1.trim()||null,joinQuestion2:joinQuestion2.trim()||null,coverImageUrl:coverImageUrl??null})} disabled={updateMutation.isPending} className="w-full bg-[var(--terra)] text-white rounded-md py-3 text-sm font-semibold disabled:opacity-50" data-testid="button-save-club">{updateMutation.isPending?"Saving...":saved?"Saved":"Save Changes"}</button>
      <PayoutSettingsCard club={club} />
      <CoOrganiserSection club={club}/>
    </div>
  );
}
