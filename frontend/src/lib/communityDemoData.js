// Static demo content for the Community tab — lets a freshly-created
// community site show a fully-populated, lively tab immediately, before an
// admin has added any real community_posts rows (same "always shown, real
// items first, demo fills the rest" philosophy TimelineScreen already uses
// for Watch & Earn's own static catalogue — see its top-of-file comment).
// Modeled on a community WiFi hotspot in Kibera, Nairobi — announcements,
// events, marketplace listings, and local services reflect the kind of
// small businesses and community concerns actually common there (water
// access, informal transport, mitumba trade, mobile money agents) rather
// than generic placeholder content.
//
// Every id here is a string starting with 'demo-' rather than a real DB
// integer, so it can never collide with a real post; CampusResources
// (image/attachment) and CommunityPoll both already just fall through to a
// harmless no-op (poll voting is simulated locally instead — see
// CommunityPoll.svelte's `isDemo`) rather than corrupting anything if one
// of these ever reaches a click/vote handler.
//
// TO REMOVE THIS DEMO DATA ENTIRELY: delete this file, then in
// TimelineScreen.svelte remove the `import ... from '$lib/communityDemoData.js'`
// line and the five `...COMMUNITY_DEMO_*` spreads in onMount's community
// branch. Nothing else references this file.

