export default {
  title: "Constituency Insights",
  head: `
    <link rel="preload" href="oireachtas-logo.svg" as="image" type="image/svg+xml">
    <link rel="icon" href="logo.png" type="image/png" sizes="32x32">
    <script>
      document.documentElement.lang = "en-IE";

      (() => {
        const storageKey = "oireachtas-insights-theme";
        const legacyStorageKey = "constituency-insights-theme";
        const colourScheme = window.matchMedia("(prefers-color-scheme: dark)");
        const readSavedTheme = () => {
          try {
            let value = localStorage.getItem(storageKey);
            if (value !== "dark" && value !== "light") {
              value = localStorage.getItem(legacyStorageKey);
              if (value === "dark" || value === "light") localStorage.setItem(storageKey, value);
            }
            return value === "dark" || value === "light" ? value : null;
          } catch {
            return null;
          }
        };
        const systemTheme = () => colourScheme.matches ? "dark" : "light";
        const savedTheme = readSavedTheme();
        document.documentElement.dataset.theme =
          savedTheme || systemTheme();

        colourScheme.addEventListener("change", () => {
          if (!readSavedTheme()) document.documentElement.dataset.theme = systemTheme();
        });
        window.addEventListener("storage", (event) => {
          if (event.key === storageKey && (event.newValue === "dark" || event.newValue === "light")) {
            document.documentElement.dataset.theme = event.newValue;
          }
        });
      })();

      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute("content", "width=device-width, initial-scale=1");
      } else {
        const meta = document.createElement("meta");
        meta.name = "viewport";
        meta.content = "width=device-width, initial-scale=1";
        document.head.appendChild(meta);
      }

      (() => {
        const setupOireachtasMasthead = () => {
          if (!document.body || document.querySelector(".oireachtas-masthead")) return;

          const masthead = document.createElement("header");
          masthead.className = "oireachtas-masthead";

          const inner = document.createElement("div");
          inner.className = "oireachtas-masthead__inner";

          const homeLink = document.createElement("a");
          homeLink.className = "oireachtas-masthead__home";
          homeLink.href = "https://www.oireachtas.ie/";
          homeLink.setAttribute("aria-label", "Return to oireachtas.ie");
          homeLink.title = "Return to oireachtas.ie";

          const logo = document.createElement("img");
          logo.className = "oireachtas-masthead__logo";
          logo.alt = "";
          logo.width = 163;
          logo.height = 69;
          logo.src = document.querySelector('link[rel="preload"][as="image"]')?.href || "oireachtas-logo.svg";

          homeLink.appendChild(logo);

          const resourceLink = document.createElement("a");
          resourceLink.className = "oireachtas-masthead__resource";
          const assetUrl = new URL(logo.src, window.location.href);
          assetUrl.pathname = assetUrl.pathname.replace(/_file\\/.*$/, "");
          assetUrl.search = "";
          assetUrl.hash = "";
          resourceLink.href = assetUrl.href;
          resourceLink.setAttribute("aria-label", "Constituency Insights home");

          const insightsBrandMarkup = \`
            <span class="oireachtas-masthead__brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 28" focusable="false">
                <path d="M12 9H26L32 5L38 9H52" />
                <line x1="12" y1="10.5" x2="52" y2="10.5" />
                <rect x="12" y="10.5" width="40" height="13.5" />
                <line x1="27.5" y1="10.5" x2="27.5" y2="24" />
                <line x1="30" y1="10.5" x2="30" y2="24" />
                <line x1="34" y1="10.5" x2="34" y2="24" />
                <line x1="36.5" y1="10.5" x2="36.5" y2="24" />
                <line x1="26.5" y1="24" x2="37.5" y2="24" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="30.7" y="18.2" width="2.6" height="5.8" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="15" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="19" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="23" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="39.3" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="43.3" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="47.3" y="13" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="15" y="18" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="19" y="18" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="23" y="18" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="39.3" y="18" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="43.3" y="18" width="1.7" height="1.7" />
                <rect class="oireachtas-masthead__brand-mark-fill" x="47.3" y="18" width="1.7" height="1.7" />
                <line x1="12" y1="24" x2="52" y2="24" />
              </svg>
            </span>
            <span class="oireachtas-masthead__brand-copy">
              <span class="oireachtas-masthead__brand-title">Constituency Insights</span>
              <span class="oireachtas-masthead__brand-tagline">Parliamentary visual data</span>
            </span>
          \`;
          resourceLink.innerHTML = insightsBrandMarkup;
          const normalizePath = (path) => path
            .replace(/index(?:\\.html)?$/, "")
            .replace(/\\/+$/, "/");

          const indexTitle = document.createElement("h1");
          indexTitle.className = "oireachtas-masthead__index-title";
          indexTitle.innerHTML = insightsBrandMarkup;

          const syncMastheadRoute = () => {
            const isInsightsIndex = normalizePath(window.location.pathname) === normalizePath(assetUrl.pathname);
            masthead.classList.toggle("oireachtas-masthead--index", isInsightsIndex);
            resourceLink.hidden = isInsightsIndex;
            indexTitle.hidden = !isInsightsIndex;
          };

          const actions = document.createElement("div");
          actions.className = "oireachtas-masthead__actions";

          inner.append(homeLink, resourceLink, indexTitle, actions);
          masthead.appendChild(inner);
          syncMastheadRoute();

          const mobileTools = document.createElement("div");
          mobileTools.className = "mobile-reading-tools";
          mobileTools.hidden = true;
          mobileTools.innerHTML = \`
            <button class="mobile-reading-tools__back" type="button" aria-label="Go back" title="Go back">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg>
            </button>
            <div class="mobile-reading-tools__more-wrap">
              <button class="mobile-reading-tools__more" type="button" aria-label="More options" aria-expanded="false" title="More options">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
              </button>
              <div class="mobile-reading-tools__menu" hidden></div>
            </div>
          \`;

          const backButton = mobileTools.querySelector(".mobile-reading-tools__back");
          const moreButton = mobileTools.querySelector(".mobile-reading-tools__more");
          const moreMenu = mobileTools.querySelector(".mobile-reading-tools__menu");
          backButton.addEventListener("click", () => {
            if (window.history.length > 1) window.history.back();
            else window.location.href = assetUrl.href;
          });
          const setMoreOpen = (open) => {
            moreMenu.hidden = !open;
            moreButton.setAttribute("aria-expanded", String(open));
          };
          moreButton.addEventListener("click", () => setMoreOpen(moreMenu.hidden));
          document.addEventListener("pointerdown", (event) => {
            if (!moreMenu.hidden && !mobileTools.contains(event.target)) setMoreOpen(false);
          });
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !moreMenu.hidden) {
              setMoreOpen(false);
              moreButton.focus();
            }
          });

          const mobileQuery = window.matchMedia("(max-width: 720px)");
          let updatePending = false;
          const updateMobileTools = () => {
            updatePending = false;
            const tabsShell = document.querySelector(".insights-tabs-shell");
            const pastTopicNav = tabsShell
              ? tabsShell.getBoundingClientRect().top <= 12
              : window.scrollY > masthead.offsetHeight + 48;
            const visible = mobileQuery.matches && pastTopicNav;
            mobileTools.hidden = !visible;
            if (!visible) setMoreOpen(false);
          };
          const scheduleMobileToolsUpdate = () => {
            if (updatePending) return;
            updatePending = true;
            window.requestAnimationFrame(updateMobileTools);
          };
          window.addEventListener("scroll", scheduleMobileToolsUpdate, {passive: true});
          window.addEventListener("resize", scheduleMobileToolsUpdate, {passive: true});
          window.addEventListener("popstate", syncMastheadRoute);
          window.navigation?.addEventListener("navigatesuccess", syncMastheadRoute);
          document.addEventListener("click", (event) => {
            const link = event.target.closest?.("a[href]");
            if (!link) return;
            const destination = new URL(link.href, window.location.href);
            if (destination.origin !== window.location.origin) return;
            window.setTimeout(syncMastheadRoute, 0);
            window.setTimeout(syncMastheadRoute, 120);
          });
          const titleElement = document.querySelector("title");
          if (titleElement) {
            new MutationObserver(syncMastheadRoute).observe(titleElement, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }
          mobileQuery.addEventListener("change", scheduleMobileToolsUpdate);

          document.body.prepend(masthead);
          document.body.appendChild(mobileTools);
          updateMobileTools();
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", setupOireachtasMasthead, {once: true});
        } else {
          setupOireachtasMasthead();
        }
      })();


      (() => {
        const setupOireachtasFooter = () => {
          if (!document.body || document.querySelector(".oireachtas-footer")) return;

          const footer = document.createElement("footer");
          footer.className = "oireachtas-footer";

          const nav = document.createElement("nav");
          nav.className = "oireachtas-footer__nav";
          nav.setAttribute("aria-label", "Oireachtas information");

          const list = document.createElement("ul");
          list.className = "oireachtas-footer__links";

          const links = [
            ["Accessibility", "https://www.oireachtas.ie/en/accessibility-statement/"],
            ["Cookies", "https://www.oireachtas.ie/en/cookies/"],
            ["Transparency", "https://www.oireachtas.ie/en/transparency/"],
            ["Contact us", "https://www.oireachtas.ie/en/contact-us/"],
            ["Copyright and reuse", "https://www.oireachtas.ie/en/copyright-and-reuse/"],
          ];

          for (const [label, href] of links) {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = href;
            link.textContent = label;
            item.appendChild(link);
            list.appendChild(item);
          }

          nav.appendChild(list);
          footer.appendChild(nav);
          document.body.appendChild(footer);
        };

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", setupOireachtasFooter, {once: true});
        } else {
          setupOireachtasFooter();
        }
      })();

      (() => {
        const setupBackToTop = () => {
          if (!document.body || document.querySelector(".page-back-to-top")) return;

          const button = document.createElement("button");
          button.type = "button";
          button.className = "page-back-to-top";
          button.setAttribute("aria-label", "Back to top");
          button.title = "Back to top";
          button.hidden = true;
          button.innerHTML = '<svg class="page-back-to-top__arrow" aria-hidden="true" viewBox="0 0 24 24"><path d="m6.5 14.5 5.5-5.5 5.5 5.5"/></svg>';

          const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
          button.addEventListener("click", () => {
            window.scrollTo({
              top: 0,
              behavior: reducedMotion.matches ? "auto" : "smooth",
            });
          });

          let updatePending = false;
          const updateVisibility = () => {
            updatePending = false;
            button.hidden = window.scrollY <= 640;
          };
          const onScroll = () => {
            if (updatePending) return;
            updatePending = true;
            window.requestAnimationFrame(updateVisibility);
          };

          window.addEventListener("scroll", onScroll, {passive: true});
          document.body.appendChild(button);
          updateVisibility();
        };

        if (document.readyState !== "complete") {
          window.addEventListener("load", setupBackToTop, {once: true});
        } else {
          setupBackToTop();
        }
      })();

      (() => {
        const setupDistrictClearShortcut = () => {
          if (!document.body || document.querySelector(".page-clear-district")) return;

          const shortcut = document.createElement("button");
          shortcut.type = "button";
          shortcut.className = "page-clear-district";
          shortcut.title = "Return to the constituency overview";
          shortcut.hidden = true;
          shortcut.innerHTML = '<span class="page-clear-district__icon" aria-hidden="true">×</span><span>Clear district</span>';

          const inlineSelector = ".demographic-scope-context__clear";
          const inlineClearButton = () => document.querySelector(inlineSelector);
          const isInViewport = (element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.bottom > 0 && bounds.top < window.innerHeight;
          };

          let updatePending = false;
          const updateVisibility = () => {
            updatePending = false;
            const inlineButton = inlineClearButton();
            shortcut.hidden = !inlineButton || isInViewport(inlineButton);
            if (inlineButton) {
              shortcut.setAttribute(
                "aria-label",
                inlineButton.getAttribute("aria-label") || "Clear electoral district selection"
              );
            }
          };
          const scheduleUpdate = () => {
            if (updatePending) return;
            updatePending = true;
            window.requestAnimationFrame(updateVisibility);
          };

          shortcut.addEventListener("click", () => inlineClearButton()?.click());
          window.addEventListener("scroll", scheduleUpdate, {passive: true});
          window.addEventListener("resize", scheduleUpdate, {passive: true});
          new MutationObserver(scheduleUpdate).observe(document.body, {
            childList: true,
            subtree: true,
          });

          document.body.appendChild(shortcut);
          updateVisibility();
        };

        if (document.readyState !== "complete") {
          window.addEventListener("load", setupDistrictClearShortcut, {once: true});
        } else {
          setupDistrictClearShortcut();
        }
      })();

      (() => {
        const retryParameter = "__module_retry";
        const moduleFailure = /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module/i;
        let retryStarted = false;

        const retryOnce = () => {
          const url = new URL(window.location.href);
          if (retryStarted || url.searchParams.has(retryParameter)) return;
          retryStarted = true;
          url.searchParams.set(retryParameter, Date.now().toString());
          window.location.replace(url);
        };

        window.addEventListener("error", (event) => {
          const target = event.target;
          const failedModuleResource =
            (target instanceof HTMLScriptElement && target.type === "module") ||
            (target instanceof HTMLLinkElement && target.rel === "modulepreload");
          const message = event.error?.message || event.message || "";
          if (failedModuleResource || moduleFailure.test(String(message))) retryOnce();
        }, true);

        window.addEventListener("unhandledrejection", (event) => {
          const message = event.reason?.message || event.reason || "";
          if (moduleFailure.test(String(message))) retryOnce();
        });
      })();
    </script>
  `,
  root: "src",
  style: "style.css",
  theme: null,
  globalStylesheets: [],
  sidebar: false,
  toc: false,
  pager: false,
  footer: "© Houses of the Oireachtas",
};
