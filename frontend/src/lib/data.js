// ─── Data constants + helpers (ported from App.tsx) ──────────────────────────
import {
  Sun,
  Calendar,
  Sparkles,
  Play,
  HelpCircle,
  FileText,
  BookOpen,
  Beaker
} from '@lucide/svelte';

// ─── Activators ──────────────────────────────────────────────────────────────
export const ACTIVATORS = [
  { id: 'SELF', name: 'Self', area: 'I signed up on my own', sessions: 0 },
  { id: 'ACT-001', name: 'James Mwangi', area: 'Nairobi CBD', sessions: 142 },
  { id: 'ACT-002', name: 'Aisha Odhiambo', area: 'Westlands', sessions: 98 },
  { id: 'ACT-003', name: 'Peter Kamau', area: 'Kibera', sessions: 211 },
  { id: 'ACT-004', name: 'Grace Wanjiku', area: 'Thika Road', sessions: 76 },
  { id: 'ACT-005', name: 'Samuel Otieno', area: 'Mombasa', sessions: 189 },
  { id: 'ACT-006', name: 'Faith Njeri', area: 'Nakuru', sessions: 54 },
  { id: 'ACT-007', name: 'David Kipchoge', area: 'Eldoret', sessions: 130 },
  { id: 'ACT-008', name: 'Mary Achieng', area: 'Kisumu', sessions: 67 }
];

// ─── Packages ─────────────────────────────────────────────────────────────────
export const PACKAGES = [
  { id: 'test', label: 'Test', duration: '5 minutes', price: 2, icon: Beaker, badge: 'Test', demoSecs: 300 },
  { id: 'daily', label: 'Daily', duration: '24 hours', price: 50, icon: Sun, badge: null, demoSecs: 45 },
  { id: 'weekly', label: 'Weekly', duration: '7 days', price: 250, icon: Calendar, badge: 'Best Value', demoSecs: 45 },
  { id: 'monthly', label: 'Monthly', duration: '30 days', price: 750, icon: Sparkles, badge: null, demoSecs: 45 }
];

// Warning fires once this fraction of a session's own total duration
// remains — scales correctly for any plan length (demo or real) without
// needing to know which mode produced that duration, and can never exceed
// the total the way a fixed threshold could for a short demo/test package.
export const WARNING_PERCENT = 0.05;
// Floor so a very short demo countdown (45s) still gets a usable warning
// window instead of ~2 seconds.
export const WARNING_MIN_SECONDS = 5;

export function getWarningThreshold(totalSecs) {
  return Math.max(WARNING_MIN_SECONDS, Math.round(totalSecs * WARNING_PERCENT));
}

// ─── Timeline / Earn content ────────────────────────────────────────────────
export const TL_FEATURED = {
  id: 'f1',
  type: 'video',
  title: 'Artisan Crafts of East Africa',
  category: 'Culture & Heritage',
  duration: '8 min',
  earnLabel: '2h',
  earnSecs: 7200,
  img: 'https://images.unsplash.com/photo-1749584550329-12f3252202f1?w=700&q=80'
};
export const TL_NEW = [
  { id: 'n1', type: 'video', title: 'Digital Skills for Kenya', category: 'Education', duration: '5 min', earnLabel: '1h', earnSecs: 3600, img: 'https://images.unsplash.com/photo-1632215861513-130b66fe97f4?w=400&q=80' },
  { id: 'n2', type: 'lesson', title: 'Women Empowerment Stories', category: 'Community', duration: '6 min', earnLabel: '2h', earnSecs: 7200, img: 'https://images.unsplash.com/photo-1515658323406-25d61c141a6e?w=400&q=80' },
  { id: 'n3', type: 'article', title: 'Market Innovations', category: 'Business', duration: '3 min', earnLabel: '30m', earnSecs: 1800, img: 'https://images.unsplash.com/photo-1558907530-fe311178388a?w=400&q=80' },
  { id: 'n4', type: 'video', title: 'Community Stories', category: 'Culture', duration: '7 min', earnLabel: '2h', earnSecs: 7200, img: 'https://images.unsplash.com/photo-1515657834497-26509e295154?w=400&q=80' }
];
export const TL_SURVEY = {
  id: 's1',
  type: 'survey',
  title: 'Take a survey to get 1 hour online',
  category: 'Community Survey',
  duration: '2 min',
  earnLabel: '1h',
  earnSecs: 3600,
  img: '',
  surveyQuestions: ['How do you use the internet?', 'What content matters most?', 'Rate your experience']
};
export const TL_ARTICLES = [
  { id: 'a1', type: 'article', title: 'Nairobi Tech Scene 2026', category: 'Technology', duration: '3 min', earnLabel: '30m', earnSecs: 1800, img: 'https://images.unsplash.com/photo-1623299677833-9f077d1a2e92?w=400&q=80' },
  { id: 'a2', type: 'lesson', title: 'Teacher & Community Impact', category: 'Education', duration: '4 min', earnLabel: '45m', earnSecs: 2700, img: 'https://images.unsplash.com/photo-1744809482817-9a9d4fc280af?w=400&q=80' },
  { id: 'a3', type: 'video', title: 'Children of the Savanna', category: 'Documentary', duration: '5 min', earnLabel: '1h', earnSecs: 3600, img: 'https://images.unsplash.com/photo-1520254553641-2eed4cf2ef26?w=400&q=80' }
];
export const TL_VIDEOS = [
  { id: 'v1', type: 'video', title: 'Elephant in the Wild', category: 'Nature', duration: '12 min', earnLabel: '3h', earnSecs: 10800, img: 'https://images.unsplash.com/photo-1784727076817-6ec448061770?w=600&q=80' },
  { id: 'v2', type: 'video', title: 'Lion: King of Savanna', category: 'Wildlife', duration: '8 min', earnLabel: '2h', earnSecs: 7200, img: 'https://images.unsplash.com/photo-1695304909197-9874a20f8efc?w=600&q=80' },
  { id: 'v3', type: 'video', title: 'Zebra Migration', category: 'Nature', duration: '10 min', earnLabel: '3h', earnSecs: 10800, img: 'https://images.unsplash.com/photo-1772175008003-1b9a07ad1878?w=600&q=80' }
];

