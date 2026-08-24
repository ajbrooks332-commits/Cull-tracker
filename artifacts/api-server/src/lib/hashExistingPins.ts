import { db, stalkersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const stalkers = await db.select().from(stalkersTable);
  let hashed = 0;
  for (const s of stalkers) {
    if (s.pin.startsWith("$2")) {
      console.log(`  skip ${s.name} (already hashed)`);
      continue;
    }
    const hash = await bcrypt.hash(s.pin, 12);
    await db.update(stalkersTable).set({ pin: hash }).where(eq(stalkersTable.id, s.id));
    console.log(`  hashed ${s.name}`);
    hashed++;
  }
  console.log(`Done — ${hashed} PIN(s) hashed.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
