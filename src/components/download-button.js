import * as d3 from "npm:d3";

export function downloadButton(
  data,
  filename = "pq_dataset.csv",
  options = {},
) {
  if (!Array.isArray(data)) {
    throw new Error("Array of data required as first argument");
  }

  const { label = null } = options;

  // Keep rows flexible for derived datasets, but normalise string values
  const normalised = data.map((row) =>
    Object.fromEntries(
      Object.entries(row ?? {}).map(([key, value]) => {
        if (value == null) return [key, ""];
        if (typeof value === "string") {
          return [key, value.replace(/\s+/g, " ").trim()];
        }
        return [key, value];
      }),
    ),
  );

  let blob;

  if (filename.toLowerCase().endsWith(".csv")) {
    const csvContent = "\uFEFF" + d3.csvFormat(normalised);
    blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
  } else {
    blob = new Blob([JSON.stringify(normalised, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
  }

  const button = document.createElement("button");
  button.className = "pq-download";
  button.type = "button";

  const state =
    window.pqDeputiesState ?? window.pqPartiesState ?? window.pqState ?? {};

  const uniqueDeputies = [
    ...new Set(
      normalised.map((d) => d.deputy ?? d.memberName ?? "").filter(Boolean),
    ),
  ];

  const name = uniqueDeputies.length === 1 ? uniqueDeputies[0] : null;

  const defaultLabel = name
    ? `Download dataset for ${name}${state.year ? ` (${state.year})` : ""}`
    : `Download dataset${state.year ? ` ${state.year}` : ""}`;

  button.textContent = label ?? defaultLabel;

  button.addEventListener("click", () => {
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  });

  return button;
}