export const TL_TYPE_ICON = { video: Play, quiz: HelpCircle, survey: FileText, lesson: BookOpen, article: FileText };
export const TL_TYPE_LABEL = { video: 'Video', quiz: 'Quiz', survey: 'Survey', lesson: 'Lesson', article: 'Article' };
export const TL_TYPE_COLOR = { video: '#C45C38', quiz: '#CC8830', survey: '#2E7D52', lesson: '#5C8C3C', article: '#5A6BA0' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Compact duration for constrained UI (e.g. the browser tab title) —
 * mm:ss / hh:mm:ss via formatTime() for anything under a day, "Xd Yh" above
 * that. formatTime() alone renders absurd values on real multi-day
 * sessions (e.g. a 30-day plan showing "720:00:00").
 */
export function formatCompactDuration(secs) {
  const days = Math.floor(secs / 86400);
  if (days > 0) {
    const hours = Math.floor((secs % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
  return formatTime(secs);
}

// ─── Mock activator session data ─────────────────────────────────────────────
export const PLAN_DURATION_DAYS = { Daily: 1, Weekly: 7, Monthly: 30 };
export const MOCK_ROSTER = [
  { name: 'Brenda Akinyi', phone: '722 114 890', plan: 'Weekly', paid: 250, lastActive: 1, status: 'active', sessionStart: 2 },
  { name: 'Kevin Omondi', phone: '711 223 456', plan: 'Daily', paid: 50, lastActive: 0, status: 'active', sessionStart: 0 },
  { name: 'Mercy Wambui', phone: '700 334 521', plan: 'Monthly', paid: 750, lastActive: 9, status: 'dormant', sessionStart: 9 },
  { name: 'Felix Kamau', phone: '733 445 678', plan: 'Weekly', paid: 250, lastActive: 3, status: 'active', sessionStart: 5 },
  { name: 'Sharon Atieno', phone: '755 556 789', plan: 'Daily', paid: 50, lastActive: 14, status: 'dormant', sessionStart: 14 },
  { name: 'Brian Mutua', phone: '799 667 890', plan: 'Monthly', paid: 750, lastActive: 2, status: 'active', sessionStart: 3 },
  { name: 'Esther Njoki', phone: '722 778 901', plan: 'Weekly', paid: 250, lastActive: 21, status: 'dormant', sessionStart: 21 },
  { name: 'Collins Onyango', phone: '711 889 012', plan: 'Daily', paid: 50, lastActive: 0, status: 'active', sessionStart: 0 }
];
// daysUntilExpiry: positive = expires in N days, 0 = today, negative = already expired/dormant
export function daysUntilExpiry(u) {
  const duration = PLAN_DURATION_DAYS[u.plan] ?? 1;
  return duration - u.sessionStart;
}

export const COMMISSION_RATE = 0.2;

// ─── Coordinator data ─────────────────────────────────────────────────────────
export const MOCK_COORDINATORS = [{ id: 'COORD-01', name: 'Sarah Kimani', area: 'Nairobi Central' }];

export const ACCESS_POINTS = [
  { id: 'AP-01', name: 'CBD Main Market', uptime: 99.2, users: 23, capacity: 30, status: 'online', lastSeenMins: 0, bw: '12.4 Mbps' },
  { id: 'AP-02', name: 'CBD Bus Terminus', uptime: 71.4, users: 8, capacity: 20, status: 'degraded', lastSeenMins: 0, bw: '2.8 Mbps' },
  { id: 'AP-03', name: 'Westlands Centre', uptime: 99.8, users: 31, capacity: 40, status: 'online', lastSeenMins: 0, bw: '18.1 Mbps' },
  { id: 'AP-04', name: 'Kibera Junction', uptime: 0, users: 0, capacity: 15, status: 'offline', lastSeenMins: 127, bw: '0 Mbps' },
  { id: 'AP-05', name: "Lang'ata Road", uptime: 94.1, users: 12, capacity: 20, status: 'online', lastSeenMins: 0, bw: '7.6 Mbps' },
  { id: 'AP-06', name: 'Karen Shopping', uptime: 98.7, users: 19, capacity: 25, status: 'online', lastSeenMins: 0, bw: '14.9 Mbps' }
];

export const COORD_ACTS = [
  { id: 'ACT-001', name: 'James Mwangi', area: 'Nairobi CBD', users: 8, weekEarn: 320, weekTarget: 400, dailyTarget: 60, dormant: 2, streak: 3, trend: 'up' },
  { id: 'ACT-002', name: 'Grace Njeri', area: 'Westlands', users: 12, weekEarn: 480, weekTarget: 500, dailyTarget: 75, dormant: 1, streak: 5, trend: 'up' },
  { id: 'ACT-003', name: 'Peter Odhiambo', area: "Lang'ata", users: 6, weekEarn: 180, weekTarget: 350, dailyTarget: 50, dormant: 3, streak: 0, trend: 'down' },
  { id: 'ACT-004', name: 'Ann Wanjiku', area: 'Karen', users: 9, weekEarn: 390, weekTarget: 400, dailyTarget: 60, dormant: 1, streak: 4, trend: 'flat' },
  { id: 'ACT-005', name: 'David Kipchoge', area: 'Eastleigh', users: 11, weekEarn: 520, weekTarget: 500, dailyTarget: 80, dormant: 0, streak: 7, trend: 'up' }
];

export const INIT_ESCALATIONS = [
  { id: 'ESC-001', activator: 'Peter Odhiambo', issue: 'AP-04 offline 3+ hours — users unable to connect', priority: 'high', status: 'open', time: '2h ago' },
  { id: 'ESC-002', activator: 'James Mwangi', issue: 'AP-02 degraded speeds, multiple user complaints', priority: 'medium', status: 'open', time: '5h ago' },
  { id: 'ESC-003', activator: 'Grace Njeri', issue: 'Payment processed but session not activated', priority: 'high', status: 'escalated', time: '1d ago' },
  { id: 'ESC-004', activator: 'Ann Wanjiku', issue: 'User refund request — power outage cut session short', priority: 'low', status: 'resolved', time: '2d ago' }
];

// Per-activator 7-day daily earnings (Mon → today, index 0 = Mon)
export const ACT_WEEKLY = {
  'ACT-001': [48, 52, 45, 60, 55, 42, 18],
  'ACT-002': [70, 68, 75, 80, 72, 65, 50],
  'ACT-003': [30, 25, 28, 22, 30, 20, 5],
  'ACT-004': [58, 62, 55, 70, 65, 55, 25],
  'ACT-005': [78, 85, 80, 90, 88, 75, 24]
};
// Per-activator 4-week monthly history (label, earnings)
export const ACT_MONTHLY = {
  'ACT-001': [{ w: 'W-3', earn: 1280 }, { w: 'W-2', earn: 1450 }, { w: 'W-1', earn: 1620 }, { w: 'This', earn: 320 }],
  'ACT-002': [{ w: 'W-3', earn: 1800 }, { w: 'W-2', earn: 1950 }, { w: 'W-1', earn: 2100 }, { w: 'This', earn: 480 }],
  'ACT-003': [{ w: 'W-3', earn: 920 }, { w: 'W-2', earn: 780 }, { w: 'W-1', earn: 640 }, { w: 'This', earn: 180 }],
  'ACT-004': [{ w: 'W-3', earn: 1560 }, { w: 'W-2', earn: 1620 }, { w: 'W-1', earn: 1710 }, { w: 'This', earn: 390 }],
  'ACT-005': [{ w: 'W-3', earn: 1920 }, { w: 'W-2', earn: 2080 }, { w: 'W-1', earn: 2350 }, { w: 'This', earn: 520 }]
};
export const ACT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const ACT_YEARLY = {
  'ACT-001': [{ m: 'Aug', earn: 4800 }, { m: 'Sep', earn: 5100 }, { m: 'Oct', earn: 5400 }, { m: 'Nov', earn: 5200 }, { m: 'Dec', earn: 4600 }, { m: 'Jan', earn: 5300 }, { m: 'Feb', earn: 5600 }, { m: 'Mar', earn: 5900 }, { m: 'Apr', earn: 6100 }, { m: 'May', earn: 6300 }, { m: 'Jun', earn: 6000 }, { m: 'Jul', earn: 320 }],
  'ACT-002': [{ m: 'Aug', earn: 6800 }, { m: 'Sep', earn: 7100 }, { m: 'Oct', earn: 7400 }, { m: 'Nov', earn: 7200 }, { m: 'Dec', earn: 6500 }, { m: 'Jan', earn: 7600 }, { m: 'Feb', earn: 7900 }, { m: 'Mar', earn: 8100 }, { m: 'Apr', earn: 8400 }, { m: 'May', earn: 8600 }, { m: 'Jun', earn: 8300 }, { m: 'Jul', earn: 480 }],
  'ACT-003': [{ m: 'Aug', earn: 3600 }, { m: 'Sep', earn: 3400 }, { m: 'Oct', earn: 3200 }, { m: 'Nov', earn: 3000 }, { m: 'Dec', earn: 2800 }, { m: 'Jan', earn: 2600 }, { m: 'Feb', earn: 2800 }, { m: 'Mar', earn: 2500 }, { m: 'Apr', earn: 2700 }, { m: 'May', earn: 2900 }, { m: 'Jun', earn: 2600 }, { m: 'Jul', earn: 180 }],
  'ACT-004': [{ m: 'Aug', earn: 5800 }, { m: 'Sep', earn: 6000 }, { m: 'Oct', earn: 6200 }, { m: 'Nov', earn: 6100 }, { m: 'Dec', earn: 5700 }, { m: 'Jan', earn: 6300 }, { m: 'Feb', earn: 6500 }, { m: 'Mar', earn: 6700 }, { m: 'Apr', earn: 6800 }, { m: 'May', earn: 7000 }, { m: 'Jun', earn: 6900 }, { m: 'Jul', earn: 390 }],
  'ACT-005': [{ m: 'Aug', earn: 7200 }, { m: 'Sep', earn: 7600 }, { m: 'Oct', earn: 8000 }, { m: 'Nov', earn: 7800 }, { m: 'Dec', earn: 7200 }, { m: 'Jan', earn: 8200 }, { m: 'Feb', earn: 8600 }, { m: 'Mar', earn: 9000 }, { m: 'Apr', earn: 9200 }, { m: 'May', earn: 9500 }, { m: 'Jun', earn: 9300 }, { m: 'Jul', earn: 520 }]
};

// ─── Mock chart data ──────────────────────────────────────────────────────────
function buildDailyData(days) {
  const out = [];
  let cum = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const base = dow === 0 || dow === 6 ? 20 : 60;
    const amount = Math.round(Math.random() * base + base * 0.3);
    cum += amount;
    out.push({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      shortLabel: d.toLocaleDateString('en-US', { day: 'numeric' }),
      earnings: amount,
      cumulative: cum
    });
  }
  return out;
}

function buildMonthlyData() {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
  const bases = [420, 510, 380, 620, 700, 540, 810, 760, 890, 950, 1080, 1220];
  return months.map((m, i) => ({ label: m, earnings: bases[i] }));
}

export const ALL_DAILY = buildDailyData(90);
export const MONTHLY_DATA = buildMonthlyData();
export const LIFETIME_TOTAL = MONTHLY_DATA.reduce((s, m) => s + m.earnings, 0);
export const THIS_MONTH = MONTHLY_DATA[MONTHLY_DATA.length - 1].earnings;
export const LAST_MONTH = MONTHLY_DATA[MONTHLY_DATA.length - 2].earnings;
export const MONTH_GROWTH = Math.round(((THIS_MONTH - LAST_MONTH) / LAST_MONTH) * 100);
export const THIS_WEEK = ALL_DAILY.slice(-7).reduce((s, d) => s + d.earnings, 0);
export const LAST_WEEK = ALL_DAILY.slice(-14, -7).reduce((s, d) => s + d.earnings, 0);
export const WEEK_GROWTH = Math.round(((THIS_WEEK - LAST_WEEK) / LAST_WEEK) * 100);
export const TODAY_EARN = ALL_DAILY[ALL_DAILY.length - 1].earnings;
export const YESTERDAY = ALL_DAILY[ALL_DAILY.length - 2].earnings;
