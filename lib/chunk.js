const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

// Splits text into overlapping chunks, preferring to break on paragraph or
// sentence boundaries near the target size instead of cutting mid-word.
export function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    if (end < cleaned.length) {
      const window = cleaned.slice(start, end);
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n")
      );
      if (breakAt > chunkSize * 0.5) {
        end = start + breakAt + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
