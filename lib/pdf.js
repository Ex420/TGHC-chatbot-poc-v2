import { extractTextItems, getDocumentProxy } from "unpdf";

// Font-size ratio (relative to the document's body text size) above which a
// line is treated as a heading, mapped to the Markdown heading level.
const HEADING_LEVELS = [
  { ratio: 1.6, prefix: "#" },
  { ratio: 1.3, prefix: "##" },
  { ratio: 1.15, prefix: "###" },
];

const BULLET_RE = /^[•▪◦‣∙○●]\s*(.+)/;
const NUMBERED_RE = /^\(?(\d{1,3})[.)]\s+(.+)/;

// Extracts text from a PDF buffer and reconstructs it as Markdown, using
// each line's font size and vertical position (from unpdf's structured text
// items) to tell headings, list items and wrapped paragraph lines apart --
// plain text extraction collapses all of that structure into a flat string.
export async function extractMarkdown(buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { items } = await extractTextItems(pdf);

  const pages = items.map((pageItems) =>
    groupIntoLines(pageItems).filter((line) => line.text)
  );
  const allLines = pages.flat();
  if (allLines.length === 0) return "";

  const bodySize = modeFontSize(allLines);
  const gap = medianLineGap(allLines);

  const blocks = [];
  for (const pageLines of pages) {
    let prevLine = null;
    for (const line of pageLines) {
      appendLine(blocks, line, prevLine, bodySize, gap);
      prevLine = line;
    }
  }

  return blocks
    .map((block) => block.lines.join(block.type === "paragraph" ? " " : "\n"))
    .join("\n\n");
}

function appendLine(blocks, line, prevLine, bodySize, gap) {
  const heading = headingPrefix(line.fontSize, bodySize);
  const list = !heading && matchListItem(line.text);
  const type = heading ? "heading" : list ? "list" : "paragraph";
  const text = heading ? `${heading} ${line.text}` : list ?? line.text;

  const current = blocks[blocks.length - 1];
  const continuesCurrent =
    type === "list"
      ? current?.type === "list"
      : type === "paragraph" &&
        current?.type === "paragraph" &&
        isWrappedLine(prevLine, line, gap);

  if (continuesCurrent) {
    current.lines.push(text);
  } else {
    blocks.push({ type, lines: [text] });
  }
}

// Groups text items into lines. Items on the same visual line share a y
// position, so a change in y starts a new line; `hasEOL` additionally
// closes a line, since the last line before a flowable/paragraph boundary
// (e.g. right before a heading) isn't always followed by a y change before
// the next item -- relying on `hasEOL` alone would merge it with whatever
// (differently sized) text comes next.
function groupIntoLines(items) {
  const lines = [];
  let current = [];
  for (const item of items) {
    if (current.length && item.y !== current[current.length - 1].y) {
      lines.push(toLine(current));
      current = [];
    }
    current.push(item);
    if (item.hasEOL) {
      lines.push(toLine(current));
      current = [];
    }
  }
  if (current.length) lines.push(toLine(current));
  return lines;
}

function toLine(items) {
  return {
    text: items
      .map((item) => item.str)
      .join("")
      .replace(/\s+/g, " ")
      .trim(),
    fontSize: Math.max(...items.map((item) => item.fontSize)),
    y: items[0].y,
  };
}

// The most common font size, weighted by character count, stands in for
// the document's regular body text size.
function modeFontSize(lines) {
  const weights = new Map();
  for (const { fontSize, text } of lines) {
    const key = Math.round(fontSize);
    weights.set(key, (weights.get(key) ?? 0) + text.length);
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// The median vertical gap between consecutive lines approximates normal
// single-line spacing, since most line breaks are word-wraps rather than
// paragraph breaks.
function medianLineGap(lines) {
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = Math.abs(lines[i - 1].y - lines[i].y);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

// A line is a wrapped continuation of the previous one (same paragraph)
// when it follows closely at a similar font size, rather than after a
// paragraph-sized gap or a font change.
function isWrappedLine(prevLine, line, gap) {
  if (!prevLine || gap <= 0) return false;
  const delta = Math.abs(prevLine.y - line.y);
  const sizeRatio = line.fontSize / prevLine.fontSize;
  return delta <= gap * 1.5 && sizeRatio > 0.85 && sizeRatio < 1.15;
}

function headingPrefix(fontSize, bodySize) {
  const ratio = fontSize / bodySize;
  return HEADING_LEVELS.find((level) => ratio >= level.ratio)?.prefix ?? null;
}

function matchListItem(text) {
  const bulleted = text.match(BULLET_RE);
  if (bulleted) return `- ${bulleted[1]}`;

  const numbered = text.match(NUMBERED_RE);
  if (numbered) return `${numbered[1]}. ${numbered[2]}`;

  return null;
}
