export const sportsFundingTopic = {
  slug: "sports-funding",

  title: "Sports funding",
  eyebrow: "Constituency Insights",
  heroTitle: "Sports funding",
  heroSubtitle:
    "A data-led exploration of sports projects funding by constituency.",

  description:
    "This page brings together constituency-level information and project-level sports funding data to show where funding has been allocated, which organisations received it, and how it is distributed across sport types.",

  sourceNote:
    "Sports funding records are mapped using project coordinates and filtered to the selected constituency boundary.",

  palette: [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ],

  fields: {
    lat: "latitude",
    lon: "longitude",
    amount: "amount_allocated",
    category: "sport_type",
    year: "year",
    entity: "organisation",
    title: "project_title",
    county: "county",
    constituency: "constituency",
    constituencySlug: "constituencySlug",
  },

  labels: {
    baseLayer: "Sports",
    categoryLegend: "Sport type",
    amountLegend: "Funding allocated",
    visibleCount: "Visible grants",
    noRecordsInView: "No grants in view.",
    clearAll: "Deselect all",
    clearAllTitle: "Hide all sport layers",

    metricsTitle: "At a glance",

    memberCardsTitle: ({ constituency } = {}) =>
      constituency
        ? `How ${constituency} is represented in Parliament`
        : "How the constituency is represented in Parliament",

    summaryTitle: ({ constituency } = {}) =>
      constituency ? constituency : "Constituency summary",

    summaryIntro: ({ constituency } = {}) =>
      constituency
        ? `Explore sports funding projects and constituency representation for ${constituency}.`
        : "Explore sports funding projects and constituency representation.",

    downloadLabel: ({ constituency } = {}) =>
      constituency
        ? `Download sports funding dataset for ${constituency}`
        : "Download sports funding dataset",
  },

  metrics: [
    {
      key: "totalAllocated",
      label: "Total allocated",
      type: "currency",
      field: "__amount",
    },
    {
      key: "projectCount",
      label: "Projects",
      type: "count",
      field: "__title",
    },
    {
      key: "organisationCount",
      label: "Organisations",
      type: "distinct",
      field: "__entity",
    },
    {
      key: "sportTypeCount",
      label: "Sport types",
      type: "distinct",
      field: "__category",
    },
  ],

  chartBlocks: [
    {
      key: "amountByCategory",
      type: "bar-category-sum",
      title: "Funding by sport type",
      valueField: "__amount",
      categoryField: "__category",
    },
    {
      key: "amountByYear",
      type: "bar-category-sum",
      title: "Funding by year",
      valueField: "__amount",
      categoryField: "__year",
    },
    {
      key: "topOrganisations",
      type: "bar-category-sum",
      title: "Top organisations by funding",
      valueField: "__amount",
      categoryField: "__entity",
      limit: 10,
    },
    {
      key: "topProjects",
      type: "bar-category-sum",
      title: "Top projects by funding",
      valueField: "__amount",
      categoryField: "__title",
      limit: 10,
    },
  ],

  formatters: {
    amount(value) {
      return Number.isFinite(value)
        ? new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(value)
        : "—";
    },
  },

  tooltipHTML(record, { formatAmount, escapeHtml }) {
    return `
      <div><strong>${escapeHtml(record.__category)} | ${escapeHtml(
        formatAmount(record.__amount),
      )}</strong></div>
      <div><em>${escapeHtml(record.__entity ?? "—")}</em></div>
      <div><strong>Project: </strong>${escapeHtml(record.__title ?? "—")}</div>
      <div><strong>Year: </strong>${escapeHtml(record.__year ?? "—")}</div>
    `;
  },
};
