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

export function enhanceHeroWithShare(hero, {title, text} = {}) {
  const content = hero?.querySelector?.(".hero__content");
  const subtitle = content?.querySelector?.(".hero__subtitle");
  if (!content || !subtitle) return hero;

  const row = document.createElement("div");
  row.className = "hero__subtitle-row";
  subtitle.replaceWith(row);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hero__share";
  button.setAttribute("aria-label", "Share this page");
  button.title = "Share this page";
  button.innerHTML = SHARE_ICON;

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

  row.append(subtitle, button, status);
  return hero;
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
