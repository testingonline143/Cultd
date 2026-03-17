import { db } from "./db";
import { clubs, clubFaqs, clubScheduleEntries, clubMoments, users } from "@shared/schema";
import { log } from "./index";
import { eq, isNull } from "drizzle-orm";

const SEED_CLUBS = [
  {
    name: "Tirumala Trekkers",
    category: "Trekking",
    emoji: "🏔️",
    bgColor: "#e8f4e8",
    shortDesc: "Weekly treks around Tirumala hills and Eastern Ghats. All fitness levels welcome.",
    fullDesc: "We've been trekking together since 2022. Every Sunday morning we hit a new trail — from Tirumala Ghat roads to Talakona, Gunjana, and Kapila Theertham. We go at the slowest person's pace. Beginners always welcome.",
    organizerName: "Ravi Kumar",
    organizerYears: "3 years running",
    organizerAvatar: "👨‍🦱",
    organizerResponse: "Responds within 2 hrs",
    memberCount: 84,
    schedule: "Every Sunday, 5:30 AM",
    location: "Alipiri Gate",
    activeSince: "2022",
    whatsappNumber: "919000000001",
    healthStatus: "green",
    healthLabel: "Very Active",
    lastActive: "Met last Sunday",
    foundingTaken: 16,
    foundingTotal: 20,
    timeOfDay: "morning",
  },
  {
    name: "Tirupati Reads",
    category: "Books",
    emoji: "📚",
    bgColor: "#fef9e7",
    shortDesc: "Monthly book club for fiction, non-fiction, and Telugu literature lovers.",
    fullDesc: "Started by a group of college friends, Tirupati Reads has grown into a warm community of 50+ book lovers. We read one book a month, meet at a local café, and genuinely argue about whether the ending was worth it. Telugu and English books both welcome.",
    organizerName: "Priya Sharma",
    organizerYears: "2 years running",
    organizerAvatar: "👩",
    organizerResponse: "Responds within 4 hrs",
    memberCount: 52,
    schedule: "First Saturday, 6:00 PM",
    location: "Café Tirupati, TP Area",
    activeSince: "2023",
    whatsappNumber: "919000000002",
    healthStatus: "green",
    healthLabel: "Very Active",
    lastActive: "Met last Saturday",
    foundingTaken: 11,
    foundingTotal: 20,
    timeOfDay: "evening",
  },
  {
    name: "Tirupati Cyclists",
    category: "Cycling",
    emoji: "🚴",
    bgColor: "#e8f0fe",
    shortDesc: "Early morning rides through Tirupati city and surrounding villages. All bikes welcome.",
    fullDesc: "We ride every Saturday and Sunday at 5:45 AM from RTC Bus Stand. Routes from 20km to 60km. Road bikes, MTBs, and hybrids all welcome. Safety first — helmet always required, no exceptions.",
    organizerName: "Suresh Reddy",
    organizerYears: "4 years running",
    organizerAvatar: "👨",
    organizerResponse: "Responds within 1 hr",
    memberCount: 67,
    schedule: "Sat & Sun, 5:45 AM",
    location: "RTC Bus Stand",
    activeSince: "2021",
    whatsappNumber: "919000000003",
    healthStatus: "green",
    healthLabel: "Very Active",
    lastActive: "Rode yesterday",
    foundingTaken: 14,
    foundingTotal: 20,
    timeOfDay: "morning",
  },
  {
    name: "Lens & Light Tirupati",
    category: "Photography",
    emoji: "📷",
    bgColor: "#f3e8ff",
    shortDesc: "Photography walks around Tirupati's temples, markets, and nature spots.",
    fullDesc: "Monthly photo walks plus editing workshops and print exhibitions. From phone cameras to DSLRs — all are welcome. Tirumala at dawn, Govindaraja Swamy temple at golden hour, the chaos of Balaji Nagar market — Tirupati is full of frames waiting to be captured.",
    organizerName: "Anitha Devi",
    organizerYears: "2 years running",
    organizerAvatar: "👩‍🦱",
    organizerResponse: "Responds within 6 hrs",
    memberCount: 39,
    schedule: "2nd Sunday, 6:00 AM",
    location: "Govindaraja Temple Gate",
    activeSince: "2023",
    whatsappNumber: "919000000004",
    healthStatus: "green",
    healthLabel: "Active",
    lastActive: "Met last Saturday",
    foundingTaken: 8,
    foundingTotal: 20,
    timeOfDay: "morning",
  },
  {
    name: "Tirupati Fitness Tribe",
    category: "Fitness",
    emoji: "💪",
    bgColor: "#fde8e8",
    shortDesc: "Outdoor bootcamp, yoga, and running. Free community fitness for all ages.",
    fullDesc: "We meet at Bairagipatteda Park every morning at 6 AM. Bootcamp on Monday-Wednesday-Friday, yoga on Tuesday-Thursday, and group runs on Saturday. All ages and levels welcome. No equipment needed, just show up ready to move.",
    organizerName: "Suresh Babu",
    organizerYears: "5 years running",
    organizerAvatar: "🧔",
    organizerResponse: "Responds within 1 hr",
    memberCount: 120,
    schedule: "Mon-Sat, 6:00 AM",
    location: "Bairagipatteda Park",
    activeSince: "2020",
    whatsappNumber: "919000000005",
    healthStatus: "green",
    healthLabel: "Very Active",
    lastActive: "Met this morning",
    foundingTaken: 20,
    foundingTotal: 20,
    timeOfDay: "morning",
  },
  {
    name: "Telugu Writers Circle",
    category: "Books",
    emoji: "✍️",
    bgColor: "#fff3e0",
    shortDesc: "For aspiring Telugu writers — poetry, short stories, and essays.",
    fullDesc: "Share your work in a safe, encouraging space. Monthly anthology publications and open mic events. Whether you write in Telugu or English, if you love putting words on paper, this is your tribe. We celebrate every voice.",
    organizerName: "Lakshmi Naidu",
    organizerYears: "1 year running",
    organizerAvatar: "👩‍🏫",
    organizerResponse: "Responds within 8 hrs",
    memberCount: 28,
    schedule: "3rd Sunday, 4:00 PM",
    location: "District Library",
    activeSince: "2024",
    whatsappNumber: "919000000006",
    healthStatus: "green",
    healthLabel: "Active",
    lastActive: "Met last Sunday",
    foundingTaken: 6,
    foundingTotal: 20,
    timeOfDay: "evening",
  },
  {
    name: "Tirupati Sketchers",
    category: "Art",
    emoji: "🎨",
    bgColor: "#e8f5e9",
    shortDesc: "Urban sketching and watercolour sessions across Tirupati's temples and streets.",
    fullDesc: "Bring your sketchbook and discover the city through art. We sketch temples, streets, markets, and nature spots. All mediums welcome — pencil, ink, watercolour, digital. Monthly exhibitions at local cafes.",
    organizerName: "Kiran Mohan",
    organizerYears: "1 year running",
    organizerAvatar: "👨‍🎨",
    organizerResponse: "Responds within 12 hrs",
    memberCount: 22,
    schedule: "2nd & 4th Sunday, 9:00 AM",
    location: "TTD Kalyanamastu",
    activeSince: "2024",
    whatsappNumber: "919000000007",
    healthStatus: "yellow",
    healthLabel: "Growing",
    lastActive: "Met last weekend",
    foundingTaken: 4,
    foundingTotal: 20,
    timeOfDay: "weekends",
  },
];

