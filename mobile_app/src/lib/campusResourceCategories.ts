// Ported 1:1 from frontend/src/lib/campusResourceCategories.js — pure data
// + logic, no DOM/web dependency, so nothing changed in the port.
export type ResourceCategory = { id: string; label: string; color: string; keywords: string[] };

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  { id: "library", label: "Library", color: "#2d6fa3", keywords: ["librar"] },
  { id: "it", label: "IT / Helpdesk", color: "#6b4fa3", keywords: ["helpdesk", "tech support", "computer lab", "wifi", "ict"] },
  { id: "finance", label: "Finance / Fees", color: "#c07a2e", keywords: ["financ", "fees office", "bursar", "accounts office"] },
  { id: "health", label: "Health Center", color: "#3a9d5f", keywords: ["health cent", "clinic", "medical", "nurse"] },
  { id: "security", label: "Security / Emergency", color: "#C45C38", keywords: ["security", "emergenc"] },
  { id: "transport", label: "Transport", color: "#4a7dbd", keywords: ["transport", "shuttle"] },
  { id: "housing", label: "Housing", color: "#a3752d", keywords: ["housing", "hostel", "dorm", "residence"] },
  { id: "careers", label: "Careers", color: "#5b8a72", keywords: ["career"] },
  { id: "admissions", label: "Admissions", color: "#8a5fa3", keywords: ["admission", "registrar"] },
  { id: "student_affairs", label: "Student Affairs", color: "#3a7d9d", keywords: ["student affairs", "dean of student", "counsel"] },
];

export const GENERAL_RESOURCE_CATEGORY: ResourceCategory = { id: "general", label: "General", color: "#8b6a35", keywords: [] };

export function matchResourceCategory(categoryText?: string | null, titleText?: string | null): ResourceCategory {
  const cat = (categoryText || "").trim().toLowerCase();
  if (cat) {
    const exact = RESOURCE_CATEGORIES.find((c) => c.label.toLowerCase() === cat);
    if (exact) return exact;
    const byKeyword = RESOURCE_CATEGORIES.find((c) => c.keywords.some((k) => cat.includes(k)));
    if (byKeyword) return byKeyword;
  }
  const title = (titleText || "").trim().toLowerCase();
  if (title) {
    const byTitle = RESOURCE_CATEGORIES.find((c) => c.keywords.some((k) => title.includes(k)));
    if (byTitle) return byTitle;
  }
  return GENERAL_RESOURCE_CATEGORY;
}
