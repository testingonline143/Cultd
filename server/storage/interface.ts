import {
  type Club, type InsertClub,
  type JoinRequest, type InsertJoinRequest, type User,
  type QuizAnswers, type InsertQuizAnswers, type Event, type InsertEvent,
  type EventRsvp, type InsertEventRsvp,
  type ClubRating, type ClubFaq, type ClubScheduleEntry, type ClubMoment,
  type MomentComment,
  type EventComment,
  type Notification, type InsertNotification,
  type ClubAnnouncement, type InsertClubAnnouncement,
  type ClubPoll, type InsertClubPoll,
  type Kudo,
  type ClubPageSection, type InsertClubPageSection,
  type SectionEvent,
  type ClubProposal, type InsertClubProposal,
  type PlatformTransaction, type InsertPlatformTransaction,
} from "@shared/schema";

export interface IStorage {
  getClubs(params?: { limit?: number; offset?: number }): Promise<Club[]>;
  getClubsCount(): Promise<number>;
  getClubsByCategory(category: string): Promise<Club[]>;
  getClub(id: string): Promise<Club | undefined>;
  createClub(club: InsertClub): Promise<Club>;
  updateClub(id: string, data: Partial<InsertClub>): Promise<Club | undefined>;
  incrementMemberCount(clubId: string): Promise<Club | undefined>;
  decrementMemberCount(clubId: string): Promise<Club | undefined>;
  createJoinRequest(request: InsertJoinRequest): Promise<JoinRequest>;
  getJoinRequests(): Promise<JoinRequest[]>;
  getJoinRequestsByClub(clubId: string): Promise<JoinRequest[]>;
  getJoinRequestsByPhone(phone: string): Promise<JoinRequest[]>;
  getJoinRequestsByUser(userId: string): Promise<JoinRequest[]>;
  getJoinRequest(id: string): Promise<JoinRequest | undefined>;
  markJoinRequestDone(id: string): Promise<JoinRequest | undefined>;
  approveJoinRequest(id: string): Promise<JoinRequest | undefined>;
  rejectJoinRequest(id: string): Promise<JoinRequest | undefined>;
  deleteJoinRequest(id: string): Promise<void>;
  getPendingJoinRequestCount(clubId: string): Promise<number>;
  getApprovedMembersByClub(clubId: string): Promise<JoinRequest[]>;
  hasExistingJoinRequest(clubId: string, userId: string): Promise<JoinRequest | undefined>;
  getClubsByCreator(creatorUserId: string): Promise<Club[]>;
  getUser(id: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  saveQuizAnswers(answers: InsertQuizAnswers): Promise<QuizAnswers>;
  getQuizAnswers(userId: string): Promise<QuizAnswers | undefined>;
  searchClubs(params: { search?: string; category?: string; city?: string; vibe?: string; timeOfDay?: string; limit?: number; offset?: number }): Promise<Club[]>;
  searchClubsCount(params: { search?: string; category?: string; city?: string; vibe?: string; timeOfDay?: string }): Promise<number>;
  getUserAttendanceStats(userId: string): Promise<{ clubId: string; clubName: string; clubEmoji: string; totalRsvps: number; attended: number }[]>;
  getWaitlistCount(eventId: string): Promise<number>;
  getUserWaitlistPosition(eventId: string, userId: string): Promise<number>;
  promoteFirstFromWaitlist(eventId: string): Promise<EventRsvp | undefined>;
  getMemberDirectory(clubId: string): Promise<{ userId: string | null; name: string; profileImageUrl: string | null; joinedAt: Date | null }[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventsByClub(clubId: string): Promise<Event[]>;
  getUpcomingEvents(city?: string, limit?: number): Promise<(Event & { clubName: string; clubEmoji: string; rsvpCount: number })[]>;
  extendEventSeries(clubId: string, title: string, recurrenceRule: string): Promise<Event[]>;
  createRsvp(rsvp: InsertEventRsvp): Promise<EventRsvp>;
  cancelRsvp(eventId: string, userId: string): Promise<void>;
  getRsvpsByEvent(eventId: string): Promise<(EventRsvp & { userName: string | null })[]>;
  getUserRsvp(eventId: string, userId: string): Promise<EventRsvp | undefined>;
  getRsvpCount(eventId: string): Promise<number>;
  getRsvpsByUser(userId: string): Promise<(EventRsvp & { eventTitle: string; eventStartsAt: Date; eventLocation: string; clubName: string; clubEmoji: string })[]>;
  getStats(): Promise<{ totalMembers: number; totalClubs: number; upcomingEvents: number }>;
  getCheckedInCount(eventId: string): Promise<number>;
  getEventAttendees(eventId: string): Promise<(EventRsvp & { userName: string | null; checkedIn: boolean | null; checkedInAt: Date | null })[]>;
  getClubActivity(clubId: string): Promise<{ recentJoins: number; recentJoinNames: string[]; totalEvents: number; lastEventDate: Date | null }>;
  getRecentActivityFeed(limit?: number): Promise<{ name: string; clubName: string; clubEmoji: string; createdAt: Date | null }[]>;
  getClubsWithRecentJoins(): Promise<Record<string, number>>;
  getRsvpById(rsvpId: string): Promise<EventRsvp | undefined>;
  getRsvpByToken(token: string): Promise<(EventRsvp & { userName: string | null }) | undefined>;
  checkInRsvpByToken(token: string): Promise<EventRsvp | undefined>;
  checkInRsvpById(rsvpId: string): Promise<EventRsvp | undefined>;
  updateUserRole(userId: string, role: string): Promise<User | undefined>;
  getClubRatings(clubId: string): Promise<ClubRating[]>;
  getClubAverageRating(clubId: string): Promise<{ average: number; count: number }>;
  getUserRating(clubId: string, userId: string): Promise<ClubRating | undefined>;
  upsertRating(clubId: string, userId: string, rating: number, review?: string): Promise<ClubRating>;
  getClubFaqs(clubId: string): Promise<ClubFaq[]>;
  createFaq(clubId: string, question: string, answer: string): Promise<ClubFaq>;
  updateFaq(id: string, question: string, answer: string): Promise<ClubFaq | undefined>;
  deleteFaq(id: string): Promise<void>;
  getClubSchedule(clubId: string): Promise<ClubScheduleEntry[]>;
  createScheduleEntry(clubId: string, data: { dayOfWeek: string; startTime: string; endTime?: string; activity: string; location?: string }): Promise<ClubScheduleEntry>;
  updateScheduleEntry(id: string, data: { dayOfWeek?: string; startTime?: string; endTime?: string; activity?: string; location?: string }): Promise<ClubScheduleEntry | undefined>;
  deleteScheduleEntry(id: string): Promise<void>;
  getClubMoments(clubId: string): Promise<(ClubMoment & { commentCount: number })[]>;
  createMoment(clubId: string, caption: string, emoji?: string, imageUrl?: string, authorUserId?: string, authorName?: string): Promise<ClubMoment>;
  updateMoment(id: string, data: { caption?: string; emoji?: string }): Promise<ClubMoment | undefined>;
  deleteMoment(id: string): Promise<void>;
  getCommentsByMoment(momentId: string): Promise<MomentComment[]>;
  createComment(data: { momentId: string; userId: string; userName: string; userImageUrl?: string | null; content: string }): Promise<MomentComment>;
  deleteComment(commentId: string, userId: string, isOrganiser?: boolean): Promise<void>;
  getMomentById(momentId: string): Promise<ClubMoment | undefined>;
  getJoinRequestCountByClub(clubId: string): Promise<number>;
  hasUserJoinedClub(clubId: string, userId: string): Promise<boolean>;
  getUserJoinStatus(clubId: string, userId: string): Promise<{ status: string | null; requestId: string | null }>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  updateEvent(id: string, data: Partial<InsertEvent>): Promise<Event | undefined>;
  cancelEvent(id: string): Promise<Event | undefined>;
  getMembersPreview(clubId: string, limit?: number): Promise<{ userId: string | null; name: string; profileImageUrl: string | null }[]>;
  getAdminAnalytics(): Promise<{ totalUsers: number; totalClubs: number; activeClubs: number; totalEvents: number; totalRsvps: number; totalCheckins: number; totalMoments: number; totalComments: number; newUsersThisWeek: number; newEventsThisWeek: number; newJoinsThisWeek: number; cityCounts: { city: string; count: number }[] }>;
  getAdminActivityFeed(): Promise<{ recentJoins: { name: string; clubName: string; createdAt: Date | null }[]; recentClubs: { name: string; emoji: string; city: string; createdAt: Date | null }[]; recentEvents: { title: string; clubName: string; startsAt: Date }[] }>;
  getAllUsers(): Promise<{ id: string; email: string | null; firstName: string | null; city: string | null; role: string | null; createdAt: Date | null; clubCount: number }[]>;
  getAllEventsAdmin(): Promise<{ id: string; title: string; clubId: string; clubName: string; clubEmoji: string; startsAt: Date; rsvpCount: number; checkedInCount: number; isCancelled: boolean | null; maxCapacity: number }[]>;
  getOrganizerInsights(clubId: string): Promise<{ totalMembers: number; pendingRequests: number; totalEvents: number; avgAttendanceRate: number; topEvent: { title: string; attended: number; total: number } | null; recentJoins: { name: string; date: Date | null }[]; recentRsvps: { userName: string; eventTitle: string; date: Date | null }[] }>;
  getUserApprovedClubs(userId: string): Promise<Club[]>;
  getFeedMoments(limit?: number, userId?: string, offset?: number): Promise<(ClubMoment & { clubName: string; clubEmoji: string; clubLocation: string; commentCount: number; userHasLiked: boolean; authorName: string | null; authorUserId: string | null })[]>;
  getFeedMomentsCount(): Promise<number>;
  getClubAnalytics(clubId: string): Promise<{
    memberGrowth: { week: string; count: number }[];
    perEventStats: { id: string; title: string; date: string; rsvps: number; attended: number; rate: number; isCancelled: boolean | null }[];
    mostActiveMembers: { name: string; rsvpCount: number }[];
    engagementRate: number;
    noShowRate: number;
  }>;
  getClubsForOrganiser(userId: string): Promise<Club[]>;
  isClubManager(clubId: string, userId: string): Promise<boolean>;
  getClubAnnouncements(clubId: string): Promise<ClubAnnouncement[]>;
  createAnnouncement(data: InsertClubAnnouncement): Promise<ClubAnnouncement>;
  deleteAnnouncement(id: string, clubId: string): Promise<void>;
  getClubMemberUserIds(clubId: string): Promise<string[]>;
  getClubPolls(clubId: string, viewerUserId?: string): Promise<(ClubPoll & { voteCounts: number[]; userVote: number | null })[]>;
  createPoll(data: InsertClubPoll): Promise<ClubPoll>;
  deletePoll(id: string, clubId: string): Promise<void>;
  closePoll(id: string, clubId: string): Promise<void>;
  castVote(pollId: string, userId: string, optionIndex: number): Promise<void>;
  addCoOrganiser(clubId: string, userId: string): Promise<void>;
  removeCoOrganiser(clubId: string, userId: string): Promise<void>;
  likeMoment(momentId: string, userId: string): Promise<void>;
  unlikeMoment(momentId: string, userId: string): Promise<void>;
  getMomentLikeStatus(momentId: string, userId: string): Promise<boolean>;
  getPublicClubMembers(clubId: string): Promise<{ name: string; profileImageUrl: string | null }[]>;
  getUserFoundingClubs(userId: string): Promise<{ clubId: string; clubName: string; isFoundingMember: boolean | null }[]>;
  getEventComments(eventId: string): Promise<EventComment[]>;
  createEventComment(eventId: string, userId: string, userName: string, userImageUrl: string | null, text: string): Promise<EventComment>;
  approveJoinRequestWithFoundingCheck(requestId: string, clubId: string): Promise<JoinRequest | undefined>;
  getUserAdminDetail(userId: string): Promise<{
    clubs: { clubId: string; clubName: string; clubEmoji: string; joinedAt: Date | null }[];
    events: { id: string; title: string; startsAt: Date; clubName: string }[];
    moments: { id: string; caption: string | null; createdAt: Date | null }[];
    joinRequests: { clubName: string; status: string; createdAt: Date | null }[];
  }>;
  getAllPollsAdmin(): Promise<{ id: string; clubId: string; clubName: string; clubEmoji: string; question: string; options: string[]; isOpen: boolean | null; createdAt: Date | null; votes: number[]; totalVotes: number }[]>;
  closePollAdmin(pollId: string): Promise<void>;
  broadcastNotification(title: string, message: string, linkUrl?: string): Promise<number>;
  getWeeklyGrowth(): Promise<{ week: string; users: number; events: number; moments: number }[]>;
  updateClubHealth(clubId: string, status: string, label: string): Promise<void>;
  createKudo(data: { eventId: string; giverId: string; receiverId: string; kudoType: string }): Promise<Kudo>;
  hasGivenKudo(eventId: string, giverId: string): Promise<boolean>;
  getKudosByReceiver(userId: string): Promise<(Kudo & { eventTitle: string; eventStartsAt: Date })[]>;
  getEventAttendeesForKudo(eventId: string, excludeUserId: string): Promise<{ userId: string; userName: string | null }[]>;
  autoJoinSampleClubs(userId: string): Promise<Club[]>;
  getClubBySlug(slug: string): Promise<Club | undefined>;
  updateClubSlug(clubId: string, slug: string): Promise<Club | undefined>;
  generateSlugForClub(clubId: string): Promise<string | null>;
  getPageSections(clubId: string): Promise<ClubPageSection[]>;
  createPageSection(data: InsertClubPageSection): Promise<ClubPageSection>;
  updatePageSection(id: string, data: Partial<InsertClubPageSection>): Promise<ClubPageSection | undefined>;
  deletePageSection(id: string): Promise<void>;
  reorderPageSections(clubId: string, sectionIds: string[]): Promise<void>;
  getSectionEvents(sectionId: string): Promise<(SectionEvent & { eventTitle: string; eventStartsAt: Date; eventLocation: string })[]>;
  addSectionEvent(sectionId: string, eventId: string, position: number): Promise<SectionEvent>;
  removeSectionEvent(id: string): Promise<void>;
  getPublicPageData(clubId: string): Promise<{
    club: Club;
    sections: (ClubPageSection & { events: { id: string; eventId: string; title: string; startsAt: Date; location: string; position: number }[] })[];
    announcements: ClubAnnouncement[];
    schedule: ClubScheduleEntry[];
    moments: ClubMoment[];
    memberCount: number;
    upcomingEventCount: number;
    pastEventCount: number;
    rating: number | null;
  }>;
  createClubProposal(data: InsertClubProposal): Promise<ClubProposal>;
  getClubProposalsByUser(userId: string): Promise<ClubProposal[]>;
  getAllClubProposals(): Promise<(ClubProposal & { userName: string | null; userEmail: string | null })[]>;
  updateClubProposalStatus(id: string, status: string, reviewNote?: string): Promise<ClubProposal | undefined>;
  getClubProposal(id: string): Promise<ClubProposal | undefined>;
  getPendingProposalCount(): Promise<number>;
  getEventAttendanceReport(eventId: string, clubId: string): Promise<{ userId: string; userName: string | null; status: string; checkedIn: boolean | null; checkedInAt: Date | null; phone: string | null }[]>;
  getClubMembersEnriched(clubId: string): Promise<{ id: string; userId: string | null; name: string; phone: string; profileImageUrl: string | null; bio: string | null; city: string | null; joinedAt: Date | null; isFoundingMember: boolean | null; eventsAttended: number }[]>;
  getEventFormQuestions(eventId: string): Promise<import("@shared/schema").EventFormQuestion[]>;
  addEventFormQuestion(eventId: string, question: string, sortOrder: number): Promise<import("@shared/schema").EventFormQuestion>;
  deleteEventFormQuestion(id: string): Promise<void>;
  setEventFormMandatory(eventId: string, mandatory: boolean): Promise<import("@shared/schema").Event | undefined>;
  saveEventFormResponses(eventId: string, userId: string, responses: { questionId: string; answer: string }[]): Promise<void>;
  getEventFormResponses(eventId: string): Promise<{ userId: string; userName: string | null; answers: { question: string; answer: string }[] }[]>;
  hasUserSubmittedFormResponses(eventId: string, userId: string): Promise<boolean>;
  getClubSurveySummary(clubId: string): Promise<{ eventId: string; eventTitle: string; eventDate: Date; responseCount: number }[]>;
  getEventTicketTypes(eventId: string): Promise<import("@shared/schema").EventTicketType[]>;
  createEventTicketType(eventId: string, data: { name: string; price: number; description?: string; sortOrder?: number }): Promise<import("@shared/schema").EventTicketType>;
  updateEventTicketType(id: number, data: { name?: string; price?: number; description?: string | null; sortOrder?: number; isActive?: boolean }): Promise<import("@shared/schema").EventTicketType | undefined>;
  deleteEventTicketType(id: number): Promise<void>;
  createPlatformTransaction(data: InsertPlatformTransaction): Promise<PlatformTransaction>;
  updatePlatformTransaction(id: string, data: Partial<Pick<PlatformTransaction, "status" | "razorpayTransferId">>): Promise<PlatformTransaction | undefined>;
  getPlatformTransactions(params: { clubId?: string; userId?: string; status?: string; page?: number; limit?: number }): Promise<{ transactions: (PlatformTransaction & { eventTitle: string; clubName: string; userName: string | null })[]; total: number }>;
  getPlatformTransactionByRsvpId(rsvpId: string): Promise<PlatformTransaction | undefined>;
  getPlatformTransactionById(id: string): Promise<PlatformTransaction | undefined>;
  getPlatformTransactionByPaymentId(razorpayPaymentId: string): Promise<PlatformTransaction | undefined>;
  getClubEarnings(clubId: string): Promise<{ totalTransferred: number; totalPending: number; totalFailed: number; recentTransactions: (PlatformTransaction & { eventTitle: string })[] }>;
  getAllClubEarnings(clubId: string, params: { status?: string; page?: number; limit?: number }): Promise<{ transactions: (PlatformTransaction & { eventTitle: string; ticketTypeName: string | null })[]; total: number }>;
  getAdminPaymentStats(): Promise<{
    platformRevenue: number;
    totalVolume: number;
    pendingCount: number;
    failedCount: number;
    topClubs: { clubId: string; clubName: string; city: string; totalVolume: number; organizerReceived: number; platformEarned: number }[];
    commissionRates: { clubId: string; clubName: string; city: string; commissionType: string | null; commissionValue: number | null; totalTickets: number; totalEarned: number }[];
  }>;
  updateClubCommission(clubId: string, data: { commissionType: string; commissionValue: number; commissionSetByAdmin: boolean; commissionNote?: string }): Promise<Club | undefined>;
  updateClubPayoutSetup(clubId: string, data: { razorpayContactId?: string; razorpayFundAccountId?: string; bankAccountName?: string; bankAccountNumber?: string; bankIfsc?: string; upiId?: string; payoutMethod?: string; payoutsEnabled?: boolean }): Promise<Club | undefined>;
  getUserPaymentHistory(userId: string): Promise<(PlatformTransaction & { eventTitle: string; clubName: string; ticketTypeName: string | null })[]>;
}

