export const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSd-eBeAuYkde8q-AKXvkqR2r0ogPmtJMJ4pzHSBsr2AcqUcBQsQwrpmZ1ecBUxBmzZiMTwn77NoZ-s/pub?output=csv";

export const PLATFORM_LINKS = {
  website: "https://alyrisband.com",
  tiktok: "https://tiktok.com/@alyrisband",
  instagram: "https://instagram.com/alyrisband",
  youtube: "https://www.youtube.com/@ALYRISBand",
  facebook: "https://www.facebook.com/share/1CBNjjaBgW/?mibextid=wwXIfr",
  spotify: "https://open.spotify.com/artist/2OLxuGyo18gD3Xj7QZVXg9?si=hwSqS-DlQByonLoHRYDfSw",
};

export const METRIC_DEFINITIONS = [
  {
    key: "totalStreams",
    title: "Total Streams",
    label: "TuneCore total",
    category: "Totals",
    href: PLATFORM_LINKS.website,
    color: "#f59e0b",
  },
  {
    key: "totalFollowers",
    title: "Total Followers",
    label: "All platforms",
    category: "Totals",
    href: PLATFORM_LINKS.website,
    color: "#14b8a6",
  },
  {
    key: "instagramFollowers",
    title: "Instagram Followers",
    label: "Instagram",
    category: "Social",
    href: PLATFORM_LINKS.instagram,
    color: "#ec4899",
  },
  {
    key: "tiktokFollowers",
    title: "TikTok Followers",
    label: "TikTok",
    category: "Social",
    href: PLATFORM_LINKS.tiktok,
    color: "#22d3ee",
  },
  {
    key: "youtubeSubscribers",
    title: "YouTube Subscribers",
    label: "YouTube",
    category: "Social",
    href: PLATFORM_LINKS.youtube,
    color: "#ef4444",
  },
  {
    key: "youtubeViews",
    title: "YouTube Views",
    label: "YouTube total views",
    category: "Social",
    href: PLATFORM_LINKS.youtube,
    color: "#f97316",
  },
  {
    key: "spotifyFollowers",
    title: "Spotify Followers",
    label: "Spotify",
    category: "Streaming",
    href: PLATFORM_LINKS.spotify,
    color: "#22c55e",
  },
  {
    key: "spotifyMonthlyListeners",
    title: "Spotify Monthly Listeners",
    label: "Spotify monthly listeners",
    category: "Streaming",
    href: PLATFORM_LINKS.spotify,
    color: "#84cc16",
  },
  {
    key: "facebookFollowers",
    title: "Facebook Followers",
    label: "Facebook",
    category: "Social",
    href: PLATFORM_LINKS.facebook,
    color: "#3b82f6",
  },
];
