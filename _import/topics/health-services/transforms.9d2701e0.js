export function filterHealthServices(rows, {constituency, district = "all"} = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) =>
    row.constituency === constituency && (district === "all" || row.electoral_district_guid === district)
  );
}

export function buildHealthServiceMetrics(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const count = (type) => safeRows.filter((row) => row.service_type === type).length;
  const practitioners = safeRows.filter((row) => row.service_type === "gp")
    .reduce((sum, row) => sum + (Number(row.practitioner_count) || 0), 0);
  return [
    {label: "Health service locations", value: safeRows.length.toLocaleString("en-IE"), note: "Mapped in this area"},
    {label: "GP practices", value: count("gp").toLocaleString("en-IE"), note: `${practitioners.toLocaleString("en-IE")} listed ${practitioners === 1 ? "practitioner" : "practitioners"}`},
    {label: "Pharmacies", value: count("pharmacy").toLocaleString("en-IE"), note: "Mapped pharmacy locations"},
    {label: "Hospitals & health centres", value: (count("hospital") + count("health-centre")).toLocaleString("en-IE"), note: `${count("hospital")} hospitals · ${count("health-centre")} health centres`},
  ];
}

export function healthServiceDownloadRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    service_type: row.service_type,
    name: row.name,
    subtype: row.subtype,
    address: row.address,
    eircode: row.eircode,
    telephone: row.telephone,
    email: row.email,
    website: row.website,
    practitioner_count: row.practitioner_count,
    constituency: row.constituency,
    electoral_district: row.electoral_district,
    electoral_district_guid: row.electoral_district_guid,
    longitude: row.longitude,
    latitude: row.latitude,
  }));
}
