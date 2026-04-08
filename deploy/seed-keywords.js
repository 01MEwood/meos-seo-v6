// ============================================================
// MEOS:SEO v6.0 — Seed-Skript: 18 Orte × Dachschrägenschrank
// Aufruf (im Backend-Container):
//   docker compose exec backend node /app/seed-keywords.js
// ============================================================
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Vorschlag: 18 Orte im Großraum Stuttgart.
// Bitte vor dem Run mit Mario abgleichen — nicht in Stein gemeißelt.
const ORTE = [
  'Stuttgart',
  'Esslingen',
  'Ludwigsburg',
  'Waiblingen',
  'Böblingen',
  'Sindelfingen',
  'Leonberg',
  'Kornwestheim',
  'Fellbach',
  'Leinfelden-Echterdingen',
  'Ostfildern',
  'Filderstadt',
  'Remseck am Neckar',
  'Kirchheim unter Teck',
  'Nürtingen',
  'Backnang',
  'Göppingen',
  'Herrenberg',
];

const SERVICE = 'Dachschrägenschrank';

async function main() {
  let created = 0;
  let skipped = 0;

  for (const ort of ORTE) {
    const keyword = `${SERVICE} ${ort}`;
    const existing = await prisma.keyword.findFirst({
      where: { keyword, region: ort },
    });
    if (existing) {
      skipped++;
      console.log(`⊙ skip: ${keyword}`);
      continue;
    }
    await prisma.keyword.create({
      data: {
        keyword,
        region: ort,
        service: SERVICE,
        isActive: true,
      },
    });
    created++;
    console.log(`✔ add:  ${keyword}`);
  }

  console.log(`\nFertig: ${created} neu, ${skipped} übersprungen, ${ORTE.length} gesamt.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
