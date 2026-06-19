const MAX_SECTION_CHARS = 2000;
const MAX_PARAGRAPHS_PER_CHUNK = 3;
const HEADING_MAX_LENGTH = 80;

// Splits extracted text into structure-aware chunks instead of fixed-size
// windows: paragraphs are grouped under whichever heading precedes them, so
// a chunk stays topically coherent and can carry that heading as a source
// reference. Returns [{ heading, content }, ...].
export function chunkText(text) {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return [];

  const sections = groupIntoSections(paragraphs);

  const chunks = [];
  for (const section of sections) {
    chunks.push(...splitSection(section));
  }
  return chunks;
}

// A paragraph is treated as a heading when it's short, doesn't read like a
// finished sentence, and is immediately followed by longer paragraph text
// that it's plausibly introducing.
function isHeading(paragraph, next) {
  const text = stripMarkup(paragraph);
  if (!text || text.includes("\n")) return false;
  if (text.length >= HEADING_MAX_LENGTH || text.endsWith(".")) return false;
  if (next == null) return false;
  return stripMarkup(next).length > text.length;
}

function stripMarkup(paragraph) {
  return paragraph.replace(/^#{1,6}\s*/, "").trim();
}

// Groups paragraphs into sections, each either starting with a detected
// heading (followed by all paragraphs until the next heading) or, when no
// heading precedes them, collected as a single headingless section.
function groupIntoSections(paragraphs) {
  const sections = [];
  let current = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (isHeading(paragraph, paragraphs[i + 1])) {
      current = { heading: stripMarkup(paragraph), paragraphs: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: null, paragraphs: [] };
      sections.push(current);
    }
    current.paragraphs.push(paragraph);
  }

  return sections.filter((section) => section.paragraphs.length > 0);
}

function splitSection(section) {
  if (section.heading) {
    return splitLongSection(section.heading, section.paragraphs);
  }
  return groupParagraphs(section.paragraphs, MAX_PARAGRAPHS_PER_CHUNK).map(
    (paragraphs) => ({ heading: null, content: paragraphs.join("\n\n") })
  );
}

function groupParagraphs(paragraphs, max) {
  const groups = [];
  for (let i = 0; i < paragraphs.length; i += max) {
    groups.push(paragraphs.slice(i, i + max));
  }
  return groups;
}

// Keeps a heading with its paragraphs as one chunk unless that would exceed
// MAX_SECTION_CHARS, in which case it splits at paragraph boundaries --
// never mid-sentence -- repeating the heading on each resulting chunk.
function splitLongSection(heading, paragraphs) {
  const groups = [[]];
  let length = heading.length;

  for (const paragraph of paragraphs) {
    const currentGroup = groups[groups.length - 1];
    const addedLength = paragraph.length + 2;
    if (currentGroup.length > 0 && length + addedLength > MAX_SECTION_CHARS) {
      groups.push([paragraph]);
      length = heading.length + paragraph.length;
    } else {
      currentGroup.push(paragraph);
      length += addedLength;
    }
  }

  return groups
    .filter((group) => group.length > 0)
    .map((group) => ({ heading, content: group.join("\n\n") }));
}
