<div
  class="absolute right-6 bottom-6 space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-500 shadow-xl backdrop-blur-md">
  <div class="space-y-1">
    <h6>Legend</h6>
    <div class="flex items-center gap-3">
      <span class="size-3 rounded-full border-2 border-slate-300 bg-white"></span>
      Node
    </div>
    <div class="flex items-center gap-3">
      <span class="size-3 rounded-full bg-amber-500"></span>
      Selected
    </div>
    <div class="flex items-center gap-3">
      <span class="mx-1 h-3 w-1 rounded-sm bg-emerald-500"></span>
      Path Edge
    </div>
  </div>

  <hr class="border-slate-200" />

  <div class="space-y-1">
    <h6>Controls</h6>
    <p>
      <span class="font-bold">Right-click</span> node to Pin/Unpin
      <br />
      <span class="font-bold">Drag</span> node to move
    </p>
  </div>
</div>

<style>
  @reference "../../app.css";

  h6 {
    @apply text-base font-bold text-slate-700;
  }
</style>
