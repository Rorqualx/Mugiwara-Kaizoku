import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface Token {
  text: string;
  nearestLabelText?: string;
  isImage?: boolean;
  isInTable?: boolean;
  tableCol?: number | null;
  tableRow?: number | null;
  isTableHeader?: boolean;
  imageSrc?: string | null;
  isHeader?: boolean;
  headerLevel?: number;
  xpath?: string;
  sectionType?: string;
  classList?: string[];
  isLink?: boolean;
}

function log(msg: string): void { process.stdout.write(msg + "\n"); }

function logTokensInRow(tokens: Token[], labels: string[], targetRow: number | null | undefined): void {
  if (targetRow === null || targetRow === undefined) return;
  for (let j = 0; j < tokens.length; j++) {
    const rt = tokens[j];
    if (rt.tableRow !== targetRow) continue;
    const rl = labels[j] ?? "O";
    log("  #" + j + " \"" + rt.text + "\" label:" + rl + " col:" + rt.tableCol);
  }
}

async function main(): Promise<void> {
  const page = await prisma.annotatedPage.findUnique({
    where: { id: "cml4hqh5y0008wccviumstaj3" },
    select: { tokens: true, labels: true }
  });
  if (!page) { log("Page not found"); return; }

  const tokens = page.tokens as Token[];
  const labels = page.labels as string[];

  // Find ALL "19" tokens and their labels
  log("=== All '19' tokens ===");
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const l = labels[i] ?? "O";
    if (t.text !== "19") continue;
    log("#" + i + " \"19\" label:" + l);
    log("  nearestLabelText: " + t.nearestLabelText);
    log("  isInTable: " + t.isInTable + " col:" + t.tableCol + " row:" + t.tableRow);
    log("  xpath: " + t.xpath);
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev) log("  prev: \"" + prev.text + "\" label:" + (labels[i-1] ?? "O"));
    if (next) log("  next: \"" + next.text + "\" label:" + (labels[i+1] ?? "O"));
    log("");
  }

  // Find Volume 19 row (look for "Volume" followed by "19")
  log("\n=== Volume 19 row tokens ===");
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!/^volume$/i.test(t.text)) continue;
    if (tokens[i + 1]?.text !== "19") continue;
    log("Found 'Volume 19' at index " + i);
    log("Table row: " + t.tableRow);
    logTokensInRow(tokens, labels, t.tableRow);
    break;
  }

  // Show all unique labels
  log("\n=== Unique labels found ===");
  const uniqueLabels = new Set(labels.filter(l => l && l !== "O"));
  log(Array.from(uniqueLabels).join(", "));

  await prisma.$disconnect();
}
main().catch((e: unknown) => process.stderr.write(String(e) + "\n"));