function daysFromNow(days, hour = 18, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function daysAgo(days) {
  return daysFromNow(-days);
}

export const COMMUNITY_DEMO_ANNOUNCEMENTS = [
  {
    id: 'demo-a1',
    type: 'announcement',
    title: 'Water Trucking Schedule This Week',
    body: 'Water points on Kibera Drive and DC Grounds will be refilled Tuesday and Friday mornings. Bring your own jerrycans early to avoid the queue.',
    category: 'Water',
    priority: 'urgent',
    attachment_url: null,
    event_starts_at: daysFromNow(3),
    is_pinned: true,
    published_at: daysAgo(1)
  },
  {
    id: 'demo-a2',
    type: 'announcement',
    title: 'Garbage Collection Now Thursdays & Sundays',
    body: 'The youth group cleanup crew has moved collection to twice a week. Leave bags out by 7 AM on those days.',
    category: 'Sanitation',
    priority: 'normal',
    attachment_url: null,
    event_starts_at: null,
    is_pinned: false,
    published_at: daysAgo(4)
  },
  {
    id: 'demo-a3',
    type: 'announcement',
    title: 'New Security Lighting on Kibera Drive',
    body: 'Solar streetlights have been installed along the main road near the market. Report any that stop working to the village elder.',
    category: 'Security',
    priority: 'important',
    attachment_url: null,
    event_starts_at: null,
    is_pinned: false,
    published_at: daysAgo(7)
  }
];

export const COMMUNITY_DEMO_EVENTS = [
  {
    id: 'demo-e1',
    type: 'event',
    title: 'Kibera Clean-Up Saturday',
    body: 'Join neighbours for a morning of clearing drainage and collecting litter along the railway line. Gloves and bags provided.',
    category: 'Community',
    event_starts_at: daysFromNow(6, 8, 0),
    event_ends_at: daysFromNow(6, 11, 0),
    location: 'DC Grounds',
    attachment_url: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=400&q=80',
    images: []
  },
  {
    id: 'demo-e2',
    type: 'event',
    title: 'Youth Football Tournament Finals',
    body: 'Eight teams from across the villages have made it to the final round. Come support your side.',
    category: 'Sports',
    event_starts_at: daysFromNow(10, 14, 0),
    event_ends_at: daysFromNow(10, 17, 0),
    location: 'Kibera Olympic Grounds',
    attachment_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400&q=80',
    images: []
  },
  {
    id: 'demo-e3',
    type: 'event',
    title: 'Christmas Toy Drive for Kibera Children',
    body: 'Thank you to everyone who donated — over 200 children received gifts at the community hall this year.',
    category: 'Community',
    event_starts_at: daysAgo(25),
    event_ends_at: daysAgo(25),
    location: 'Ayany Community Hall',
    attachment_url: 'https://images.unsplash.com/photo-1722870799858-6dbade1af000?w=400&q=80',
    images: [
      'https://images.unsplash.com/photo-1652664845183-c6083bc286fc?w=600&q=80',
      'https://images.unsplash.com/photo-1547496614-54ff387d650a?w=600&q=80'
    ]
  }
];

// Modeled on stalls you'd actually find at a Kibera market — a fish
// vendor, a tailor, a boda boda mechanic — rather than one-off classifieds,
// alongside one genuine secondhand-item listing for variety. `condition`
// is omitted where it doesn't really apply (a vendor/service stall isn't
// "new" or "used"); price_kes is each stall's starting/typical price.
// Photos are verified real Unsplash photos (fetched and confirmed live),
// not guessed URLs.
export const COMMUNITY_DEMO_MARKETPLACE = [
  {
    id: 'demo-m1',
    type: 'marketplace',
    title: 'Fresh Tilapia — Whole Fish',
    body: 'Daily catch from the lake, cleaned while you wait. Ask about bulk prices for hotelis.',
    category: 'Food',
    price_kes: 350,
    attachment_url: 'https://images.unsplash.com/photo-1783408355128-c6a45a91c130?w=300&q=80',
    metadata: { contactPhone: '0712345001' },
    is_pinned: true
  },
  {
    id: 'demo-m2',
    type: 'marketplace',
    title: 'Custom Tailoring & School Uniforms',
    body: 'Made-to-measure outfits and school uniforms, ready in 2–3 days. Bring your own fabric or buy from stock.',
    category: 'Fashion',
    price_kes: 500,
    attachment_url: 'https://images.unsplash.com/photo-1637997840862-9aafaf835eed?w=300&q=80',
    metadata: { contactPhone: '0712345002' },
    is_pinned: false
  },
  {
    id: 'demo-m3',
    type: 'marketplace',
    title: 'Boda Boda Repairs & Servicing',
    body: 'Full service, puncture repair, and spare parts. Quick turnaround while you wait.',
    category: 'Transport',
    price_kes: 300,
    attachment_url: 'https://images.unsplash.com/photo-1685564180541-e18c6fc361fd?w=300&q=80',
    metadata: { contactPhone: '0712345003' },
    is_pinned: false
  },
  {
    id: 'demo-m4',
    type: 'marketplace',
    title: 'Mitumba Jackets (Assorted)',
    body: 'Fresh bale just opened — sizes S to XL. Come early for the best picks.',
    category: 'Clothing',
    price_kes: 500,
    attachment_url: 'https://images.unsplash.com/photo-1756197256645-8f2c416ff5eb?w=300&q=80',
    metadata: { condition: 'used', contactPhone: '0712345004' },
    is_pinned: false
  }
];

export const COMMUNITY_DEMO_SERVICES = [
  {
    id: 'demo-s1',
    type: 'service',
    title: 'Mama Njeri M-Pesa & Airtime Shop',
    body: 'Deposits, withdrawals, bill payments — open daily 6 AM–10 PM.',
    category: 'Finance',
    attachment_url: 'tel:+254700000001',
    is_pinned: true
  },
  {
    id: 'demo-s2',
    type: 'service',
    title: 'Fastlink Boda Boda Stage',
    body: 'Reliable riders at the main stage, helmets provided for passengers.',
    category: 'Transport',
    attachment_url: 'tel:+254700000002',
    is_pinned: false
  },
  {
    id: 'demo-s3',
    type: 'service',
    title: 'Kibera Tailoring & Mitumba Alterations',
    body: 'Repairs, adjustments, and custom orders. Same-day service available.',
    category: 'Home Services',
    attachment_url: 'tel:+254700000003',
    is_pinned: false
  },
  {
    id: 'demo-s4',
    type: 'service',
    title: 'Sharp Cutz Barber & Salon',
    body: 'Haircuts, braiding, and grooming for the whole family.',
    category: 'Beauty',
    attachment_url: 'tel:+254700000004',
    is_pinned: false
  },
  {
    id: 'demo-s5',
    type: 'service',
    title: 'Amani Cyber Café & Printing',
    body: 'Printing, scanning, photocopying, and CV writing help.',
    category: 'Tech Support',
    attachment_url: 'tel:+254700000005',
    is_pinned: false
  }
];

export const COMMUNITY_DEMO_POLLS = [
  {
    id: 'demo-poll-1',
    type: 'poll',
    title: 'What should the community fund prioritize next?',
    body: 'Vote for what matters most to you this quarter.',
    metadata: { options: ['More water points', 'Public toilets & showers', 'Security lighting', 'Youth football pitch upgrade'] },
    poll_results: [
      { optionIndex: 0, votes: 18 },
      { optionIndex: 1, votes: 11 },
      { optionIndex: 2, votes: 25 },
      { optionIndex: 3, votes: 9 }
    ]
  }
];
