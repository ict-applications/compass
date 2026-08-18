import fs from 'fs';
import path from 'path';

export interface ParseResult {
  text: string;
  pageCount?: number;
  slideCount?: number;
  wordCount: number;
}

export async function parseDocument(filepath: string, mimetype: string): Promise<ParseResult> {
  const ext = path.extname(filepath).toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    return parsePdf(filepath);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx' ||
    ext === '.doc'
  ) {
    return parseDocx(filepath);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === '.pptx'
  ) {
    return parsePptx(filepath);
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}

async function parsePdf(filepath: string): Promise<ParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filepath);
  const result = await pdfParse(buffer);
  const text = result.text as string;
  return {
    text,
    pageCount: result.numpages as number,
    wordCount: countWords(text),
  };
}

async function parseDocx(filepath: string): Promise<ParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filepath });
  const text = result.value as string;
  return {
    text,
    wordCount: countWords(text),
  };
}

async function parsePptx(filepath: string): Promise<ParseResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pptxParser = require('pptx-text-parser');
  const rawText: string = await pptxParser(filepath);

  // Split into slides by common delimiters and add slide headers
  const slides = rawText.split(/\f|\r?\n{3,}/).filter((s: string) => s.trim());
  const text = slides.length > 1
    ? slides.map((slide: string, i: number) => `--- Slide ${i + 1} ---\n${slide.trim()}`).join('\n\n')
    : rawText;

  return {
    text,
    slideCount: slides.length,
    wordCount: countWords(text),
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
