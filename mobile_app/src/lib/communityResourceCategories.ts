// Ported 1:1 from frontend/src/lib/communityResourceCategories.js.
import type { ResourceCategory } from "@/lib/campusResourceCategories";

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  { id: "food_delivery", label: "Food & Delivery", color: "#22d3ee", keywords: ["food", "delivery", "restaurant", "grocery"] },
  { id: "home_services", label: "Home Services", color: "#a3752d", keywords: ["plumb", "electric", "clean", "repair", "handyman"] },
  { id: "fitness", label: "Fitness & Wellness", color: "#3a9d5f", keywords: ["gym", "fitness", "wellness", "yoga", "spa"] },
  { id: "tech_support", label: "Tech Support", color: "#6366f1", keywords: ["tech support", "it ", "computer repair", "gadget"] },
  { id: "transport", label: "Transport", color: "#4a7dbd", keywords: ["transport", "shuttle", "taxi", "ride"] },
  { id: "coworking", label: "Coworking", color: "#a78bfa", keywords: ["coworking", "workspace", "office space"] },
  { id: "finance", label: "Finance", color: "#c07a2e", keywords: ["financ", "bank", "sacco", "insurance"] },
];

export const GENERAL_RESOURCE_CATEGORY: ResourceCategory = { id: "general", label: "General", color: "#64748b", keywords: [] };

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
