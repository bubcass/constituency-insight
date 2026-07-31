function dateKey(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function isSittingMember(member, asOf = new Date()) {
  const day = dateKey(asOf);
  const startDate = dateKey(member?.startDate);
  const endDate = dateKey(member?.endDate);

  return (!startDate || startDate <= day) && (!endDate || endDate >= day);
}

export function membersForConstituency(lookup, constituency, asOf = new Date()) {
  const selected = String(constituency ?? "").trim();

  return Object.values(lookup ?? {})
    .filter((member) => String(member?.constituency ?? "").trim() === selected)
    .filter((member) => isSittingMember(member, asOf))
    .sort((a, b) => String(a.memberName ?? "").localeCompare(String(b.memberName ?? ""), "en"));
}
