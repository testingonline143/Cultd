import type { Express, RequestHandler } from "express";
import crypto from "crypto";
import { storage } from "../storage/index";
import { isAuthenticated } from "../auth";
import { writeRateLimiter } from "../middleware";
import { hashCheckinToken } from "../auth/tokenUtils";
import {
  razorpay,
  getRazorpayKeyId,
  createRazorpayOrder,
  createRazorpayContact,
  createRazorpayFundAccount,
  createRouteTransfer,
  fetchRazorpayPayment,
  fetchRazorpayOrder,
  isTestMode,
} from "../razorpay";
import { calculateCommission } from "../commission";
import type { RazorpayOrderEntity } from "../razorpay";

async function attemptRouteTransfer(paymentId: string, baseAmountPaise: number, fundAccountId: string): Promise<string> {
  return createRouteTransfer(paymentId, [{ account: fundAccountId, amount: baseAmountPaise, currency: "INR" }]);
}

export function registerPaymentRoutes(
  app: Express,
  isAdmin: RequestHandler,
  requireClubManager: (param?: string) => RequestHandler,
): void {
  app.post("/api/payments/create-order", isAuthenticated, writeRateLimiter, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId, ticketTypeId } = req.body;
      if (!eventId) return res.status(400).json({ message: "eventId required" });

      const event = await storage.getEvent(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.isCancelled) return res.status(400).json({ message: "This event has been cancelled and is no longer accepting bookings." });
      const club = await storage.getClub(event.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const isManager = await storage.isClubManager(club.id, userId);
      if (!isManager) {
        const isMember = await storage.hasUserJoinedClub(event.clubId, userId);
        if (!isMember) return res.status(403).json({ message: "You must be a club member to book tickets" });
      }

      const existingRsvp = await storage.getUserRsvp(eventId, userId);
      if (existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")) {
        return res.status(409).json({ message: "You are already registered for this event" });
      }

      const tickets = await storage.getEventTicketTypes(event.id);
      if (tickets.length === 0) return res.json({ free: true });

      const ticket = ticketTypeId ? tickets.find(t => t.id === parseInt(String(ticketTypeId)) && t.isActive) : tickets.filter(t => t.isActive)[0];
      if (!ticket) return res.status(404).json({ message: "Ticket type not found" });

      if (ticket.price === 0) return res.json({ free: true, ticketTypeId: ticket.id, ticketTypeName: ticket.name });

      if (!razorpay) {
        return res.status(503).json({ error: "Payments not configured", message: "Online payments coming soon — contact the organiser directly" });
      }

      const baseAmountPaise = ticket.price * 100;
      const breakdown = calculateCommission(baseAmountPaise, club);

      const order = await createRazorpayOrder({
        amount: breakdown.totalAmount,
        currency: "INR",
        notes: { eventId, ticketTypeId: String(ticket.id), userId, clubId: club.id },
      });

      res.json({
        orderId: order.id,
        amount: breakdown.totalAmount,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        currency: "INR",
        keyId: getRazorpayKeyId(),
        isTestMode,
        ticketTypeId: ticket.id,
        ticketTypeName: ticket.name,
        eventTitle: event.title,
        clubName: club.name,
      });
    } catch (err) {
      console.error("Error creating Razorpay order:", err);
      res.status(500).json({ message: "Failed to create payment order" });
    }
  });

  app.post("/api/payments/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, eventId: reqEventId, ticketTypeId: reqTicketTypeId, formResponses } = req.body;

      if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({ message: "Missing required payment fields" });
      }

      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) return res.status(503).json({ message: "Payments not configured" });

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (expectedSignature !== razorpaySignature) {
        return res.status(400).json({ message: "Payment verification failed — invalid signature" });
      }

      const existingTxByPayment = await storage.getPlatformTransactionByPaymentId(razorpayPaymentId);
      if (existingTxByPayment) {
        const existingRsvp = await storage.getRsvpById(existingTxByPayment.rsvpId ?? "");
        return res.json({ success: true, rsvp: existingRsvp, alreadyRsvpd: true, transaction: existingTxByPayment });
      }

      if (!razorpay) return res.status(503).json({ message: "Payments not configured" });

      let rzpPayment;
      try {
        rzpPayment = await fetchRazorpayPayment(razorpayPaymentId);
      } catch {
        return res.status(400).json({ message: "Could not verify payment with Razorpay" });
      }

      if (!rzpPayment || rzpPayment.status !== "captured") {
        return res.status(400).json({ message: "Payment not captured" });
      }
      if (rzpPayment.order_id !== razorpayOrderId) {
        return res.status(400).json({ message: "Payment/order mismatch" });
      }

      let rzpOrder: RazorpayOrderEntity;
      try {
        rzpOrder = await fetchRazorpayOrder(razorpayOrderId);
      } catch {
        return res.status(400).json({ message: "Could not fetch order from Razorpay" });
      }

      const notes = rzpOrder.notes ?? {};
      const orderEventId = notes.eventId ?? reqEventId;
      const orderUserId = notes.userId;
      const orderTicketTypeId = notes.ticketTypeId ? parseInt(notes.ticketTypeId) : null;

      if (orderUserId && orderUserId !== userId) {
        return res.status(403).json({ message: "Payment was made by a different user" });
      }

      if (!orderEventId) return res.status(400).json({ message: "Event not found in order" });

      const event = await storage.getEvent(orderEventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.isCancelled) return res.status(400).json({ message: "This event has been cancelled. Payment cannot be processed." });
      const club = await storage.getClub(event.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const tickets = await storage.getEventTicketTypes(event.id);
      const ticket = orderTicketTypeId ? tickets.find(t => t.id === orderTicketTypeId) : null;

      const baseAmountPaise = ticket ? ticket.price * 100 : 0;
      const breakdown = calculateCommission(baseAmountPaise, club);

      if (rzpOrder.amount !== breakdown.totalAmount) {
        console.error(`[verify] Amount mismatch: order=${rzpOrder.amount} expected=${breakdown.totalAmount}`);
        return res.status(400).json({ message: "Payment amount does not match expected ticket price" });
      }

      const existingRsvp = await storage.getUserRsvp(event.id, userId);
      if (existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")) {
        const existingTx = await storage.getPlatformTransactionByRsvpId(existingRsvp.id);
        return res.json({ success: true, rsvp: existingRsvp, alreadyRsvpd: true, transaction: existingTx });
      }

      const rsvpCount = await storage.getRsvpCount(event.id);
      const rsvpStatus = rsvpCount >= event.maxCapacity ? "waitlisted" : "going";
      const rawToken1 = crypto.randomUUID();
      const rsvp = await storage.createRsvp({
        eventId: event.id,
        userId,
        status: rsvpStatus,
        ticketTypeId: ticket?.id,
        ticketTypeName: ticket?.name,
        razorpayOrderId,
        razorpayPaymentId,
        paymentStatus: "paid",
      }, hashCheckinToken(rawToken1));

      const rawFormResponses: { questionId: string; answer: string }[] = formResponses ?? [];
      if (rawFormResponses.length > 0) {
        const validQuestions = await storage.getEventFormQuestions(event.id);
        const validIds = new Set(validQuestions.map(q => q.id));
        const cleaned = rawFormResponses
          .filter(r => validIds.has(r.questionId))
          .map(r => ({ questionId: r.questionId, answer: String(r.answer ?? "").trim().slice(0, 1000) }));
        if (cleaned.length > 0) await storage.saveEventFormResponses(event.id, userId, cleaned);
      }

      const tx = await storage.createPlatformTransaction({
        eventId: event.id,
        rsvpId: rsvp.id,
        clubId: club.id,
        userId,
        razorpayOrderId,
        razorpayPaymentId,
        totalAmount: breakdown.totalAmount,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        currency: "INR",
        status: "pending",
      });

      let transferStatus = "pending";
      let transferId: string | undefined;
      if (club.razorpayFundAccountId && club.payoutsEnabled) {
        try {
          transferId = await attemptRouteTransfer(razorpayPaymentId, breakdown.baseAmount, club.razorpayFundAccountId);
          transferStatus = "transferred";
        } catch (transferErr) {
          console.error("Route transfer failed:", transferErr);
          transferStatus = "failed";
        }
      }

      await storage.updatePlatformTransaction(tx.id, {
        status: transferStatus as "pending" | "transferred" | "failed",
        razorpayTransferId: transferId,
      });

      const eventDate = new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      await storage.createNotification({
        userId,
        type: "rsvp_confirmed",
        title: "Payment Successful — You're in!",
        message: `Payment confirmed for ${event.title} on ${eventDate}. Your ticket is ready!`,
        linkUrl: `/event/${event.id}`,
        isRead: false,
      });

      if (club.creatorUserId && club.payoutsEnabled) {
        const notifType = transferStatus === "transferred" ? "payout_transferred" : transferStatus === "failed" ? "payout_failed" : "payout_pending";
        const notifMsg = transferStatus === "transferred"
          ? `₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} has been transferred to your account.`
          : transferStatus === "failed"
          ? `Transfer of ₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} failed. Please check the admin dashboard.`
          : `Payment received for ${event.title}. Transfer will be processed shortly.`;
        await storage.createNotification({
          userId: club.creatorUserId,
          type: notifType,
          title: transferStatus === "transferred" ? "Payout Transferred!" : transferStatus === "failed" ? "Transfer Failed" : "Payment Received",
          message: notifMsg,
          linkUrl: `/organizer/earnings?club=${club.id}`,
          isRead: false,
        });
      }

      res.json({ success: true, rsvp, transaction: { ...tx, status: transferStatus, razorpayTransferId: transferId } });
    } catch (err) {
      console.error("Error verifying payment:", err);
      res.status(500).json({ message: "Payment verification failed" });
    }
  });

  app.post("/api/payments/webhook", async (req: any, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error("[webhook] RAZORPAY_WEBHOOK_SECRET not set — rejecting unsigned request");
        return res.status(400).json({ message: "Webhook secret not configured" });
      }

      const receivedSignature = req.headers["x-razorpay-signature"] as string;
      if (!receivedSignature) {
        return res.status(400).json({ message: "Missing webhook signature" });
      }
      const body = req.rawBody ? String(req.rawBody) : JSON.stringify(req.body);
      const expectedSig = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
      if (receivedSignature !== expectedSig) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      const webhookEvent = req.body?.event as string | undefined;
      const payload = req.body?.payload as Record<string, unknown> | undefined;

      if (webhookEvent === "payment.captured") {
        const paymentEntity = (payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
        const orderId = paymentEntity?.order_id as string | undefined;
        const paymentId = paymentEntity?.id as string | undefined;
        const amountPaise: number = (paymentEntity?.amount as number | undefined) ?? 0;

        if (!orderId || !paymentId) {
          console.warn("[webhook] payment.captured missing orderId/paymentId");
          return res.json({ status: "ok" });
        }

        const existingTx = await storage.getPlatformTransactionByPaymentId(paymentId);
        if (existingTx) {
          if ((existingTx.status === "pending" || existingTx.status === "failed") && razorpay) {
            const club = await storage.getClub(existingTx.clubId);
            if (club?.razorpayFundAccountId && club.payoutsEnabled) {
              try {
                const transferId = await attemptRouteTransfer(paymentId, existingTx.baseAmount, club.razorpayFundAccountId);
                await storage.updatePlatformTransaction(existingTx.id, { status: "transferred", razorpayTransferId: transferId });
                console.log(`[webhook] Retried transfer for existing tx ${existingTx.id}: ${transferId}`);
                if (club.creatorUserId) {
                  const retryEvent = await storage.getEvent(existingTx.eventId);
                  await storage.createNotification({
                    userId: club.creatorUserId,
                    type: "payout_transferred",
                    title: "Payout Transferred!",
                    message: `₹${(existingTx.baseAmount / 100).toFixed(2)} from ${retryEvent?.title ?? "an event"} has been transferred to your account.`,
                    linkUrl: `/organizer/earnings?club=${club.id}`,
                    isRead: false,
                  });
                }
              } catch (err) {
                console.error("[webhook] Transfer retry failed:", err);
                if (club.creatorUserId) {
                  const retryEvent = await storage.getEvent(existingTx.eventId);
                  await storage.createNotification({
                    userId: club.creatorUserId,
                    type: "payout_failed",
                    title: "Transfer Failed",
                    message: `Transfer of ₹${(existingTx.baseAmount / 100).toFixed(2)} from ${retryEvent?.title ?? "an event"} failed. Please check the admin dashboard.`,
                    linkUrl: `/organizer/earnings?club=${club.id}`,
                    isRead: false,
                  });
                }
              }
            }
          }
          return res.json({ status: "ok" });
        }

        if (!razorpay) return res.json({ status: "ok" });
        let rzpOrder: RazorpayOrderEntity;
        try {
          rzpOrder = await fetchRazorpayOrder(orderId);
        } catch (err) {
          console.error("[webhook] Could not fetch order:", err);
          return res.json({ status: "ok" });
        }

        const notes = rzpOrder.notes ?? {};
        const eventId = notes.eventId;
        const userId = notes.userId;
        const ticketTypeIdRaw = notes.ticketTypeId;

        if (!eventId || !userId) {
          console.warn("[webhook] Order missing eventId/userId notes, skipping RSVP creation");
          return res.json({ status: "ok" });
        }

        const event = await storage.getEvent(eventId);
        const club = event ? await storage.getClub(event.clubId) : null;
        if (!event || !club) {
          console.warn(`[webhook] Event or club not found for eventId=${eventId}`);
          return res.json({ status: "ok" });
        }

        const tickets = await storage.getEventTicketTypes(event.id);
        const ticketTypeId = ticketTypeIdRaw ? parseInt(ticketTypeIdRaw) : null;
        const ticket = ticketTypeId ? tickets.find(t => t.id === ticketTypeId) : null;

        const baseAmountPaise = ticket ? ticket.price * 100 : 0;
        const breakdown = calculateCommission(baseAmountPaise, club);

        if (amountPaise > 0 && amountPaise !== breakdown.totalAmount) {
          console.error(`[webhook] Amount mismatch: payment=${amountPaise} expected=${breakdown.totalAmount} for event=${eventId}`);
          return res.json({ status: "ok" });
        }

        const existingRsvp = await storage.getUserRsvp(event.id, userId);
        let rsvp = existingRsvp && (existingRsvp.status === "going" || existingRsvp.status === "waitlisted")
          ? existingRsvp
          : null;

        if (!rsvp) {
          const rsvpCount = await storage.getRsvpCount(event.id);
          const rsvpStatus = rsvpCount >= event.maxCapacity ? "waitlisted" : "going";
          const rawToken2 = crypto.randomUUID();
          rsvp = await storage.createRsvp({
            eventId: event.id,
            userId,
            status: rsvpStatus,
            ticketTypeId: ticket?.id,
            ticketTypeName: ticket?.name,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            paymentStatus: "paid",
          }, hashCheckinToken(rawToken2));
          console.log(`[webhook] Created RSVP ${rsvp.id} for user=${userId} event=${eventId}`);
        }

        const tx = await storage.createPlatformTransaction({
          eventId: event.id,
          rsvpId: rsvp.id,
          clubId: club.id,
          userId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          totalAmount: breakdown.totalAmount,
          baseAmount: breakdown.baseAmount,
          platformFee: breakdown.platformFee,
          currency: "INR",
          status: "pending",
        });

        let transferStatus = "pending";
        let transferId: string | undefined;
        if (club.razorpayFundAccountId && club.payoutsEnabled) {
          try {
            transferId = await attemptRouteTransfer(paymentId, breakdown.baseAmount, club.razorpayFundAccountId);
            transferStatus = "transferred";
          } catch (err) {
            console.error("[webhook] Route transfer failed:", err);
            transferStatus = "failed";
          }
        }

        await storage.updatePlatformTransaction(tx.id, {
          status: transferStatus as "pending" | "transferred" | "failed",
          razorpayTransferId: transferId,
        });

        const eventDate = new Date(event.startsAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
        await storage.createNotification({
          userId,
          type: "rsvp_confirmed",
          title: "Payment Confirmed — You're in!",
          message: `Your payment for ${event.title} on ${eventDate} has been confirmed.`,
          linkUrl: `/event/${event.id}`,
          isRead: false,
        });

        if (club.creatorUserId && club.payoutsEnabled) {
          const notifType = transferStatus === "transferred" ? "payout_transferred" : transferStatus === "failed" ? "payout_failed" : "payout_pending";
          const notifMsg = transferStatus === "transferred"
            ? `₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} has been transferred to your account.`
            : transferStatus === "failed"
            ? `Transfer of ₹${(breakdown.baseAmount / 100).toFixed(2)} from ${event.title} failed. Please check the admin dashboard.`
            : `Payment received for ${event.title}. Transfer will be processed shortly.`;
          await storage.createNotification({
            userId: club.creatorUserId,
            type: notifType,
            title: transferStatus === "transferred" ? "Payout Transferred!" : transferStatus === "failed" ? "Transfer Failed" : "Payment Received",
            message: notifMsg,
            linkUrl: `/organizer/earnings?club=${club.id}`,
            isRead: false,
          });
        }

        console.log(`[webhook] payment.captured processed: tx=${tx.id} transfer=${transferStatus}`);
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  app.get("/api/organizer/clubs/:id/payout-setup", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const club = await storage.getClub(req.params.id);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const maskedAccount = club.bankAccountNumber
        ? `••••${club.bankAccountNumber.slice(-4)}`
        : null;

      const maskedUpi = club.upiId
        ? (() => {
            const atIndex = club.upiId.lastIndexOf("@");
            if (atIndex > 1) {
              return `${club.upiId.slice(0, 2)}••••${club.upiId.slice(atIndex)}`;
            }
            return `••••${club.upiId.slice(-6)}`;
          })()
        : null;

      res.json({
        payoutsEnabled: club.payoutsEnabled ?? false,
        payoutMethod: club.payoutMethod ?? "bank",
        bankAccountName: club.bankAccountName,
        maskedAccountNumber: maskedAccount,
        maskedIfsc: club.bankIfsc ? `${club.bankIfsc.slice(0, 4)}••••••` : null,
        maskedUpiId: maskedUpi,
        payoutConfigured: Boolean(club.razorpayFundAccountId),
      });
    } catch (err) {
      console.error("Error fetching payout setup:", err);
      res.status(500).json({ message: "Failed to fetch payout setup" });
    }
  });

  app.post("/api/organizer/clubs/:id/payout-setup", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const clubId = req.params.id;
      const club = await storage.getClub(clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });

      const { payoutMethod, bankAccountName, bankAccountNumber, bankIfsc, upiId } = req.body;
      if (!payoutMethod || !["bank", "upi"].includes(payoutMethod)) {
        return res.status(400).json({ message: "payoutMethod must be 'bank' or 'upi'" });
      }

      if (payoutMethod === "bank") {
        if (!bankAccountName?.trim()) return res.status(400).json({ message: "Account holder name is required" });
        if (!bankAccountNumber?.trim() || bankAccountNumber.replace(/\D/g, "").length < 9) return res.status(400).json({ message: "Valid bank account number is required" });
        if (!bankIfsc?.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc.trim().toUpperCase())) return res.status(400).json({ message: "Valid IFSC code is required (e.g. HDFC0001234)" });
      } else {
        if (!upiId?.trim() || !upiId.includes("@")) return res.status(400).json({ message: "Valid UPI ID is required (e.g. name@upi)" });
      }

      let contactId = club.razorpayContactId;
      let fundAccountId = club.razorpayFundAccountId;
      let payoutsEnabled = false;

      if (razorpay) {
        try {
          const organiserUser = await storage.getUser(club.creatorUserId ?? "");
          const contactName = club.organizerName || organiserUser?.firstName || club.name;
          const contactEmail = organiserUser?.email ?? undefined;

          if (!contactId) {
            const contact = await createRazorpayContact({
              name: contactName,
              email: contactEmail,
              type: "vendor",
              reference_id: clubId,
            });
            contactId = contact.id;
          }

          const fundAccountPayload: Record<string, unknown> = {
            contact_id: contactId,
            account_type: payoutMethod === "upi" ? "vpa" : "bank_account",
          };
          if (payoutMethod === "upi") {
            fundAccountPayload.vpa = { address: upiId.trim() };
          } else {
            fundAccountPayload.bank_account = {
              name: bankAccountName.trim(),
              ifsc: bankIfsc.trim().toUpperCase(),
              account_number: bankAccountNumber.trim(),
            };
          }
          const fundAccount = await createRazorpayFundAccount(fundAccountPayload);
          fundAccountId = fundAccount.id;
          payoutsEnabled = true;
        } catch (rzpErr: any) {
          console.error("Razorpay contact/fund account creation error:", rzpErr);
          payoutsEnabled = false;
        }
      }

      const updated = await storage.updateClubPayoutSetup(clubId, {
        razorpayContactId: contactId ?? undefined,
        razorpayFundAccountId: fundAccountId ?? undefined,
        bankAccountName: payoutMethod === "bank" ? bankAccountName?.trim() : undefined,
        bankAccountNumber: payoutMethod === "bank" ? bankAccountNumber?.trim() : undefined,
        bankIfsc: payoutMethod === "bank" ? bankIfsc?.trim().toUpperCase() : undefined,
        upiId: payoutMethod === "upi" ? upiId?.trim() : undefined,
        payoutMethod,
        payoutsEnabled: razorpay ? payoutsEnabled : false,
      });

      const maskedAccount = updated?.bankAccountNumber ? `••••${updated.bankAccountNumber.slice(-4)}` : null;
      res.json({
        success: true,
        payoutsEnabled: updated?.payoutsEnabled ?? false,
        payoutMethod: updated?.payoutMethod ?? payoutMethod,
        bankAccountName: updated?.bankAccountName,
        maskedAccountNumber: maskedAccount,
        bankIfsc: updated?.bankIfsc,
        upiId: updated?.upiId,
      });
    } catch (err) {
      console.error("Error saving payout setup:", err);
      res.status(500).json({ message: "Failed to save payout details" });
    }
  });

  app.get("/api/organizer/clubs/:id/earnings", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const earnings = await storage.getClubEarnings(req.params.id);
      res.json(earnings);
    } catch (err) {
      console.error("Error fetching earnings:", err);
      res.status(500).json({ message: "Failed to fetch earnings" });
    }
  });

  app.get("/api/organizer/clubs/:id/earnings/all", isAuthenticated, requireClubManager("id"), async (req: any, res) => {
    try {
      const { status, page, limit } = req.query as Record<string, string | undefined>;
      const result = await storage.getAllClubEarnings(req.params.id, {
        status: status || "all",
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      });
      res.json(result);
    } catch (err) {
      console.error("Error fetching all earnings:", err);
      res.status(500).json({ message: "Failed to fetch earnings history" });
    }
  });

  app.post("/api/admin/payments/retry/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const tx = await storage.getPlatformTransactionById(String(req.params.id));
      if (!tx) return res.status(404).json({ message: "Transaction not found" });
      if (tx.status === "transferred") return res.status(400).json({ message: "Transfer already completed" });

      const club = await storage.getClub(tx.clubId);
      if (!club) return res.status(404).json({ message: "Club not found" });
      if (!club.razorpayFundAccountId || !club.payoutsEnabled) {
        return res.status(400).json({ message: "Club payout not set up — organiser must configure payout details first" });
      }
      if (!razorpay) {
        return res.status(503).json({ message: "Payments not configured" });
      }

      let transferId: string;
      try {
        transferId = await attemptRouteTransfer(tx.razorpayPaymentId, tx.baseAmount, club.razorpayFundAccountId);
      } catch (transferErr: any) {
        console.error("Retry transfer failed:", transferErr);
        return res.status(500).json({ message: "Transfer retry failed — " + (transferErr.message ?? "unknown error") });
      }

      const updated = await storage.updatePlatformTransaction(tx.id, { status: "transferred", razorpayTransferId: transferId });

      if (club.creatorUserId) {
        await storage.createNotification({
          userId: club.creatorUserId,
          type: "payout_transferred",
          title: "Payout Transferred!",
          message: `₹${(tx.baseAmount / 100).toFixed(2)} has been transferred to your account.`,
          linkUrl: `/organizer/earnings?club=${club.id}`,
          isRead: false,
        });
      }

      res.json({ success: true, transaction: updated });
    } catch (err) {
      console.error("Error retrying transfer:", err);
      res.status(500).json({ message: "Failed to retry transfer" });
    }
  });
}
