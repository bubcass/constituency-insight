export function tabularRows(table) {
  const columns = Array.isArray(table?.columns) ? table.columns : [];
  const values = Array.isArray(table?.rows) ? table.rows : [];
  if (!columns.length) throw new Error("Tabular data has no columns");

  const rows = values.map((cells, rowIndex) => {
    if (!Array.isArray(cells) || cells.length !== columns.length) {
      throw new Error(`Tabular data row ${rowIndex + 1} does not match its columns`);
    }
    const row = {};
    for (let index = 0; index < columns.length; index += 1) {
      row[columns[index]] = cells[index];
    }
    return row;
  });
  Object.defineProperty(rows, "columns", {value: columns});
  return rows;
}
