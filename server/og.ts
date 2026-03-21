import fs from "fs";
import path from "path";
import { storage } from "./storage/index";

const CRAWLER_PATTERNS = [
  "whatsapp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "telegrambot",
  "slackbot",
  "slack-imgproxy",
  "linkedinbot",
  "applebot",
  "discordbot",
  "bingbot",
  "googlebot",
  "yandexbot",
  "duckduckbot",
  "curl/",
  "wget/",
  "python-requests",
  "go-http-client",
  "headlesschrome",
  "prerender",
  "iframely",
  "embedly",
  "vkshare",
  "w3c_validator",
];

export function isCrawler(ua: string | undefined): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_PATTERNS.some((p) => lower.includes(p));
}

export async function readHtmlTemplate(): Promise<string> {
  let templatePath: string;
  if (process.env.NODE_ENV === "production") {
    templatePath = path.resolve(__dirname, "public", "index.html");
  } else {
    templatePath = path.resolve(__dirname, "..", "client", "index.html");
  }
  return fs.promises.readFile(templatePath, "utf-8");
}

export interface OgData {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  type?: string;
}

export function buildOgHtml(template: string, og: OgData): string {
  const type = og.type ?? "website";

  const ogBlock = `
    <meta name="description" content="${escapeAttr(og.description)}" />
    <meta property="og:title" content="${escapeAttr(og.title)}" />
    <meta property="og:description" content="${escapeAttr(og.description)}" />
    <meta property="og:image" content="${escapeAttr(og.imageUrl)}" />
    <meta property="og:url" content="${escapeAttr(og.url)}" />
    <meta property="og:type" content="${escapeAttr(type)}" />
    <meta property="og:site_name" content="CultFam" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(og.title)}" />
    <meta name="twitter:description" content="${escapeAttr(og.description)}" />
    <meta name="twitter:image" content="${escapeAttr(og.imageUrl)}" />
    <link rel="canonical" href="${escapeAttr(og.url)}" />
    <title>${escapeHtml(og.title)}</title>`;

  let html = template;

  html = html.replace(/<title>[^<]*<\/title>/, "");
  html = html.replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, "");
  html = html.replace(/<meta\s+name="description"[^>]*\/?>/gi, "");

  html = html.replace("</head>", `${ogBlock}\n  </head>`);

  return html;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildClubSvg(club: {
  emoji: string;
  name: string;
  category: string;
  shortDesc: string;
  organizerName?: string;
  city?: string | null;
}): string {
  const name = truncate(club.name, 36);
  const desc = truncate(club.shortDesc, 110);
  const category = club.category.toUpperCase();
  const cityLabel = club.city ? ` • ${club.city.toUpperCase()}` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F5F0E8"/>
      <stop offset="100%" stop-color="#EDE7DA"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4622D"/>
      <stop offset="100%" stop-color="#9E4D22"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="url(#accent)"/>

  <rect x="40" y="40" width="200" height="200" rx="32" fill="#fff" fill-opacity="0.5"/>
  <text x="140" y="178" font-size="130" text-anchor="middle" dominant-baseline="middle">${escapeHtml(club.emoji)}</text>

  <rect x="40" y="265" width="${Math.min(category.length * 14 + 32, 280)}" height="40" rx="20" fill="#C4622D" fill-opacity="0.15"/>
  <text x="56" y="291" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#C4622D">${escapeHtml(category)}</text>

  <text x="40" y="380" font-family="Georgia, serif" font-size="72" font-weight="900" fill="#1A1410" letter-spacing="-1">${escapeHtml(name)}</text>

  <text x="40" y="450" font-family="Arial, sans-serif" font-size="28" fill="#4A3F35" fill-opacity="0.85">${escapeHtml(desc)}</text>

  <line x1="40" y1="540" x2="1160" y2="540" stroke="#1A1410" stroke-opacity="0.1" stroke-width="1"/>
  <text x="40" y="590" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="#C4622D" fill-opacity="0.7">CULTFAM</text>
  <text x="160" y="590" font-family="Arial, sans-serif" font-size="22" fill="#1A1410" fill-opacity="0.4">${escapeHtml(cityLabel)}</text>
  <text x="1160" y="590" font-family="Arial, sans-serif" font-size="22" fill="#1A1410" fill-opacity="0.35" text-anchor="end">cultfam.in</text>
</svg>`;
}

export function buildEventSvg(event: {
  title: string;
  startsAt: Date;
  locationText: string;
  clubName?: string;
  clubEmoji?: string;
}): string {
  const title = truncate(event.title, 44);
  const location = truncate(event.locationText, 60);
  const clubName = truncate(event.clubName ?? "CultFam", 36);
  const emoji = event.clubEmoji ?? "📅";
  const dateStr = formatEventDate(event.startsAt);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1A1410"/>
      <stop offset="100%" stop-color="#2E1E13"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4622D"/>
      <stop offset="100%" stop-color="#9E4D22"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="url(#accent)"/>

  <rect x="40" y="40" width="160" height="160" rx="28" fill="#C4622D" fill-opacity="0.15"/>
  <text x="120" y="135" font-size="96" text-anchor="middle" dominant-baseline="middle">${escapeHtml(emoji)}</text>

  <rect x="40" y="225" width="220" height="38" rx="19" fill="#C4622D" fill-opacity="0.2"/>
  <text x="56" y="250" font-family="Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="2" fill="#C4622D">UPCOMING EVENT</text>

  <text x="40" y="355" font-family="Georgia, serif" font-size="66" font-weight="900" fill="#F5F0E8" letter-spacing="-1">${escapeHtml(title)}</text>

  <text x="40" y="435" font-family="Arial, sans-serif" font-size="26" fill="#C4622D" font-weight="600">${escapeHtml(dateStr)}</text>
  <text x="40" y="477" font-family="Arial, sans-serif" font-size="24" fill="#F5F0E8" fill-opacity="0.6">📍 ${escapeHtml(location)}</text>

  <text x="40" y="535" font-family="Arial, sans-serif" font-size="20" fill="#F5F0E8" fill-opacity="0.45">${escapeHtml(clubName)}</text>

  <line x1="40" y1="552" x2="1160" y2="552" stroke="#F5F0E8" stroke-opacity="0.08" stroke-width="1"/>
  <text x="40" y="600" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="3" fill="#C4622D" fill-opacity="0.7">CULTFAM</text>
  <text x="160" y="600" font-family="Arial, sans-serif" font-size="22" fill="#F5F0E8" fill-opacity="0.3"> • TIRUPATI</text>
  <text x="1160" y="600" font-family="Arial, sans-serif" font-size="22" fill="#F5F0E8" fill-opacity="0.3" text-anchor="end">cultfam.in</text>
</svg>`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function formatEventDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = days[d.getDay()];
  const date = d.getDate();
  const month = months[d.getMonth()];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  const min = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${day} ${date} ${month} • ${hour}${min} ${ampm}`;
}
