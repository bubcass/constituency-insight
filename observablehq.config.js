export default {
  title: "Constituency Insights",
  head: `
    <link rel="icon" href="logo.png" type="image/png" sizes="32x32">
    <script>
      document.documentElement.lang = "en-IE";

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
  sidebar: false,
  toc: false,
  pager: false,
  footer: "© Houses of the Oireachtas",
};
