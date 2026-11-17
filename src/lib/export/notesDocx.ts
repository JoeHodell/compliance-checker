import {
  CommentRangeEnd,
  CommentRangeStart,
  CommentReference,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild,
} from "docx";

export type NoteFlag = {
  category: string;
  severity: "HARD" | "STYLE";
  location: { paragraphIndex: number; startOffset: number; endOffset: number };
  message: string;
  /** The client's own style guide copy behind the rule, when there is one. */
  ruleQuote: string | null;
};

function categoryLabel(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

const AUTHOR = "Style Guide Checker";

/**
 * Builds a .docx of the checked document's text in which every accepted flag is a Word
 * comment anchored to the exact flagged passage. We only keep the extracted text of an
 * upload (not the original file), so this is a regenerated copy — formatting from the
 * original isn't carried over.
 */
export async function buildNotesDocx({
  documentName,
  clientName,
  paragraphs,
  flags,
}: {
  documentName: string;
  clientName: string;
  paragraphs: string[];
  flags: NoteFlag[];
}): Promise<Buffer> {
  const date = new Date();
  const comments: {
    id: number;
    author: string;
    initials: string;
    date: Date;
    children: Paragraph[];
  }[] = [];

  // Group flags by paragraph. The comment id is the flag's position in `comments`.
  const byParagraph = new Map<number, { id: number; start: number; end: number }[]>();
  const ordered = [...flags].sort(
    (a, b) =>
      a.location.paragraphIndex - b.location.paragraphIndex || a.location.startOffset - b.location.startOffset
  );
  for (const flag of ordered) {
    const { paragraphIndex } = flag.location;
    const text = paragraphs[paragraphIndex];
    if (text === undefined) continue;
    const start = Math.max(0, Math.min(flag.location.startOffset, text.length));
    const end = Math.max(start, Math.min(flag.location.endOffset, text.length));

    const id = comments.length;
    const heading = `${flag.severity === "HARD" ? "Hard rule" : "Style preference"} · ${categoryLabel(flag.category)}`;
    const children = [
      new Paragraph({ children: [new TextRun({ text: heading, bold: true })] }),
      new Paragraph({ children: [new TextRun(flag.message)] }),
    ];
    if (flag.ruleQuote) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: `Style guide: “${flag.ruleQuote}”`, italics: true })] })
      );
    }
    comments.push({ id, author: AUTHOR, initials: "SG", date, children });

    const list = byParagraph.get(paragraphIndex) ?? [];
    list.push({ id, start, end });
    byParagraph.set(paragraphIndex, list);
  }

  const body: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(documentName)] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Reviewed against ${clientName} — ${comments.length} accepted note${comments.length === 1 ? "" : "s"}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
    }),
  ];

  paragraphs.forEach((text, index) => {
    const anchors = byParagraph.get(index) ?? [];
    if (anchors.length === 0) {
      body.push(new Paragraph({ children: [new TextRun(text)], spacing: { after: 160 } }));
      return;
    }

    // Split the paragraph at every comment boundary so ranges can overlap or nest
    // (Word allows that) without any flag losing its anchor.
    const cuts = Array.from(new Set([0, text.length, ...anchors.flatMap((a) => [a.start, a.end])])).sort(
      (a, b) => a - b
    );
    const children: ParagraphChild[] = [];
    for (let i = 0; i < cuts.length; i++) {
      const pos = cuts[i];
      for (const a of anchors) {
        if (a.end === pos) {
          children.push(new CommentRangeEnd(a.id));
          children.push(new TextRun({ children: [new CommentReference(a.id)] }));
        }
      }
      for (const a of anchors) {
        if (a.start === pos) children.push(new CommentRangeStart(a.id));
      }
      const next = cuts[i + 1];
      if (next !== undefined && next > pos) {
        const insideAny = anchors.some((a) => a.start <= pos && a.end >= next);
        children.push(new TextRun({ text: text.slice(pos, next), highlight: insideAny ? "yellow" : undefined }));
      }
    }
    body.push(new Paragraph({ children, spacing: { after: 160 } }));
  });

  const doc = new Document({
    creator: AUTHOR,
    title: `${documentName} — review notes`,
    comments: { children: comments },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 } } }, children: body }],
  });
  return Packer.toBuffer(doc);
}
