// Canonical Local Services (community_posts type='service') categories —
// the Community-vertical sibling of campusResourceCategories.js, same
// shape and same reasoning: `category` stays plain text in the DB, this is
// just a well-known set the admin's quick-select writes into it and the
// student-facing tile matches back against for icon/color. Colors reuse
// the Community tab's cyan/indigo/violet "tech dashboard" palette rather
// than Campus's academic gold family.
export const RESOURCE_CATEGORIES = [
  { id: 'food_delivery', label: 'Food & Delivery', color: '#22d3ee', keywords: ['food', 'delivery', 'restaurant', 'grocery'] },
  { id: 'home_services', label: 'Home Services', color: '#a3752d', keywords: ['plumb', 'electric', 'clean', 'repair', 'handyman'] },
  { id: 'fitness', label: 'Fitness & Wellness', color: '#3a9d5f', keywords: ['gym', 'fitness', 'wellness', 'yoga', 'spa'] },
  { id: 'tech_support', label: 'Tech Support', color: '#6366f1', keywords: ['tech support', 'it ', 'computer repair', 'gadget'] },
  { id: 'transport', label: 'Transport', color: '#4a7dbd', keywords: ['transport', 'shuttle', 'taxi', 'ride'] },
  { id: 'coworking', label: 'Coworking', color: '#a78bfa', keywords: ['coworking', 'workspace', 'office space'] },
  { id: 'finance', label: 'Finance', color: '#c07a2e', keywords: ['financ', 'bank', 'sacco', 'insurance'] }
];

// Fallback for anything that matches none of the above.
export const GENERAL_RESOURCE_CATEGORY = { id: 'general', label: 'General', color: '#64748b', keywords: [] };

/**
 * Same matching strategy as campusResourceCategories.js's
 * matchResourceCategory: exact label match first (what the admin's
 * quick-select produces), then a keyword substring match against the
 * category text, then the title, then GENERAL_RESOURCE_CATEGORY.
 */
export function matchResourceCategory(categoryText, titleText) {
  const cat = (categoryText || '').trim().toLowerCase();
  if (cat) {
    const exact = RESOURCE_CATEGORIES.find((c) => c.label.toLowerCase() === cat);
    if (exact) return exact;
    const byKeyword = RESOURCE_CATEGORIES.find((c) => c.keywords.some((k) => cat.includes(k)));
    if (byKeyword) return byKeyword;
  }
  const title = (titleText || '').trim().toLowerCase();
  if (title) {
    const byTitle = RESOURCE_CATEGORIES.find((c) => c.keywords.some((k) => title.includes(k)));
    if (byTitle) return byTitle;
  }
  return GENERAL_RESOURCE_CATEGORY;
}
