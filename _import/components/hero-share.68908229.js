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

const THEME_STORAGE_KEY = "oireachtas-insights-theme";

export function enhanceHeroWithShare(hero, {title, text} = {}) {
  const content = hero?.querySelector?.(".hero__content") || hero;
  const subtitle = content?.querySelector?.(".hero__subtitle, .spotlights-hero__subtitle");
  mountMastheadActions({
    title,
    text: text || subtitle?.textContent?.trim(),
  });
  return hero;
}

export function mountMastheadActions({title, text} = {}) {
  const actions = document.querySelector(".oireachtas-masthead__actions");
  if (!actions) {
    window.addEventListener(
      "load",
      () => mountMastheadActions({title, text}),
      {once: true}
    );
    return;
  }

  actions.replaceChildren();

  const status = document.createElement("span");
  status.className = "oireachtas-masthead__status";
  status.setAttribute("aria-live", "polite");

  const createThemeButton = (className) => {
    const themeButton = document.createElement("button");
    themeButton.type = "button";
    themeButton.className = className;
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
    return themeButton;
  };

  const createShareButton = (className, buttonStatus = status) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", "Share this page");
    button.title = "Share this page";
    button.innerHTML = SHARE_ICON;

    button.addEventListener("click", async () => {
      const url = window.location.href;
      const shareData = {
        title: title || document.title,
        text: text || document.querySelector(".hero__subtitle, .spotlights-hero__subtitle")?.textContent?.trim(),
        url,
      };

      try {
        if (typeof navigator.share === "function") {
          await navigator.share(shareData);
          return;
        }

        await copyText(url);
        showCopied(button, buttonStatus);
      } catch (error) {
        if (error?.name === "AbortError") return;
        try {
          await copyText(url);
          showCopied(button, buttonStatus);
        } catch {
          buttonStatus.textContent = "Unable to copy link";
        }
      }
    });
    return button;
  };

  const button = createShareButton("oireachtas-masthead__action");
  const themeButton = createThemeButton("oireachtas-masthead__action oireachtas-masthead__theme-toggle");

  actions.append(button, themeButton, status);

  const mobileMenu = document.querySelector(".mobile-reading-tools__menu");
  if (mobileMenu) {
    const mobileStatus = document.createElement("span");
    mobileStatus.className = "oireachtas-masthead__status";
    mobileStatus.setAttribute("aria-live", "polite");
    const mobileShare = createShareButton("mobile-reading-tools__menu-action", mobileStatus);
    const mobileTheme = createThemeButton("mobile-reading-tools__menu-action");
    mobileShare.insertAdjacentHTML("beforeend", "<span>Share</span>");
    const syncThemeLabel = () => {
      const label = currentTheme() === "dark" ? "Light mode" : "Dark mode";
      let labelNode = mobileTheme.querySelector("span");
      if (!labelNode) {
        labelNode = document.createElement("span");
        mobileTheme.appendChild(labelNode);
      }
      labelNode.textContent = label;
    };
    syncThemeLabel();
    new MutationObserver(syncThemeLabel).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    mobileMenu.replaceChildren(mobileShare, mobileTheme, mobileStatus);
  }
}

function currentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function updateThemeButton(button, theme) {
  const isDark = theme === "dark";
  const label = isDark ? "Use light mode across Insights" : "Use dark mode across Insights";
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
  const isMenuAction = button.classList.contains("mobile-reading-tools__menu-action");
  button.classList.add("is-copied");
  button.setAttribute("aria-label", "Link copied");
  button.title = "Link copied";
  button.innerHTML = `${COPIED_ICON}${isMenuAction ? "<span>Link copied</span>" : ""}`;
  status.textContent = "Link copied";

  window.setTimeout(() => {
    button.classList.remove("is-copied");
    button.setAttribute("aria-label", "Share this page");
    button.title = "Share this page";
    button.innerHTML = `${SHARE_ICON}${isMenuAction ? "<span>Share</span>" : ""}`;
    status.textContent = "";
  }, 2_000);
}
