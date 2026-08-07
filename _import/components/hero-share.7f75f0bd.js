const SHARE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.5 5.5 19 10l-4.5 4.5"></path>
    <path d="M18.5 10H10a5 5 0 0 0-5 5v2"></path>
  </svg>
`;

const COPIED_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m7 12.5 3.2 3.2L17.5 8"></path>
  </svg>
`;

const MOON_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a8.3 8.3 0 1 0 11.2 11.2Z"></path>
  </svg>
`;

const SUN_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="3.5"></circle>
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
  </svg>
`;

const THEME_STORAGE_KEY = "constituency-insights-theme";

export function enhanceHeroWithShare(hero, {title, text} = {}) {
  const content = hero?.querySelector?.(".hero__content") || hero;
  const subtitle = content?.querySelector?.(".hero__subtitle, .spotlights-hero__subtitle");
  if (!content || !subtitle) return hero;

  const row = document.createElement("div");
  row.className = "hero__subtitle-row";
  subtitle.replaceWith(row);

  const actions = document.createElement("div");
  actions.className = "hero__actions";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hero__share";
  button.setAttribute("aria-label", "Share this page");
  button.title = "Share this page";
  button.innerHTML = SHARE_ICON;

  const themeButton = document.createElement("button");
  themeButton.type = "button";
  themeButton.className = "hero__share hero__theme-toggle";
  updateThemeButton(themeButton, currentTheme());

  const themeObserver = new MutationObserver(() => {
    if (!themeButton.isConnected) {
      themeObserver.disconnect();
      return;
    }
    updateThemeButton(themeButton, currentTheme());
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  themeButton.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {}
    updateThemeButton(themeButton, nextTheme);
  });

  const status = document.createElement("span");
  status.className = "hero__share-status";
  status.setAttribute("aria-live", "polite");

  button.addEventListener("click", async () => {
    const url = window.location.href;
    const shareData = {
      title: title || document.title,
      text: text || subtitle.textContent.trim(),
      url,
    };

    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }

      await copyText(url);
      showCopied(button, status);
    } catch (error) {
      if (error?.name === "AbortError") return;
      try {
        await copyText(url);
        showCopied(button, status);
      } catch {
        status.textContent = "Unable to copy link";
      }
    }
  });

  actions.append(button, themeButton);
  row.append(subtitle, actions, status);
  return hero;
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function updateThemeButton(button, theme) {
  const isDark = theme === "dark";
  const label = isDark ? "Use light mode" : "Use dark mode";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(isDark));
  button.title = label;
  button.innerHTML = isDark ? SUN_ICON : MOON_ICON;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy command failed");
}

function showCopied(button, status) {
  button.classList.add("is-copied");
  button.setAttribute("aria-label", "Link copied");
  button.title = "Link copied";
  button.innerHTML = COPIED_ICON;
  status.textContent = "Link copied";

  window.setTimeout(() => {
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Share this page");
    button.title = "Share this page";
    button.innerHTML = SHARE_ICON;
    status.textContent = "";
  }, 2_000);
}
