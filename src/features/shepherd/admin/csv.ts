// RFC 4180-style fields: quoted commas, escaped quotes, CRLF and embedded newlines.
export function parseCsv(source: string): Record<string, string>[] {
  if (source.length > 2_000_000) throw new Error("CSV must be smaller than 2 MB.");
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed) throw new Error("Unexpected quote in CSV.");
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(field.trim());
      field = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
      continue;
    }
    if (closed && c.trim()) throw new Error("Unexpected text after a quoted field.");
    if (!closed) field += c;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((h) => h.toLowerCase());
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error("CSV needs unique column headings.");
  if (rows.length > 500) throw new Error("Import at most 500 rows at once.");
  return rows.map((values, index) => {
    if (values.length !== headers.length)
      throw new Error(`Row ${index + 2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((h, i) => [h, values[i]!]));
  });
}
export function peopleImport(rows: Record<string, string>[], owner: string) {
  if (!rows.length) throw new Error("CSV has no data rows.");
  const seen = new Set<string>();
  return rows.map((row, i) => {
    const full_name = row["name"] ?? "";
    const phone_e164 = row["phone"] ?? "";
    if (!full_name || full_name.length > 140)
      throw new Error(`Row ${i + 2}: name is required (up to 140 characters).`);
    if (phone_e164 && !/^\+[1-9][0-9]{7,14}$/.test(phone_e164))
      throw new Error(`Row ${i + 2}: phone must use international format, such as +447700900123.`);
    if (phone_e164 && seen.has(phone_e164))
      throw new Error(`Row ${i + 2}: duplicate phone number in this CSV.`);
    if (phone_e164) seen.add(phone_e164);
    return { full_name, phone_e164, owner_id: owner };
  });
}
