/**
 * Remove Plot's generated labels from unroled SVG groups.
 *
 * Observable Plot uses aria-label to describe its internal mark and axis groups
 * (for example "waffle", "dot", and "x-grid"). A plain SVG <g> cannot use
 * aria-label, so those implementation labels fail Axe's aria-prohibited-attr
 * rule. Chart-level summaries and explicitly labelled interactive marks remain
 * untouched.
 */
export function sanitizePlotAccessibility(root) {
  const svgs = root?.matches?.("svg")
    ? [root]
    : Array.from(root?.querySelectorAll?.("svg") ?? []);

  for (const svg of svgs) {
    for (const group of svg.querySelectorAll("g[aria-label]:not([role])")) {
      group.removeAttribute("aria-label");
    }
  }

  return root;
}
