import { requestWithProject } from "@/app/api/_common/endpoints";
import { NextResponse } from "next/server";

interface NewsletterItem {
  date: string; // ISO format (YYYY-MM-DD)
  title: string;
  link: string;
}

// Simple in-memory cache with TTL
let cache: {
  data: NewsletterItem[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const NEWSLETTER_URL =
  "https://us7.campaign-archive.com/home/?u=4470de6245e702ef226931fa9&id=7967e4716f";

function parseNewsletterHTML(html: string): NewsletterItem[] {
  const items: NewsletterItem[] = [];

  // Match <li class="campaign">...</li> elements
  const liRegex = /<li class="campaign">(.*?)<\/li>/g;
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const content = match[1];

    // Extract date (format: MM/DD/YYYY -)
    const dateMatch = content.match(/^(\d{2}\/\d{2}\/\d{4})\s*-\s*/);
    if (!dateMatch) continue;

    // Parse MM/DD/YYYY and convert to ISO format (YYYY-MM-DD)
    const dateStr = dateMatch[1];
    const [month, day, year] = dateStr.split("/");
    const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

    // Extract link and title from <a> tag
    const linkMatch = content.match(
      /<a\s+href="([^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/a>/,
    );
    if (!linkMatch) continue;

    const link = linkMatch[1];
    const titleFromTitle = linkMatch[2];
    const titleFromContent = linkMatch[3];

    // Use title attribute if available, otherwise use link content
    // Decode HTML entities
    const title = (titleFromTitle || titleFromContent)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    items.push({
      date,
      title,
      link,
    });
  }

  return items;
}

export const GET = requestWithProject(
  async (supabase, profile, request, body, project) => {
    // Check cache
    const now = Date.now();
    if (cache && now - cache.timestamp < CACHE_TTL) {
      return { data: cache.data };
    }

    try {
      // Fetch the newsletter archive page
      const response = await fetch(NEWSLETTER_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NewsletterBot/1.0)",
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch newsletter: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();

      // Find the display_archive div
      const archiveMatch = html.match(
        /<div class="display_archive">([\s\S]*?)<\/div>/,
      );

      if (!archiveMatch) {
        throw new Error("Could not find newsletter archive content");
      }

      const archiveContent = archiveMatch[1];
      const items = parseNewsletterHTML(archiveContent);

      // Update cache
      cache = {
        data: items,
        timestamp: now,
      };

      return { data: items };
    } catch (error: any) {
      console.error("Error fetching newsletter:", error);

      // Return cached data if available, even if expired
      if (cache) {
        return { data: cache.data };
      }

      return NextResponse.json(
        { error: error.message || "Failed to fetch newsletter" },
        { status: 500 },
      );
    }
  },
);
