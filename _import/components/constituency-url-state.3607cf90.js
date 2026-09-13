const PARAMETER = "constituency";

export function constituencySlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveConstituencyUrlState({constituencies = [], search = ""} = {}) {
  const requested = constituencySlug(new URLSearchParams(search).get(PARAMETER));
  if (!requested) return null;

  return Array.from(constituencies).find(
    (constituency) => constituencySlug(constituency) === requested
  ) ?? null;
}

export function buildConstituencyUrl(constituency, href) {
  const url = new URL(href);
  const slug = constituencySlug(constituency);
  if (slug) url.searchParams.set(PARAMETER, slug);
  else url.searchParams.delete(PARAMETER);
  return url;
}

export function updateConstituencyUrl(
  constituency,
  {mode = "replace", href = window.location.href, history = window.history} = {}
) {
  const url = buildConstituencyUrl(constituency, href);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  history[mode === "push" ? "pushState" : "replaceState"](null, "", next);
}
