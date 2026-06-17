import { PDFDocument } from "pdf-lib";
import { fromBuffer } from "pdf2pic";
import { getOpenAIClient, VISION_MODEL } from "./openai";

// Hard ceiling on document length: rendering + a GPT-4o vision call per page
// makes cost and processing time scale linearly with page count, so very
// long PDFs need to be split rather than ingested whole.
export const MAX_PDF_PAGES = 50;

// How many pages to render/extract concurrently. Keeps wall-clock time down
// for large documents without firing 50 vision calls at once.
const PAGE_CONCURRENCY = 5;

const RENDER_OPTIONS = {
  density: 200,
  format: "png",
  width: 1700,
  height: 2200,
  preserveAspectRatio: true,
};

const SYSTEM_PROMPT =
  "Extract all content from this page. Format tables as Markdown tables. " +
  "For charts describe what they show and extract visible numbers and labels. " +
  "Preserve headings and structure. Return only extracted content.";

// Cheap page-count check (no rendering) so oversized PDFs can be rejected
// before any image conversion or vision calls happen.
export async function getPageCount(buffer) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return pdf.getPageCount();
}

// Renders each page of the PDF to a PNG and asks GPT-4o vision to transcribe
// it to Markdown, then concatenates the per-page results in page order.
export async function extractMarkdown(buffer) {
  const convert = fromBuffer(buffer, RENDER_OPTIONS);
  const pages = await convert.bulk(-1, { responseType: "base64" });

  const openaiClient = getOpenAIClient();
  const results = new Array(pages.length);

  for (let i = 0; i < pages.length; i += PAGE_CONCURRENCY) {
    const batch = pages.slice(i, i + PAGE_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((page) => extractPage(openaiClient, page.base64))
    );
    batchResults.forEach((text, j) => {
      results[i + j] = text;
    });
  }

  return results.filter(Boolean).join("\n\n");
}

async function extractPage(openaiClient, base64Png) {
  const response = await openaiClient.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Png}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content?.trim() ?? "";
}