export async function seedDatabase() {
  if (!process.env.DATABASE_URL) {
    console.log("[seed] DATABASE_URL not set, skipping database seeding");
    return;
  }

  try {
    const existing = await db.select().from(clubs);
    if (existing.length > 0) {
      log("Database already seeded, skipping...", "seed");

      const existingFaqs = await db.select().from(clubFaqs);
      if (existingFaqs.length === 0) {
        await seedClubContent();
      }

      const unclaimedClubs = await db.select({ id: clubs.id }).from(clubs).where(isNull(clubs.creatorUserId));
      if (unclaimedClubs.length > 0) {
        const adminUsers = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
        if (adminUsers.length > 0) {
          const adminId = adminUsers[0].id;
          await db.update(clubs).set({ creatorUserId: adminId }).where(isNull(clubs.creatorUserId));
          log(`Auto-assigned admin user as creator of ${unclaimedClubs.length} unclaimed clubs`, "seed");
        }
      }

      return;
    }

    await db.insert(clubs).values(SEED_CLUBS);
    log(`Seeded ${SEED_CLUBS.length} clubs`, "seed");
    await seedClubContent();
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}

async function seedClubContent() {
  try {
    const allClubs = await db.select({ id: clubs.id, name: clubs.name }).from(clubs);
    const clubMap: Record<string, string> = {};
    for (const c of allClubs) {
      clubMap[c.name] = c.id;
    }

    const faqData = [
      { club: "Tirumala Trekkers", faqs: [
        { question: "Do I need trekking experience?", answer: "Not at all! We welcome all fitness levels. We go at the slowest person's pace and have easier routes for beginners." },
        { question: "What should I bring?", answer: "Comfortable shoes, 1-2 litres of water, a light snack, sunscreen, and a cap. We'll share a detailed checklist when you join." },
        { question: "Is there any fee to join?", answer: "No membership fee. You only pay for transport if we carpool (usually split equally). Everything else is free." },
      ]},
      { club: "Tirupati Reads", faqs: [
        { question: "How do you pick the book each month?", answer: "Members suggest books and we vote in the WhatsApp group. The most voted book wins. We alternate between Telugu and English." },
        { question: "What if I haven't finished the book?", answer: "Come anyway! Half the fun is hearing others' perspectives. No pressure to finish — just bring your thoughts on whatever you read." },
        { question: "Do I need to buy the book?", answer: "We share PDFs and audiobook links when available. Some members swap physical copies too." },
      ]},
      { club: "Tirupati Cyclists", faqs: [
        { question: "What kind of bike do I need?", answer: "Any bike works — road bike, MTB, hybrid, even a regular cycle. As long as it has working brakes, you're good." },
        { question: "Is a helmet mandatory?", answer: "Yes, absolutely. No helmet, no ride. Safety is our number one rule. We can help you find an affordable one." },
        { question: "How far do you ride?", answer: "Routes range from 20km to 60km. We always have a shorter route option for beginners. Nobody gets left behind." },
      ]},
      { club: "Lens & Light Tirupati", faqs: [
        { question: "Can I join with just a phone camera?", answer: "Of course! Some of our best shots have been taken on phones. It's about the eye, not the equipment." },
        { question: "Do you teach editing?", answer: "Yes, we run monthly editing workshops covering Lightroom, Snapseed, and basic color grading. All free for members." },
      ]},
      { club: "Tirupati Fitness Tribe", faqs: [
        { question: "Do I need to be fit to join?", answer: "Nope! We have all ages and levels. The trainers modify exercises for beginners. Just show up and move." },
        { question: "What should I wear?", answer: "Comfortable workout clothes, running shoes, and bring a water bottle. We exercise outdoors so dress for the weather." },
        { question: "Is there a trainer?", answer: "Yes, we have two certified trainers who volunteer their time. Bootcamp and yoga sessions are instructor-led." },
      ]},
      { club: "Telugu Writers Circle", faqs: [
        { question: "Do I have to write in Telugu?", answer: "No! We welcome writers in both Telugu and English. Many of our members write in both languages." },
        { question: "Will my work be published?", answer: "We publish a monthly digital anthology featuring member submissions. Your work gets read by the whole community." },
      ]},
      { club: "Tirupati Sketchers", faqs: [
        { question: "I'm a complete beginner — can I join?", answer: "Absolutely. Half our members started with zero drawing experience. We have mentors who help beginners with basics." },
        { question: "What materials should I bring?", answer: "A sketchbook and any pencil/pen. That's it! As you grow, you can explore watercolours, ink, or digital — but start simple." },
      ]},
    ];

    const scheduleData = [
      { club: "Tirumala Trekkers", entries: [
        { dayOfWeek: "Sunday", startTime: "5:30 AM", endTime: "10:00 AM", activity: "Weekly Trek", location: "Alipiri Gate" },
      ]},
      { club: "Tirupati Reads", entries: [
        { dayOfWeek: "Saturday", startTime: "6:00 PM", endTime: "8:00 PM", activity: "Book Discussion", location: "Cafe Tirupati, TP Area" },
      ]},
      { club: "Tirupati Cyclists", entries: [
        { dayOfWeek: "Saturday", startTime: "5:45 AM", endTime: "8:00 AM", activity: "Weekend Long Ride", location: "RTC Bus Stand" },
        { dayOfWeek: "Sunday", startTime: "5:45 AM", endTime: "7:30 AM", activity: "Recovery Ride", location: "RTC Bus Stand" },
      ]},
      { club: "Lens & Light Tirupati", entries: [
        { dayOfWeek: "Sunday", startTime: "6:00 AM", endTime: "9:00 AM", activity: "Photo Walk", location: "Govindaraja Temple Gate" },
        { dayOfWeek: "Saturday", startTime: "4:00 PM", endTime: "6:00 PM", activity: "Editing Workshop", location: "Community Hall, TP Area" },
      ]},
      { club: "Tirupati Fitness Tribe", entries: [
        { dayOfWeek: "Monday", startTime: "6:00 AM", endTime: "7:00 AM", activity: "Bootcamp", location: "Bairagipatteda Park" },
        { dayOfWeek: "Tuesday", startTime: "6:00 AM", endTime: "7:00 AM", activity: "Yoga", location: "Bairagipatteda Park" },
        { dayOfWeek: "Wednesday", startTime: "6:00 AM", endTime: "7:00 AM", activity: "Bootcamp", location: "Bairagipatteda Park" },
        { dayOfWeek: "Thursday", startTime: "6:00 AM", endTime: "7:00 AM", activity: "Yoga", location: "Bairagipatteda Park" },
        { dayOfWeek: "Friday", startTime: "6:00 AM", endTime: "7:00 AM", activity: "Bootcamp", location: "Bairagipatteda Park" },
        { dayOfWeek: "Saturday", startTime: "5:30 AM", endTime: "7:00 AM", activity: "Group Run", location: "Bairagipatteda Park" },
      ]},
      { club: "Telugu Writers Circle", entries: [
        { dayOfWeek: "Sunday", startTime: "4:00 PM", endTime: "6:00 PM", activity: "Writing Circle", location: "District Library" },
      ]},
      { club: "Tirupati Sketchers", entries: [
        { dayOfWeek: "Sunday", startTime: "9:00 AM", endTime: "12:00 PM", activity: "Urban Sketching", location: "TTD Kalyanamastu" },
      ]},
    ];

    const now = new Date();
    const momentsData = [
      { club: "Tirumala Trekkers", moments: [
        { caption: "First trek of the year! 42 people showed up at Alipiri Gate at 5:30 AM. Energy was unreal.", emoji: "🔥", createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
        { caption: "Talakona waterfall trek completed. 28 km, 6 hours, zero injuries. Proud of this crew.", emoji: "⭐", createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        { caption: "Welcome to 12 new members who joined this month! Our biggest batch yet.", emoji: "heart", createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Tirupati Reads", moments: [
        { caption: "Just finished discussing 'Maa Nanna Bali' by Sriramana. Heated debate on the ending — best session yet!", emoji: "⭐", createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { caption: "New record: 31 members at Saturday's meetup. Had to pull extra chairs from the cafe!", emoji: "🔥", createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Tirupati Cyclists", moments: [
        { caption: "60 km Chandragiri Fort ride done! Beautiful sunrise views. 18 riders completed the route.", emoji: "🔥", createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
        { caption: "New personal best on the Ghat road route — average speed up to 22 km/h as a group!", emoji: "⭐", createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { caption: "Donated 15 helmets to new members who couldn't afford one. Safety first, always.", emoji: "heart", createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Lens & Light Tirupati", moments: [
        { caption: "Golden hour shoot at Govindaraja temple — captured some stunning shots. Gallery coming soon!", emoji: "⭐", createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
        { caption: "Our cafe exhibition at Brew & Bite was a hit! 40+ prints displayed, 8 sold.", emoji: "🔥", createdAt: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Tirupati Fitness Tribe", moments: [
        { caption: "Monday bootcamp hit 45 people today! Park was packed. Love this energy.", emoji: "🔥", createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
        { caption: "Yoga Thursday was so peaceful. 30 members under the banyan tree at sunrise.", emoji: "heart", createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) },
        { caption: "Group ran 10 km together on Saturday. 5 members hit their first ever 10 km!", emoji: "⭐", createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Telugu Writers Circle", moments: [
        { caption: "Monthly anthology published! 14 poems and 3 short stories. Our best edition yet.", emoji: "⭐", createdAt: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) },
        { caption: "Open mic night was magical. First-time writers reading their work aloud — so much courage.", emoji: "heart", createdAt: new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000) },
      ]},
      { club: "Tirupati Sketchers", moments: [
        { caption: "Sketched the Balaji Nagar market chaos. 15 sketchers, 15 completely different perspectives.", emoji: "⭐", createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        { caption: "Watercolour workshop with guest artist from Hyderabad. Everyone learned wet-on-wet technique!", emoji: "🔥", createdAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000) },
      ]},
    ];

    for (const { club, faqs } of faqData) {
      const clubId = clubMap[club];
      if (!clubId) continue;
      for (let i = 0; i < faqs.length; i++) {
        await db.insert(clubFaqs).values({ clubId, question: faqs[i].question, answer: faqs[i].answer, sortOrder: i });
      }
    }

    for (const { club, entries } of scheduleData) {
      const clubId = clubMap[club];
      if (!clubId) continue;
      for (const entry of entries) {
        await db.insert(clubScheduleEntries).values({ clubId, ...entry });
      }
    }

    for (const { club, moments } of momentsData) {
      const clubId = clubMap[club];
      if (!clubId) continue;
      for (const moment of moments) {
        await db.insert(clubMoments).values({ clubId, caption: moment.caption, emoji: moment.emoji, createdAt: moment.createdAt });
      }
    }

    log("Seeded FAQs, schedule entries, and moments for clubs", "seed");
  } catch (err) {
    console.error("Error seeding club content:", err);
  }
}
