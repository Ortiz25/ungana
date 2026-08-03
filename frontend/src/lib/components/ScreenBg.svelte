<script>
  let { children, class: klass = '', style = '' } = $props();
</script>

<div
  class="flex flex-col px-5 pb-8 {klass}"
  style="background: linear-gradient(160deg, #E8D4B0 0%, #DBC89A 100%); min-height: 100dvh; {style}"
>
  {@render children()}
</div>
