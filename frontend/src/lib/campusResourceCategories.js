// Canonical Quick Links (campus_posts type='resource') categories — shared
// between the student-facing tile (CampusResources.svelte, for icon/color)
// and the admin form's quick-select (AdminDashboardScreen.svelte, for the
// label text it writes into the freeform `category` column). `category`
// itself stays plain text in the DB — nothing here is a real enum/constraint
// — so matchResourceCategory() below degrades gracefully for any value that
// doesn't match one of these, rather than requiring a migration to add a
// new kind of service.
export const RESOURCE_CATEGORIES = [
  { id: 'library', label: 'Library', color: '#2d6fa3', keywords: ['librar'] },
  { id: 'it', label: 'IT / Helpdesk', color: '#6b4fa3', keywords: ['helpdesk', 'tech support', 'computer lab', 'wifi', 'ict'] },
  { id: 'finance', label: 'Finance / Fees', color: '#c07a2e', keywords: ['financ', 'fees office', 'bursar', 'accounts office'] },
  { id: 'health', label: 'Health Center', color: '#3a9d5f', keywords: ['health cent', 'clinic', 'medical', 'nurse'] },
  { id: 'security', label: 'Security / Emergency', color: '#C45C38', keywords: ['security', 'emergenc'] },
  { id: 'transport', label: 'Transport', color: '#4a7dbd', keywords: ['transport', 'shuttle'] },
  { id: 'housing', label: 'Housing', color: '#a3752d', keywords: ['housing', 'hostel', 'dorm', 'residence'] },
  { id: 'careers', label: 'Careers', color: '#5b8a72', keywords: ['career'] },
  { id: 'admissions', label: 'Admissions', color: '#8a5fa3', keywords: ['admission', 'registrar'] },
  { id: 'student_affairs', label: 'Student Affairs', color: '#3a7d9d', keywords: ['student affairs', 'dean of student', 'counsel'] }
];

// Fallback for anything that matches none of the above — same neutral gold
// the tile used unconditionally before this list existed, so an
// uncategorized resource looks exactly like it always did.
export const GENERAL_RESOURCE_CATEGORY = { id: 'general', label: 'General', color: '#8b6a35', keywords: [] };

/**
 * Resolves a resource's category text (and, as a fallback for older
 * resources created before this list existed, its title) to one of
 * RESOURCE_CATEGORIES. Tries an exact label match first (what the admin's
 * quick-select buttons produce), then a keyword substring match (freeform
 * text close to but not exactly a label), then falls through to title
 * keywords, and finally GENERAL_RESOURCE_CATEGORY.
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
