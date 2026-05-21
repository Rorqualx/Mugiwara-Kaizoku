import { prisma } from '@/server/db';
const titles = ['Dr. Stone', 'Monster', 'Record of Ragnarok', 'Bleach', 'Konosuba', 'Dragon Ball', 'Fruits Basket', 'Nana', 'One Punch Man'];
const rows: string[] = [];
for (const t of titles) {
  const m = await prisma.manga.findFirst({
    where: { title: { contains: t } },
    select: { id: true, title: true, Volume: { select: { pageCount: true } } },
  });
  if (!m) { rows.push(`${t.padEnd(30)} NOT FOUND`); continue; }
  const total = m.Volume.length;
  const withPC = m.Volume.filter(v => v.pageCount).length;
  rows.push(`${m.title.padEnd(30)} id:${m.id} vols:${total} withPC:${withPC}`);
}
process.stdout.write(rows.join('\n') + '\n');
await prisma.$disconnect();
