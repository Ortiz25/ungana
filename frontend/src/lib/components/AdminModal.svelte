<script>
  // Shared dialog shell for the admin dashboard's create/edit forms —
  // replaces the old inline-expanding-card pattern (Content/Activators/
  // Coordinators used to push the page layout down with a form embedded
  // directly under the trigger button or under each row). Centered rather
  // than the bottom-sheet style used elsewhere in the app (TimelineScreen's
  // earned-balance modal, ActivatorDashboardScreen's notifications list) —
  // the admin dashboard already supports a wide desktop layout (see its
  // `md:` sidebar), where a centered dialog reads better than a sheet
  // anchored to one edge.
  import { X } from '@lucide/svelte';

  let { title, onClose, children } = $props();
</script>

<div class="fixed inset-0 z-[100] flex items-center justify-center p-4" style="background: rgba(0,0,0,0.6);">
  <div
    class="w-full rounded-3xl shadow-2xl flex flex-col"
    style="background: #2E5A3E; max-width: 480px; max-height: 90vh; border: 1px solid rgba(196,92,56,0.15);"
  >
    <div class="flex items-center justify-between px-5 py-4 shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
      <p class="text-sm font-bold text-[#E8D4B0]">{title}</p>
      <button
        onclick={onClose}
        aria-label="Close"
        class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
        style="background: rgba(255,255,255,0.1);"
      >
        <X size={14} color="#C4DAC0" />
      </button>
    </div>
    <div class="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
      {@render children()}
    </div>
  </div>
</div>
