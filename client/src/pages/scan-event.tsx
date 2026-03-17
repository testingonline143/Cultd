import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Camera, CheckCircle2, XCircle, AlertTriangle, Users, Calendar, MapPin, Clock, Search, X, UserCheck, Sun } from "lucide-react";
import type { Event } from "@shared/schema";

interface Attendee {
  rsvpId: string;
  name: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
}

interface AttendanceData {
  totalRsvps: number;
  checkedIn: number;
  notYetArrived: number;
  attendees: Attendee[];
}

type ScanResult =
  | { type: "success"; name: string | null; checkedInAt: string | null }
  | { type: "already"; name: string | null }
  | { type: "error"; message: string };

function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatEventDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function ScanEvent() {
  const { eventId } = useParams<{ eventId: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualSearch, setManualSearch] = useState("");
  const [manualSuccessName, setManualSuccessName] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchHidden, setTorchHidden] = useState(false);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const next = !torchOn;
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      setTorchHidden(true);
    }
  };

  const { data: event, isLoading: eventLoading } = useQuery<Event>({
    queryKey: ["/api/events", eventId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Event not found");
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: attendance, refetch: refetchAttendance } = useQuery<AttendanceData>({
    queryKey: ["/api/events", eventId, "attendance"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/events/${eventId}/attendance`);
      return res.json();
    },
    enabled: !!eventId && isAuthenticated,
    refetchInterval: 10000,
  });

  const manualCheckinMutation = useMutation({
    mutationFn: async (rsvpId: string) => {
      const res = await apiRequest("POST", "/api/checkin/manual", { rsvpId, eventId });
      return res.json();
    },
    onSuccess: (data, rsvpId) => {
      if (data.success) {
        const attendee = attendance?.attendees.find(a => a.rsvpId === rsvpId);
        setManualSuccessName(attendee?.name ?? "Attendee");
        navigator.vibrate?.(200);
        refetchAttendance();
        queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "attendance"] });
        setTimeout(() => setManualSuccessName(null), 2500);
      }
    },
  });

  const startScanner = async () => {
    if (scannerRef.current || !scannerDivRef.current) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-scanner");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;

          let parsed: any;
          try {
            parsed = JSON.parse(decodedText);
          } catch {
            navigator.vibrate?.([50, 30, 50, 30, 50]);
            setScanResult({ type: "error", message: "Not a valid CultFam ticket — please scan the attendee's event QR code" });
            setTimeout(() => { setScanResult(null); processingRef.current = false; }, 3000);
            return;
          }

          try {
            if (!parsed.token) {
              navigator.vibrate?.([50, 30, 50, 30, 50]);
              setScanResult({ type: "error", message: "Not a valid CultFam ticket — please scan the attendee's event QR code" });
              setTimeout(() => { setScanResult(null); processingRef.current = false; }, 3000);
              return;
            }

            const res = await apiRequest("POST", "/api/checkin", { token: parsed.token, eventId });

            const data = await res.json();

            if (!res.ok) {
              navigator.vibrate?.([50, 30, 50, 30, 50]);
              setScanResult({ type: "error", message: data.message || "Check-in failed" });
            } else if (data.alreadyCheckedIn) {
              navigator.vibrate?.([100, 50, 100]);
              setScanResult({ type: "already", name: data.name });
            } else {
              navigator.vibrate?.(200);
              setScanResult({ type: "success", name: data.name, checkedInAt: data.checkedInAt });
              refetchAttendance();
            }
          } catch {
            navigator.vibrate?.([50, 30, 50, 30, 50]);
            setScanResult({ type: "error", message: "Check-in failed — please try scanning again" });
          }

          setTimeout(() => { setScanResult(null); processingRef.current = false; }, 2500);
        },
        () => {}
      );

      setScanning(true);

      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.() as any;
          if (!caps?.torch) setTorchHidden(true);
          track.stop();
        } catch {
          setTorchHidden(true);
        }
      }, 300);
    } catch (err: any) {
      console.error("Scanner error:", err);
      setScanResult({ type: "error", message: err?.message || "Camera access denied" });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
    setTorchOn(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
        scannerRef.current = null;
      }
    };
  }, []);

  const pending = (attendance?.attendees ?? []).filter(a => !a.checkedIn);
  const arrived = (attendance?.attendees ?? []).filter(a => a.checkedIn);
  const filteredPending = manualSearch.trim()
    ? pending.filter(a => (a.name ?? "").toLowerCase().includes(manualSearch.toLowerCase()))
    : pending;
  const fillPct = attendance && attendance.totalRsvps > 0
    ? Math.round((attendance.checkedIn / attendance.totalRsvps) * 100)
    : 0;

  if (authLoading || eventLoading) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Camera className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="font-display text-xl font-bold text-foreground">Scanner Access Required</h1>
          <p className="text-sm text-muted-foreground">Sign in as the event organizer to scan tickets</p>
          <button
            onClick={() => { window.location.href = "/login"; }}
            className="w-full bg-[var(--terra)] text-white rounded-2xl py-3 text-sm font-semibold"
            data-testid="button-scanner-sign-in"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="max-w-lg mx-auto px-4 py-4 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            onClick={() => { stopScanner(); navigate("/organizer"); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-scanner-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-display text-lg font-bold text-[var(--terra)]" data-testid="text-scanner-title">
            Scan Attendees
          </h1>
          <div className="w-12" />
        </div>

        {/* Richer event context card */}
        {event && (
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[rgba(196,98,45,0.25)] rounded-2xl p-4 mb-4" style={{ borderRadius: 18 }} data-testid="card-event-context">
            <div className="text-sm font-bold text-foreground mb-2" data-testid="text-scanner-event-name">{event.title}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3 text-[var(--terra)]" />
                {formatEventDate(event.startsAt)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 text-[var(--terra)]" />
                {formatTime(event.startsAt as unknown as string)}
                {event.endsAt ? ` – ${formatTime(event.endsAt as unknown as string)}` : ""}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 text-[var(--terra)]" />
                {event.locationText}
              </span>
            </div>
          </div>
        )}

        {/* Fill rate progress bar */}
        {attendance && (
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[rgba(196,98,45,0.25)] rounded-2xl p-4 mb-4" style={{ borderRadius: 18 }} data-testid="card-fill-rate">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</span>
              {attendance.checkedIn === attendance.totalRsvps && attendance.totalRsvps > 0 && (
                <span className="text-[10px] font-bold text-[var(--terra)] bg-[rgba(196,98,45,0.1)] px-2 py-0.5 rounded-full uppercase tracking-wider" data-testid="badge-event-full">
                  All In
                </span>
              )}
            </div>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-3xl font-bold text-[var(--terra)] font-mono leading-none" data-testid="text-checked-in-count">
                {attendance.checkedIn}
              </span>
              <span className="text-sm text-muted-foreground mb-0.5">/ {attendance.totalRsvps} RSVPs</span>
              <span className="ml-auto text-sm font-semibold text-[var(--terra)]">{fillPct}%</span>
            </div>
            <div className="h-2.5 bg-[var(--cream)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--terra)] rounded-full transition-all duration-500"
                style={{ width: `${fillPct}%` }}
                data-testid="bar-fill-rate"
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground">{attendance.checkedIn} arrived</span>
              <span className="text-[10px] text-muted-foreground">{attendance.notYetArrived} pending</span>
            </div>
          </div>
        )}

        {/* Camera viewfinder */}
        <div className="relative rounded-2xl overflow-hidden mb-4 bg-[var(--ink)]/50 min-h-[300px]">
          <div id="qr-scanner" ref={scannerDivRef} className="w-full" data-testid="div-qr-scanner" />

          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <Camera className="w-16 h-16 text-muted-foreground" />
              <button
                onClick={startScanner}
                className="bg-[var(--terra)] text-white rounded-2xl px-8 py-4 text-sm font-semibold"
                data-testid="button-start-scanner"
              >
                Start Camera Scanner
              </button>
            </div>
          )}

          {scanning && !torchHidden && (
            <button
              onClick={toggleTorch}
              className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all"
              style={{
                background: torchOn ? "var(--terra)" : "rgba(0,0,0,0.5)",
                border: "1.5px solid rgba(255,255,255,0.3)",
              }}
              data-testid="button-torch-toggle"
              title={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
            >
              <Sun className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Scan result overlay */}
          {scanResult && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--ink)]/70 z-10">
              {scanResult.type === "success" && (
                <div className="bg-[var(--warm-white)] border-[1.5px] border-[rgba(196,98,45,0.3)] rounded-2xl p-6 text-center mx-4" style={{ borderRadius: 18 }} data-testid="card-scan-success">
                  <CheckCircle2 className="w-14 h-14 text-[var(--terra)] mx-auto mb-3" />
                  <div className="font-display text-lg font-bold text-foreground mb-1">
                    {scanResult.name || "Attendee"} checked in
                  </div>
                  {scanResult.checkedInAt && (
                    <div className="text-xs text-[var(--terra)] font-medium">{formatTime(scanResult.checkedInAt)}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">Welcome!</div>
                </div>
              )}
              {scanResult.type === "already" && (
                <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl p-6 text-center mx-4" style={{ borderRadius: 18 }} data-testid="card-scan-already">
                  <AlertTriangle className="w-14 h-14 text-chart-4 mx-auto mb-3" />
                  <div className="font-display text-lg font-bold text-foreground mb-1">
                    Already Checked In
                  </div>
                  <div className="text-xs text-muted-foreground">{scanResult.name || "Attendee"} was already scanned</div>
                </div>
              )}
              {scanResult.type === "error" && (
                <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl p-6 text-center mx-4" style={{ borderRadius: 18 }} data-testid="card-scan-error">
                  <XCircle className="w-14 h-14 text-destructive mx-auto mb-3" />
                  <div className="font-display text-lg font-bold text-foreground mb-1">
                    Scan Failed
                  </div>
                  <div className="text-xs text-muted-foreground">{scanResult.message}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual check-in success flash */}
        {manualSuccessName && (
          <div className="bg-[rgba(196,98,45,0.1)] border-[1.5px] border-[rgba(196,98,45,0.3)] rounded-2xl p-4 mb-4 flex items-center gap-3" style={{ borderRadius: 18 }} data-testid="card-manual-success">
            <CheckCircle2 className="w-6 h-6 text-[var(--terra)] flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground">{manualSuccessName} checked in manually</span>
          </div>
        )}

        {scanning && (
          <button
            onClick={stopScanner}
            className="w-full bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl py-3 text-sm font-semibold text-muted-foreground mb-4"
            style={{ borderRadius: 18 }}
            data-testid="button-stop-scanner"
          >
            Stop Scanner
          </button>
        )}

        {/* Manual check-in section */}
        {attendance && (
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl p-4 mb-4" style={{ borderRadius: 18 }} data-testid="card-manual-checkin">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manual Check-in</span>
            </div>

            {pending.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground" data-testid="text-all-checked-in">
                Everyone has been checked in
              </div>
            ) : (
              <>
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full bg-[var(--cream)] border border-[var(--warm-border)] rounded-xl pl-8 pr-8 py-2.5 text-sm focus:outline-none focus:border-[var(--terra)] transition-colors"
                    data-testid="input-manual-search"
                  />
                  {manualSearch && (
                    <button
                      onClick={() => setManualSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {filteredPending.length === 0 ? (
                  <div className="text-center py-3 text-xs text-muted-foreground">No match found</div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto">
                    {filteredPending.map((a) => (
                      <div
                        key={a.rsvpId}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[var(--cream)]/60"
                        data-testid={`row-pending-${a.rsvpId}`}
                      >
                        <span className="text-sm text-foreground font-medium">{a.name || "Unknown"}</span>
                        <button
                          onClick={() => manualCheckinMutation.mutate(a.rsvpId)}
                          disabled={manualCheckinMutation.isPending}
                          className="text-xs font-semibold text-[var(--terra)] bg-[rgba(196,98,45,0.1)] hover:bg-[rgba(196,98,45,0.2)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          data-testid={`button-manual-checkin-${a.rsvpId}`}
                        >
                          Check In
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Attendee list — sorted: pending first, arrived below */}
        {attendance && attendance.attendees.length > 0 && (
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl p-4" style={{ borderRadius: 18 }} data-testid="card-attendee-list">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">All Attendees</span>
            </div>

            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {/* Pending section */}
              {pending.length > 0 && (
                <>
                  <div className="px-1 py-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      Waiting · {pending.length}
                    </span>
                  </div>
                  {pending.map((a, i) => (
                    <div
                      key={a.rsvpId}
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--cream)]/40"
                      data-testid={`attendee-row-pending-${i}`}
                    >
                      <span className="text-sm text-muted-foreground">{a.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">Pending</span>
                    </div>
                  ))}
                </>
              )}

              {/* Arrived section */}
              {arrived.length > 0 && (
                <>
                  <div className="px-1 py-1.5 mt-1">
                    <span className="text-[10px] font-bold text-[var(--terra)] uppercase tracking-widest">
                      Arrived · {arrived.length}
                    </span>
                  </div>
                  {arrived.map((a, i) => (
                    <div
                      key={a.rsvpId}
                      className="flex items-center justify-between py-2 px-3 rounded-xl bg-[rgba(196,98,45,0.06)]"
                      data-testid={`attendee-row-arrived-${i}`}
                    >
                      <span className="text-sm text-foreground font-medium">{a.name || "Unknown"}</span>
                      <span className="flex items-center gap-1 text-xs text-[var(--terra)] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {a.checkedInAt ? formatTime(a.checkedInAt) : "In"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {attendance && attendance.attendees.length === 0 && (
          <div className="bg-[var(--warm-white)] border-[1.5px] border-[var(--warm-border)] rounded-2xl p-6 text-center" style={{ borderRadius: 18 }} data-testid="card-no-rsvps">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No RSVPs yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
