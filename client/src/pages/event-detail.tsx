import { useState, useRef, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Calendar, MapPin, Users, Share2, CheckCircle2, ExternalLink, Ticket, Crown, AlertCircle, MessageCircle, Send, Repeat, ClipboardList, Loader2, Plus, IndianRupee, CreditCard, Ban } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event, Club, EventRsvp, EventComment, EventFormQuestion, EventTicketType } from "@shared/schema";
import { loadRazorpay, openRazorpayCheckout, type RazorpayOrderDetails } from "@/lib/razorpay";
import { useToast } from "@/hooks/use-toast";

interface RsvpWithUser extends EventRsvp {
  userName: string | null;
}

interface EventDetailResponse extends Event {
  rsvps: RsvpWithUser[];
  club: Club | null;
  waitlistCount?: number;
  myRsvp?: EventRsvp | null;
}

function handleShareEvent(event: Event, clubName: string) {
  const url = `${window.location.origin}/event/${event.id}`;
  const text = `Check out ${event.title} by ${clubName} on CultFam! ${url}`;

  if (navigator.share) {
    navigator.share({ title: event.title, text: `Check out ${event.title} by ${clubName} on CultFam!`, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

function handleShareAfterRsvp(event: Event, clubName: string) {
  const url = `${window.location.origin}/event/${event.id}`;
  const text = `I'm going to ${event.title} with ${clubName}! Join me: ${url}`;

  if (navigator.share) {
    navigator.share({ title: event.title, text: `I'm going to ${event.title} with ${clubName}! Join me`, url }).catch(() => {});
  } else {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
}

const AVATAR_COLORS = [
  { bg: 'linear-gradient(135deg, #E8D5B8, #C4A882)' },
  { bg: 'linear-gradient(135deg, #B8D4E8, #82A8C4)' },
  { bg: 'linear-gradient(135deg, #D4B8E8, #A882C4)' },
  { bg: 'linear-gradient(135deg, #B8E8C8, #82C498)' },
];

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [justRsvpd, setJustRsvpd] = useState(false);
  const [justWaitlisted, setJustWaitlisted] = useState<number | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState<RazorpayOrderDetails | null>(null);

  useEffect(() => { loadRazorpay().catch((err) => { console.error("[payment] Razorpay failed to preload:", err); }); }, []);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [pendingFormQuestions, setPendingFormQuestions] = useState<EventFormQuestion[]>([]);
  const [pendingFormMandatory, setPendingFormMandatory] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});

  const { data: eventData, isLoading, error } = useQuery<EventDetailResponse>({
    queryKey: ["/api/events", id],
  });

  const clubId = eventData?.club?.id;
  const { data: joinStatusData } = useQuery<{ status: string | null }>({
    queryKey: ["/api/clubs", clubId, "join-status"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/clubs/${clubId}/join-status`);
      return res.json();
    },
    enabled: !!clubId && isAuthenticated && !isLoading,
  });

  const isClubCreator = eventData?.club?.creatorUserId === user?.id;
  const isCoOrganiser = !!(user?.id && eventData?.club?.coOrganiserUserIds?.includes(user.id));
  const isOrganizerOrAdmin = isClubCreator || isCoOrganiser;
  const isClubMemberFromStatus = isClubCreator || joinStatusData?.status === "approved";

  const { data: comments = [] } = useQuery<EventComment[]>({
    queryKey: ["/api/events", id, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${id}/comments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/events/${id}/comments`, { text });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", id, "comments"] });
      setCommentText("");
    },
  });

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<number | null>(null);
  const pendingTicketTypeIdRef = useRef<number | null>(null);

  const { data: ticketTypes = [] } = useQuery<EventTicketType[]>({
    queryKey: ["/api/events", id, "tickets"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${id}/tickets`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const [formLoading, setFormLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const pendingOrderRef = useRef<RazorpayOrderDetails | null>(null);

  const rsvpMutation = useMutation({
    mutationFn: async (formResponses?: { questionId: string; answer: string }[]) => {
      const ticketTypeId = pendingTicketTypeIdRef.current;
      const body: Record<string, unknown> = {};
      if (ticketTypeId !== null) body.ticketTypeId = ticketTypeId;
      if (formResponses && formResponses.length > 0) body.formResponses = formResponses;
      const res = await apiRequest("POST", `/api/events/${id}/rsvp`, Object.keys(body).length > 0 ? body : undefined);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "RSVP failed" }));
        throw new Error(data.message || "RSVP failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.requiresForm) {
        setPendingFormQuestions(data.questions ?? []);
        setPendingFormMandatory(true);
        setFormAnswers({});
        setShowSurveyModal(true);
        return;
      }
      if (data.rsvp?.id && data.rsvp?.checkinToken) {
        localStorage.setItem(`ticket-token-${data.rsvp.id}`, data.rsvp.checkinToken);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/events", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setRsvpError(null);
      setShowSurveyModal(false);
      if (data.waitlisted) {
        setJustWaitlisted(data.position ?? 1);
      } else if (!data.alreadyRsvpd) {
        setJustRsvpd(true);
      }
    },
    onError: (err: Error) => {
      setRsvpError(err.message);
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, orderId, signature, formResponses }: {
      paymentId: string;
      orderId: string;
      signature: string;
      formResponses?: { questionId: string; answer: string }[];
    }) => {
      const res = await apiRequest("POST", `/api/payments/verify`, {
        eventId: id,
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        razorpaySignature: signature,
        formResponses,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: "Payment verification failed" }));
        throw new Error(data.message || "Payment verification failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.rsvp?.id && data.rsvp?.checkinToken) {
        localStorage.setItem(`ticket-token-${data.rsvp.id}`, data.rsvp.checkinToken);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/events", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setRsvpError(null);
      setShowSurveyModal(false);
      if (!data.alreadyRsvpd) {
        setJustRsvpd(true);
      }
    },
    onError: (err: Error) => {
      toast({ title: "Payment verification failed", description: "Your payment may have gone through. Please contact support if you were charged.", variant: "destructive" });
      setRsvpError("Payment verification failed — please contact support if you were charged.");
    },
  });

  const openPaymentModal = async (order: RazorpayOrderDetails, formResponses?: { questionId: string; answer: string }[]) => {
    setPaymentLoading(true);
    try {
      await openRazorpayCheckout({
        order,
        userEmail: user?.email ?? undefined,
        userName: user?.firstName ?? undefined,
        onSuccess: (paymentId, orderId, signature) => {
          verifyPaymentMutation.mutate({ paymentId, orderId, signature, formResponses });
        },
        onDismiss: () => {
          toast({ title: "Payment cancelled", description: "You can try again whenever you're ready.", variant: "destructive" });
        },
      });
    } catch (err: any) {
      toast({ title: "Payment error", description: err.message || "Failed to open payment. Please try again.", variant: "destructive" });
    } finally {
      setPaymentLoading(false);
    }
  };

  const proceedWithForm = async (preloadedOrder?: RazorpayOrderDetails) => {
    setFormLoading(true);
    try {
      const res = await fetch(`/api/events/${id}/form`);
      const formData: { formMandatory: boolean; questions: EventFormQuestion[] } = await res.json();
      if (formData.questions.length > 0) {
        setPendingFormQuestions(formData.questions);
        setPendingFormMandatory(formData.formMandatory);
        setFormAnswers({});
        if (preloadedOrder) pendingOrderRef.current = preloadedOrder;
        setShowSurveyModal(true);
      } else {
        if (preloadedOrder) {
          setShowSurveyModal(false);
          await openPaymentModal(preloadedOrder, undefined);
        } else {
          rsvpMutation.mutate(undefined);
        }
      }
    } catch {
      if (preloadedOrder) {
        await openPaymentModal(preloadedOrder, undefined);
      } else {
        rsvpMutation.mutate(undefined);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // If the event has ticket types, show the ticket selection modal first.
  // After ticket selection, proceeds to the form check / RSVP flow.
  const handleRsvpClick = async () => {
    setRsvpError(null);
    if (ticketTypes.length > 0) {
      setSelectedTicketTypeId(null);
      setShowTicketModal(true);
      return;
    }
    await proceedWithForm();
  };

  const handleTicketContinue = async () => {
    if (selectedTicketTypeId === null) return;
    pendingTicketTypeIdRef.current = selectedTicketTypeId;
    setShowTicketModal(false);

    const selectedTicket = ticketTypes.find(t => t.id === selectedTicketTypeId);

    if (selectedTicket && selectedTicket.price > 0) {
      setFormLoading(true);
      try {
        const res = await apiRequest("POST", "/api/payments/create-order", {
          eventId: id,
          ticketTypeId: selectedTicketTypeId,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ message: "Could not create payment order" }));
          if (res.status === 409) {
            queryClient.invalidateQueries({ queryKey: ["/api/events", id] });
            toast({ title: "Already registered", description: data.message || "You are already registered for this event.", variant: "default" });
          } else if (res.status === 503) {
            setRsvpError("Online payments coming soon — contact the organiser directly.");
          } else {
            toast({ title: "Order failed", description: data.message || "Could not create payment order", variant: "destructive" });
          }
          setFormLoading(false);
          return;
        }
        const order: RazorpayOrderDetails & { free?: boolean } = await res.json();
        setFormLoading(false);

        if (order.free) {
          await proceedWithForm();
          return;
        }

        setPendingPaymentOrder(order as RazorpayOrderDetails);
      } catch (err: any) {
        toast({ title: "Order failed", description: err.message || "Failed to create payment order. Please try again.", variant: "destructive" });
        setFormLoading(false);
      }
      return;
    }

    await proceedWithForm();
  };

  const handleSurveySubmit = async () => {
    const responses = pendingFormQuestions.map(q => ({
      questionId: q.id,
      answer: formAnswers[q.id] ?? "",
    }));

    const order = pendingOrderRef.current;
    if (order) {
      setShowSurveyModal(false);
      pendingOrderRef.current = null;
      await openPaymentModal(order, responses);
      return;
    }

    rsvpMutation.mutate(responses);
  };

  const handleSurveySkip = async () => {
    const order = pendingOrderRef.current;
    if (order) {
      setShowSurveyModal(false);
      pendingOrderRef.current = null;
      await openPaymentModal(order, undefined);
      return;
    }
    setShowSurveyModal(false);
    rsvpMutation.mutate(undefined);
  };

  const cancelRsvpMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/events/${id}/rsvp`);
      if (!res.ok) throw new Error("Failed to cancel RSVP");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setJustRsvpd(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="rounded-2xl p-8 text-center max-w-md w-full" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--terra-pale)' }}>
            <Calendar className="w-7 h-7 text-[var(--terra)]" />
          </div>
          <h2 className="font-display text-xl font-bold text-[var(--ink)] mb-2" data-testid="text-event-not-found">
            Event not found
          </h2>
          <p className="text-sm text-[var(--muted-warm)] mb-4">
            This event may have been removed or the link is incorrect.
          </p>
          <Button onClick={() => navigate("/")} data-testid="button-go-home">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const club = eventData.club;
  const d = new Date(eventData.startsAt);
  const isPast = d < new Date();
  const isCancelled = !!eventData.isCancelled;
  const goingRsvps = eventData.rsvps?.filter(r => r.status === "going") ?? [];
  const rsvpCount = goingRsvps.length;
  const spotsLeft = eventData.maxCapacity - rsvpCount;
  const myRsvp = eventData.myRsvp ?? eventData.rsvps?.find(r => r.userId === user?.id) ?? null;
  const userRsvp = myRsvp?.status === "going" ? myRsvp : null;
  const hasRsvp = !!userRsvp;
  const isWaitlisted = myRsvp?.status === "waitlisted";
  const waitlistCount = eventData.waitlistCount ?? 0;
  const clubName = club?.name || "a club";

  const formatDate = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const formatTime = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const showStickyBar = !isPast && !justRsvpd && !isCancelled;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative h-64 w-full overflow-hidden">
        {eventData.coverImageUrl ? (
          <>
            <img src={eventData.coverImageUrl} alt={eventData.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 40%, var(--cream) 100%)' }} />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #2D1A0A 0%, #5A3018 40%, #3D200C 100%)' }}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 40% 50%, rgba(196,98,45,0.4) 0%, transparent 60%)' }} />
            <span className="text-[80px] select-none relative z-[2]">{club?.emoji || ""}</span>
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, var(--cream) 100%)' }} />
          </div>
        )}

        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-14 left-5 w-9 h-9 rounded-xl flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>

        <button
          onClick={() => handleShareEvent(eventData, clubName)}
          className="absolute top-14 right-5 w-9 h-9 rounded-xl flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}
          data-testid="button-share-event"
        >
          <Share2 className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="relative z-[5] px-6 -mt-8">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[1.5px] px-2.5 py-1.5 rounded-md mb-2" style={{ background: 'var(--terra-pale)', color: 'var(--terra)', border: '1px solid rgba(196,98,45,0.2)' }}>
          {club?.emoji && <span>{club.emoji}</span>} {club?.category || "Event"} {club && <span>&middot; {club.name}</span>}
        </span>

        <h1 className="font-display text-[28px] font-black text-[var(--ink)] leading-[1.1] tracking-tight mb-4" data-testid="text-event-title">
          {eventData.title}
        </h1>

        {isCancelled && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.25)' }} data-testid="badge-cancelled-event">
            <Ban className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <div className="text-sm font-bold text-destructive">This event has been cancelled</div>
              <div className="text-xs text-destructive/70">The organiser cancelled this event. RSVPs are no longer active.</div>
            </div>
          </div>
        )}

        {!isCancelled && isPast && (
          <div className="inline-block px-3 py-1 rounded-md text-[var(--muted-warm)] text-xs font-bold uppercase mb-4" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="badge-past">
            Past Event
          </div>
        )}

        {eventData.recurrenceRule && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl mb-4" style={{ background: 'rgba(196,98,45,0.08)', border: '1.5px solid rgba(196,98,45,0.2)' }} data-testid="badge-recurrence-info">
            <Repeat className="w-4 h-4 text-[var(--terra)]" />
            <span className="text-xs font-semibold text-[var(--terra)]">
              Recurring event — every {eventData.recurrenceRule === "weekly" ? "week" : eventData.recurrenceRule === "biweekly" ? "2 weeks" : "month"}
            </span>
          </div>
        )}

        {rsvpCount > 0 && (
          <div className="rounded-[14px] px-4 py-3 flex items-center justify-between gap-2 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {goingRsvps.slice(0, 3).map((rsvp, i) => {
                  const colorIdx = i % AVATAR_COLORS.length;
                  const letter = rsvp.userName ? rsvp.userName.charAt(0).toUpperCase() : String.fromCharCode(65 + i);
                  return (
                    <div
                      key={rsvp.id}
                      className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                      style={{ background: ['var(--terra)', 'var(--green-accent)', 'var(--gold)'][colorIdx], border: '2px solid var(--cream)' }}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
              <span className="text-xs text-[var(--ink3)] font-medium ml-2.5" data-testid="text-joining-count">
                {rsvpCount > 3 ? `+${rsvpCount - 3} people joining` : `${rsvpCount} joining`}
              </span>
            </div>
            {spotsLeft > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: 'rgba(255,107,53,0.1)', color: '#D4521A', border: '1px solid rgba(196,98,45,0.25)' }}>
                {spotsLeft} left
              </span>
            )}
          </div>
        )}

        <div className="rounded-2xl p-4 sm:p-5 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)', border: '1px solid rgba(196,98,45,0.15)' }}>
                <Calendar className="w-4 h-4 text-[var(--terra)]" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted-warm)] mb-0.5">Date & Time</div>
                <div className="text-[13px] font-semibold text-[var(--ink)] leading-snug" data-testid="text-event-date">
                  {formatDate(eventData.startsAt)}
                  {eventData.endsAt && ` \u00B7 ${formatTime(eventData.startsAt)} \u2013 ${formatTime(eventData.endsAt)}`}
                  {!eventData.endsAt && ` \u00B7 ${formatTime(eventData.startsAt)}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--warm-border)', paddingTop: '12px' }}>
              <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)', border: '1px solid rgba(196,98,45,0.15)' }}>
                <MapPin className="w-4 h-4 text-[var(--terra)]" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted-warm)] mb-0.5">Location</div>
                <div className="text-[13px] font-semibold text-[var(--ink)]" data-testid="text-event-location">{eventData.locationText}</div>
                {eventData.locationUrl && (
                  <a
                    href={eventData.locationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--terra)] hover:underline"
                    data-testid="link-event-map"
                  >
                    View on Maps
                  </a>
                )}
              </div>
            </div>

            {ticketTypes.length > 0 && (
              <div className="flex items-center gap-3" style={{ borderTop: '1px solid var(--warm-border)', paddingTop: '12px' }}>
                <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)', border: '1px solid rgba(196,98,45,0.15)' }}>
                  <Ticket className="w-4 h-4 text-[var(--terra)]" />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted-warm)] mb-0.5">Tickets</div>
                  <div className="text-[13px] font-semibold text-[var(--ink)]" data-testid="text-event-ticket-price">
                    Starts from ₹{Math.min(...ticketTypes.map(t => t.price))}
                    {ticketTypes.length > 1 && <span className="text-[11px] font-normal text-[var(--muted-warm)] ml-1">· {ticketTypes.length} options</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {club && (
          <div className="rounded-2xl p-4 flex gap-3.5 items-center mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
            <div className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: 'linear-gradient(135deg, #E8D5B8, #C4A882)', border: '2px solid var(--terra)' }}>
              {club.organizerAvatar || club.emoji}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2" data-testid="icon-host-crown">
                <Crown className="w-3.5 h-3.5 text-[var(--gold)] fill-[var(--gold)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display text-base font-bold text-[var(--ink)]" data-testid="text-host-name">{club.organizerName || club.name}</div>
              <div className="text-[11px] text-[var(--muted-warm)]">Club Leader {club.organizerResponse && <span>&middot; {club.organizerResponse}</span>}</div>
            </div>
            {club.whatsappNumber && (
              <a
                href={`https://wa.me/${club.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-bold shrink-0"
                style={{ background: 'rgba(37,211,102,0.12)', border: '1.5px solid rgba(37,211,102,0.3)', color: '#1A8A3A' }}
                data-testid="link-host-whatsapp"
              >
                Talk
              </a>
            )}
          </div>
        )}

        {eventData.description && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted-warm)] mb-2">About This Meet-up</div>
            <p className="text-[13px] text-[var(--ink3)] leading-[1.7] whitespace-pre-wrap" data-testid="text-event-description">
              {eventData.description}
            </p>
          </div>
        )}

        {goingRsvps.length > 0 && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="section-people-coming">
            <div className="font-display text-[15px] font-bold text-[var(--ink)] mb-3">People Coming</div>
            <div>
              {goingRsvps.slice(0, 5).map((rsvp, i) => {
                const colorIdx = i % AVATAR_COLORS.length;
                const name = rsvp.userName || "Anonymous";
                const letter = name.charAt(0).toUpperCase();
                return (
                  <div
                    key={rsvp.id}
                    className="flex items-center gap-2.5 py-2"
                    style={i > 0 ? { borderTop: '1px solid var(--warm-border2, rgba(26,20,16,0.06))' } : undefined}
                    data-testid={`person-${rsvp.id}`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0"
                      style={{ background: AVATAR_COLORS[colorIdx].bg, border: '2px solid var(--warm-border)' }}
                    >
                      {letter}
                    </div>
                    <div className="text-sm font-semibold text-[var(--ink)] flex-1" data-testid={`text-person-name-${rsvp.id}`}>{name}</div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>
                      {i === 0 ? "Regular" : "Joining"}
                    </span>
                  </div>
                );
              })}
              {goingRsvps.length > 5 && (
                <div className="flex items-center gap-2.5 py-2" style={{ borderTop: '1px solid rgba(26,20,16,0.06)' }}>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                    style={{ background: AVATAR_COLORS[3].bg, border: '2px solid var(--warm-border)' }}
                  >
                    +
                  </div>
                  <div className="text-sm font-semibold text-[var(--ink)]">+{goingRsvps.length - 5} more joining</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-2xl p-4 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="section-discussion">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4" style={{ color: 'var(--terra)' }} />
            <span className="text-[11px] font-bold uppercase tracking-[1px] text-[var(--muted-warm)]">Discussion</span>
            {comments.length > 0 && (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>{comments.length}</span>
            )}
          </div>
          {comments.length === 0 && (
            <p className="text-[12px] text-[var(--muted-warm)] mb-3">No messages yet. Be the first to say something!</p>
          )}
          <div className="space-y-3 mb-3">
            {comments.map((c) => {
              const timeAgo = (() => {
                const diffMs = Date.now() - new Date(c.createdAt!).getTime();
                const diffM = Math.floor(diffMs / 60000);
                if (diffM < 1) return "just now";
                if (diffM < 60) return `${diffM}m ago`;
                const diffH = Math.floor(diffM / 60);
                if (diffH < 24) return `${diffH}h ago`;
                return `${Math.floor(diffH / 24)}d ago`;
              })();
              return (
                <div key={c.id} className="flex items-start gap-2.5" data-testid={`comment-${c.id}`}>
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarImage src={c.userImageUrl || undefined} />
                    <AvatarFallback className="text-[11px] font-bold" style={{ background: 'var(--terra-pale)', color: 'var(--terra)' }}>
                      {c.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-[12px] font-semibold text-[var(--ink)]">{c.userName}</span>
                      <span className="text-[11px] text-[var(--muted-warm)]">{timeAgo}</span>
                    </div>
                    <p className="text-[12px] text-[var(--ink3)] leading-relaxed break-words">{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {isAuthenticated && isClubMemberFromStatus ? (
            <div className="flex items-end gap-2 pt-2" style={{ borderTop: '1px solid var(--warm-border)' }}>
              <div className="flex-1 relative">
                <textarea
                  ref={commentInputRef}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && commentText.trim()) {
                      e.preventDefault();
                      commentMutation.mutate(commentText);
                    }
                  }}
                  placeholder="Say something..."
                  rows={1}
                  maxLength={300}
                  className="w-full resize-none rounded-xl px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--cream)', border: '1.5px solid var(--warm-border)', color: 'var(--ink)', minHeight: 38 }}
                  data-testid="input-event-comment"
                />
                {commentText.length > 250 && (
                  <span
                    className="absolute bottom-1.5 right-2.5 text-[11px] font-semibold tabular-nums"
                    style={{ color: commentText.length >= 300 ? 'var(--error, #ef4444)' : 'var(--muted-warm)' }}
                    data-testid="text-comment-char-count"
                  >
                    {300 - commentText.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { if (commentText.trim()) commentMutation.mutate(commentText); }}
                disabled={!commentText.trim() || commentMutation.isPending}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--terra)', color: 'white' }}
                data-testid="button-send-event-comment"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          ) : isAuthenticated ? (
            <p className="text-[11px] text-[var(--muted-warm)] text-center pt-2" style={{ borderTop: '1px solid var(--warm-border)' }}>Join the club to participate in the discussion</p>
          ) : (
            <Link href="/login" className="block text-[11px] text-center text-[var(--terra)] font-semibold pt-2" style={{ borderTop: '1px solid var(--warm-border)' }} data-testid="link-login-to-comment">Sign in to comment</Link>
          )}
        </div>

        {pendingPaymentOrder && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} data-testid="modal-fee-breakdown">
            <div className="w-full max-w-lg rounded-t-3xl p-6 pb-10" style={{ background: "var(--cream)", borderTop: "2px solid var(--terra)" }}>
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5" style={{ color: "var(--terra)" }} />
                <h3 className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>Order Summary</h3>
                {pendingPaymentOrder.isTestMode && isOrganizerOrAdmin && (
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">TEST MODE</span>
                )}
              </div>
              <div className="rounded-2xl p-4 space-y-2 mb-4" style={{ background: "var(--warm-white)", border: "1.5px solid var(--warm-border)" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-warm)" }}>Ticket</span>
                  <span className="font-semibold" style={{ color: "var(--ink)" }} data-testid="text-ticket-name">{pendingPaymentOrder.ticketTypeName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-warm)" }}>Base price</span>
                  <span style={{ color: "var(--ink)" }} data-testid="text-base-price">₹{(pendingPaymentOrder.baseAmount / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--muted-warm)" }}>Platform fee</span>
                  <span style={{ color: "var(--ink)" }} data-testid="text-platform-fee">₹{(pendingPaymentOrder.platformFee / 100).toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 mt-1 flex justify-between text-sm font-bold" style={{ borderColor: "var(--warm-border)" }}>
                  <span style={{ color: "var(--ink)" }}>Total</span>
                  <span style={{ color: "var(--terra)" }} data-testid="text-total-amount">₹{(pendingPaymentOrder.amount / 100).toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  const order = pendingPaymentOrder;
                  setPendingPaymentOrder(null);
                  proceedWithForm(order);
                }}
                disabled={formLoading || paymentLoading}
                className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: "var(--ink)" }}
                data-testid="button-proceed-to-pay"
              >
                <IndianRupee className="w-4 h-4" />
                Proceed to Pay ₹{(pendingPaymentOrder.amount / 100).toFixed(2)}
              </button>
              <button
                onClick={() => { setPendingPaymentOrder(null); pendingTicketTypeIdRef.current = null; }}
                className="w-full mt-2 py-2.5 text-sm font-semibold rounded-2xl"
                style={{ color: "var(--muted-warm)" }}
                data-testid="button-cancel-payment"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {justRsvpd && !isPast && (
          <div className="rounded-2xl p-5 mb-3 text-center" style={{ background: 'var(--warm-white)', border: '1.5px solid rgba(196,98,45,0.3)' }} data-testid="card-rsvp-success">
            <CheckCircle2 className="w-10 h-10 text-[var(--terra)] mx-auto mb-2" />
            <h3 className="font-display text-lg font-bold text-[var(--ink)] mb-1">You're in!</h3>
            <p className="text-sm text-[var(--muted-warm)] mb-4">Bring your friends along &mdash; the more the merrier!</p>
            <button
              onClick={() => handleShareAfterRsvp(eventData, clubName)}
              className="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'var(--terra-pale)', color: 'var(--terra)', border: '1px solid rgba(196,98,45,0.3)' }}
              data-testid="button-share-after-rsvp"
            >
              <Share2 className="w-4 h-4" />
              Share with Friends on WhatsApp
            </button>
          </div>
        )}

        {hasRsvp && !isPast && userRsvp && (
          <div className="rounded-2xl p-5 mb-3" style={{ background: 'var(--warm-white)', border: '1.5px solid rgba(196,98,45,0.3)' }} data-testid="card-my-ticket">
            <div className="flex items-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-[var(--terra)]" />
              <h3 className="font-display text-lg font-bold text-[var(--ink)]">My Ticket</h3>
            </div>
            <div className="flex flex-col items-center">
              <div className="bg-white rounded-xl p-3 mb-4">
                {(() => {
                  const storedToken = localStorage.getItem(`ticket-token-${userRsvp.id}`);
                  if (!storedToken) {
                    return (
                      <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-center gap-2 text-[var(--muted-warm)]" data-testid="div-ticket-qr-unavailable">
                        <Ticket className="w-8 h-8 opacity-40" />
                        <p className="text-xs">Ticket QR only available on the device used to RSVP</p>
                      </div>
                    );
                  }
                  return (
                    <img
                      src={`/api/rsvps/${userRsvp.id}/qr?token=${encodeURIComponent(storedToken)}`}
                      alt="Your event ticket QR code"
                      className="w-[200px] h-[200px]"
                      data-testid="img-ticket-qr"
                      loading="lazy"
                    />
                  );
                })()}
              </div>
              <div className="text-center space-y-1">
                <div className="text-sm font-semibold text-[var(--ink)]" data-testid="text-ticket-event">{eventData.title}</div>
                <div className="text-xs text-[var(--muted-warm)]" data-testid="text-ticket-date">
                  {formatDate(eventData.startsAt)} &middot; {formatTime(eventData.startsAt)}
                </div>
                <div className="text-xs text-[var(--muted-warm)]">{eventData.locationText}</div>
              </div>
              <div className="mt-4 px-4 py-2 rounded-xl text-center" style={{ background: 'var(--terra-pale)' }}>
                <p className="text-xs text-[var(--terra)] font-medium" data-testid="text-ticket-instruction">
                  Show this QR to the organizer at entry
                </p>
              </div>
            </div>
          </div>
        )}

        <div style={{ height: '90px' }} />
      </div>

      {showStickyBar && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[100]"
          style={{ background: 'var(--cream)', borderTop: '1.5px solid var(--warm-border)' }}
          data-testid="sticky-bottom-bar"
        >
          {rsvpError && (
            <div className="px-6 pt-3 pb-1">
              <div className="flex items-start gap-2 rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }} data-testid="text-rsvp-error">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <span className="text-destructive font-medium">{rsvpError}</span>
                  {rsvpError.includes("member") && club && (
                    <Link href={`/club/${club.id}`} className="block text-xs mt-1 underline" style={{ color: 'var(--terra)' }} data-testid="link-join-club">
                      Go to club page to join
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3" style={{ padding: '14px 24px 24px' }}>
            <div className="flex-1">
              {ticketTypes.length > 0 ? (
                <>
                  <div className="text-[11px] text-[var(--muted-warm)] font-semibold tracking-wider uppercase">Starts from</div>
                  <div className="font-display text-[26px] text-[var(--terra)] leading-tight font-bold">
                    ₹{Math.min(...ticketTypes.map(t => t.price))}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-mono text-[32px] text-[var(--terra)] leading-none tracking-wide">
                    {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
                  </div>
                  <div className="text-[11px] text-[var(--muted-warm)] font-semibold tracking-wider">
                    {waitlistCount > 0 ? `${waitlistCount} waiting` : `of ${eventData.maxCapacity} spots`}
                  </div>
                </>
              )}
            </div>

            {!isAuthenticated ? (
              <button
                onClick={() => { window.location.href = "/login"; }}
                className="flex-[2] rounded-2xl py-4 font-display text-base font-bold italic flex items-center justify-center gap-2 transition-all"
                style={{ background: 'var(--ink)', color: 'var(--cream)', letterSpacing: '-0.3px' }}
                data-testid="button-sign-in-rsvp"
              >
                Sign In to Book
              </button>
            ) : hasRsvp ? (
              <div className="flex-[2] flex gap-2">
                <button
                  onClick={() => handleShareAfterRsvp(eventData, clubName)}
                  className="flex-1 rounded-2xl py-4 font-display text-sm font-bold italic flex items-center justify-center gap-2"
                  style={{ background: 'transparent', border: '1.5px solid var(--ink)', color: 'var(--ink)' }}
                  data-testid="button-share-rsvpd"
                >
                  <Share2 className="w-4 h-4" />
                  Invite
                </button>
                <button
                  onClick={() => cancelRsvpMutation.mutate()}
                  disabled={cancelRsvpMutation.isPending}
                  className="px-4 py-4 rounded-2xl text-sm text-[var(--muted-warm)]"
                  style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                  data-testid="button-cancel-rsvp"
                >
                  {cancelRsvpMutation.isPending ? "..." : "Cancel"}
                </button>
              </div>
            ) : isWaitlisted ? (
              <div className="flex-[2] flex gap-2">
                <div
                  className="flex-1 rounded-2xl py-3 text-center"
                  style={{ background: 'rgba(196,168,76,0.12)', border: '1.5px solid rgba(196,168,76,0.4)' }}
                  data-testid="badge-waitlisted"
                >
                  <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>On Waitlist</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted-warm)' }}>#{justWaitlisted ?? "?"} in line</div>
                </div>
                <button
                  onClick={() => cancelRsvpMutation.mutate()}
                  disabled={cancelRsvpMutation.isPending}
                  className="px-4 py-4 rounded-2xl text-sm text-[var(--muted-warm)]"
                  style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                  data-testid="button-cancel-waitlist"
                >
                  {cancelRsvpMutation.isPending ? "..." : "Leave"}
                </button>
              </div>
            ) : isAuthenticated && !isClubMemberFromStatus ? (
              <Link
                href={`/club/${clubId}`}
                className="flex-[2] rounded-2xl py-4 font-display text-base font-bold italic flex items-center justify-center gap-2 transition-all no-underline"
                style={{ background: 'var(--terra)', color: 'white', letterSpacing: '-0.3px' }}
                data-testid="button-join-club-to-rsvp"
              >
                Join Club to RSVP
              </Link>
            ) : spotsLeft > 0 ? (
              <button
                onClick={handleRsvpClick}
                disabled={rsvpMutation.isPending || formLoading || paymentLoading || verifyPaymentMutation.isPending}
                className="flex-[2] rounded-2xl py-4 font-display text-base font-bold italic flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--ink)', color: 'var(--cream)', letterSpacing: '-0.3px' }}
                data-testid="button-rsvp"
              >
                {(rsvpMutation.isPending || formLoading || verifyPaymentMutation.isPending)
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Please wait...</>
                  : paymentLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Opening payment...</>
                  : ticketTypes.length > 0
                    ? <><CreditCard className="w-4 h-4" />Buy Ticket</>
                    : "Book My Spot \u2192"}
              </button>
            ) : isClubMemberFromStatus ? (
              <button
                onClick={handleRsvpClick}
                disabled={rsvpMutation.isPending || formLoading || paymentLoading}
                className="flex-[2] rounded-2xl py-4 font-display text-base font-bold italic flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--gold)', color: 'white', letterSpacing: '-0.3px' }}
                data-testid="button-join-waitlist"
              >
                {(rsvpMutation.isPending || formLoading) ? <><Loader2 className="w-4 h-4 animate-spin" />Adding...</> : "Join Waitlist"}
              </button>
            ) : (
              <div
                className="flex-[2] text-center py-4 rounded-2xl text-[var(--muted-warm)] text-sm font-medium"
                style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}
                data-testid="text-event-full"
              >
                This event is full
              </div>
            )}
          </div>
        </div>
      )}

      {isPast && (
        <div className="px-6 pb-8">
          <div className="text-center py-3 rounded-xl text-[var(--muted-warm)] text-sm font-medium" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }} data-testid="text-event-past">
            This event has already happened
          </div>
        </div>
      )}

      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-20 sm:p-4" data-testid="modal-ticket-selection">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTicketModal(false)} />
          <div className="relative w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[85vh]" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
            <div className="p-5 pb-2 flex items-center gap-2 shrink-0" style={{ background: 'var(--warm-white)' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--terra-pale)' }}>
                <Ticket className="w-4 h-4 text-[var(--terra)]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)]">Choose your ticket</h3>
                <p className="text-[11px] text-[var(--muted-warm)]">Select a ticket type to continue</p>
              </div>
              <button
                onClick={() => setShowTicketModal(false)}
                className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-[var(--muted-warm)] hover:bg-[var(--cream)]"
                data-testid="button-close-ticket-modal"
              >
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <div className="px-5 pb-4 space-y-2.5 flex-1 overflow-y-auto">
              {ticketTypes.map(tt => {
                const isSelected = selectedTicketTypeId === tt.id;
                return (
                  <div
                    key={tt.id}
                    className="rounded-2xl p-4 transition-all"
                    style={{
                      background: isSelected ? 'var(--terra-pale)' : 'var(--cream)',
                      border: `1.5px solid ${isSelected ? 'rgba(196,98,45,0.5)' : 'var(--warm-border)'}`,
                    }}
                    data-testid={`ticket-option-${tt.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[var(--ink)] text-sm leading-snug">{tt.name}</div>
                        {tt.description && (
                          <div className="text-[11px] text-[var(--muted-warm)] mt-0.5 leading-snug line-clamp-2">{tt.description}</div>
                        )}
                        <div className="font-display text-base font-bold text-[var(--terra)] mt-1">₹{tt.price}</div>
                      </div>
                      <button
                        onClick={() => setSelectedTicketTypeId(tt.id)}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                        style={isSelected
                          ? { background: 'var(--terra)', color: 'white' }
                          : { background: 'var(--warm-white)', color: 'var(--terra)', border: '1.5px solid rgba(196,98,45,0.35)' }}
                        data-testid={`button-select-ticket-${tt.id}`}
                      >
                        {isSelected ? <><CheckCircle2 className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />Selected</> : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 pb-6 pt-2 shrink-0" style={{ borderTop: '1px solid var(--warm-border)' }}>
              <button
                onClick={handleTicketContinue}
                disabled={selectedTicketTypeId === null || formLoading}
                className="w-full rounded-2xl py-4 font-display text-base font-bold italic flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'var(--ink)', color: 'var(--cream)', letterSpacing: '-0.3px' }}
                data-testid="button-ticket-continue"
              >
                {formLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Please wait...</> : "Continue \u2192"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSurveyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pt-4 px-4 pb-20 sm:p-4" data-testid="modal-survey-form">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !pendingFormMandatory && setShowSurveyModal(false)} />
          <div className="relative w-full max-w-lg mx-auto rounded-t-3xl sm:rounded-3xl flex flex-col max-h-[calc(100dvh-6rem)] sm:max-h-[85vh]" style={{ background: 'var(--warm-white)', border: '1.5px solid var(--warm-border)' }}>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-[var(--terra)]" />
                <h3 className="text-sm font-bold text-foreground">Quick Registration</h3>
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: pendingFormMandatory ? 'var(--terra-pale)' : 'var(--cream)', color: pendingFormMandatory ? 'var(--terra)' : 'var(--muted-warm)' }}>
                  {pendingFormMandatory ? "Required to RSVP" : "Optional"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {pendingFormMandatory
                  ? "The organizer needs a few details before confirming your spot."
                  : "The organizer would love these details, but you can skip if you prefer."}
              </p>
              <div className="space-y-3">
                {pendingFormQuestions.map((q) => (
                  <div key={q.id} data-testid={`survey-question-${q.id}`}>
                    <label className="text-xs font-semibold text-foreground mb-1 block">{q.question}{pendingFormMandatory && <span className="text-destructive ml-1">*</span>}</label>
                    <input
                      value={formAnswers[q.id] ?? ""}
                      onChange={e => setFormAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border-[1.5px] border-[var(--warm-border)] bg-[var(--cream)] focus:outline-none focus:ring-2 focus:ring-[var(--terra)]/30"
                      placeholder="Your answer"
                      data-testid={`input-survey-answer-${q.id}`}
                    />
                  </div>
                ))}
              </div>
              {rsvpError && <p className="text-xs text-destructive font-medium" data-testid="text-survey-error">{rsvpError}</p>}
            </div>
            <div className="flex gap-3 px-5 pb-5 pt-3 shrink-0" style={{ borderTop: '1px solid var(--warm-border)' }}>
              {!pendingFormMandatory ? (
                <button
                  onClick={handleSurveySkip}
                  disabled={rsvpMutation.isPending || paymentLoading}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-muted-foreground border-[1.5px] border-[var(--warm-border)]"
                  style={{ background: 'var(--warm-white)' }}
                  data-testid="button-survey-skip"
                >
                  Skip
                </button>
              ) : (
                <button
                  onClick={() => { pendingOrderRef.current = null; setShowSurveyModal(false); }}
                  disabled={rsvpMutation.isPending || paymentLoading}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold text-muted-foreground border-[1.5px] border-[var(--warm-border)]"
                  style={{ background: 'var(--warm-white)' }}
                  data-testid="button-survey-cancel"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSurveySubmit}
                disabled={rsvpMutation.isPending || paymentLoading || (pendingFormMandatory && pendingFormQuestions.some(q => !(formAnswers[q.id] ?? "").trim()))}
                className="flex-[2] py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'var(--ink)' }}
                data-testid="button-survey-submit"
              >
                {(rsvpMutation.isPending || paymentLoading) ? <><Loader2 className="w-4 h-4 animate-spin" />{pendingOrderRef.current ? "Opening payment..." : "Booking..."}</> : pendingOrderRef.current ? "Continue to Payment →" : "Confirm & Book Spot →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
