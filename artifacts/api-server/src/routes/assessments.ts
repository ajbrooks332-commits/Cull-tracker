import { Router, type IRouter } from "express";
import { db, deerAssessmentsTable, stalkersTable } from "@workspace/db";
import { and, between, desc, eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/session.js";

const router: IRouter = Router();

// Whitelist of writable columns on deer_assessments.  Anything not in this set
// (e.g. legacy client-side helper fields like `racksInWoodTallies`,
// `racksEdgeTallies`, `saplingsGroupTallies`, or `stalkerName`) is dropped
// before insert/update so that requests don't fail with "column does not exist"
// — that failure mode previously caused queued offline assessments to retry
// forever without ever syncing.
const ASSESSMENT_COLUMNS = new Set<string>([
  "stalkerId",
  "date",
  "woodlandBlock",
  "weather",
  "recorder",
  "sbiNumber",
  "standType",
  "canopyCover",
  "mainSpeciesInStand",
  "groundVegetation",
  "vegWithoutDeer",
  "deerPresent",
  "speciesAssessed",
  "speciesCausingImpact",
  "startedAt",
  "endedAt",
  "durationMinutes",
  "distanceWalked",
  "gpsRoute",
  "deerSeenScore",
  "dungTally",
  "couchesScore",
  "scrapesScore",
  "wallowsScore",
  "racksInWoodScore",
  "racksEdgeScore",
  "barkRemovalScore",
  "frayingScore",
  "barkStrippingScore",
  "brokenStemsScore",
  "browselineScore",
  "browsingCoppiceScore",
  "browsingBasalScore",
  "browsingSaplingsScore",
  "browsingBrambleScore",
  "grazingFlora",
  "activitySummary",
  "impactSummary",
  "activityTrend",
  "impactTrend",
  "trendNotes",
  "comments",
  "tallyCounts",
  "photos",
]);

function pickAssessmentFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (ASSESSMENT_COLUMNS.has(k)) out[k] = body[k];
  }
  return out;
}

function seasonDateRange(startYear: number) {
  return {
    start: new Date(startYear, 10, 1),
    end: new Date(startYear + 1, 9, 31, 23, 59, 59, 999),
  };
}

function validIntParam(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

router.get("/assessments", requireAuth, async (req, res) => {
  try {
    const stalkerId = validIntParam(req.query.stalkerId as string);
    const season = validIntParam(req.query.season as string);
    const filters = [];
    if (stalkerId !== null) filters.push(eq(deerAssessmentsTable.stalkerId, stalkerId));
    if (season !== null) {
      const { start, end } = seasonDateRange(season);
      filters.push(between(deerAssessmentsTable.date, start, end));
    }
    const rows = await db
      .select({
        id: deerAssessmentsTable.id,
        stalkerId: deerAssessmentsTable.stalkerId,
        stalkerName: stalkersTable.name,
        date: deerAssessmentsTable.date,
        woodlandBlock: deerAssessmentsTable.woodlandBlock,
        weather: deerAssessmentsTable.weather,
        recorder: deerAssessmentsTable.recorder,
        sbiNumber: deerAssessmentsTable.sbiNumber,
        standType: deerAssessmentsTable.standType,
        canopyCover: deerAssessmentsTable.canopyCover,
        mainSpeciesInStand: deerAssessmentsTable.mainSpeciesInStand,
        groundVegetation: deerAssessmentsTable.groundVegetation,
        vegWithoutDeer: deerAssessmentsTable.vegWithoutDeer,
        deerPresent: deerAssessmentsTable.deerPresent,
        speciesAssessed: deerAssessmentsTable.speciesAssessed,
        speciesCausingImpact: deerAssessmentsTable.speciesCausingImpact,
        distanceWalked: deerAssessmentsTable.distanceWalked,
        gpsRoute: deerAssessmentsTable.gpsRoute,
        deerSeenScore: deerAssessmentsTable.deerSeenScore,
        dungTally: deerAssessmentsTable.dungTally,
        couchesScore: deerAssessmentsTable.couchesScore,
        scrapesScore: deerAssessmentsTable.scrapesScore,
        wallowsScore: deerAssessmentsTable.wallowsScore,
        racksInWoodScore: deerAssessmentsTable.racksInWoodScore,
        racksEdgeScore: deerAssessmentsTable.racksEdgeScore,
        barkRemovalScore: deerAssessmentsTable.barkRemovalScore,
        frayingScore: deerAssessmentsTable.frayingScore,
        barkStrippingScore: deerAssessmentsTable.barkStrippingScore,
        brokenStemsScore: deerAssessmentsTable.brokenStemsScore,
        browselineScore: deerAssessmentsTable.browselineScore,
        browsingCoppiceScore: deerAssessmentsTable.browsingCoppiceScore,
        browsingBasalScore: deerAssessmentsTable.browsingBasalScore,
        browsingSaplingsScore: deerAssessmentsTable.browsingSaplingsScore,
        browsingBrambleScore: deerAssessmentsTable.browsingBrambleScore,
        grazingFlora: deerAssessmentsTable.grazingFlora,
        activitySummary: deerAssessmentsTable.activitySummary,
        impactSummary: deerAssessmentsTable.impactSummary,
        activityTrend: deerAssessmentsTable.activityTrend,
        impactTrend: deerAssessmentsTable.impactTrend,
        trendNotes: deerAssessmentsTable.trendNotes,
        comments: deerAssessmentsTable.comments,
        photos: deerAssessmentsTable.photos,
        createdAt: deerAssessmentsTable.createdAt,
        updatedAt: deerAssessmentsTable.updatedAt,
      })
      .from(deerAssessmentsTable)
      .leftJoin(stalkersTable, eq(deerAssessmentsTable.stalkerId, stalkersTable.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(deerAssessmentsTable.date));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assessments" });
  }
});

router.post("/assessments", requireAuth, async (req, res) => {
  try {
    const body = pickAssessmentFields({
      ...req.body,
      date:       req.body.date       ? new Date(req.body.date)       : new Date(),
      startedAt:  req.body.startedAt  ? new Date(req.body.startedAt)  : null,
      endedAt:    req.body.endedAt    ? new Date(req.body.endedAt)    : null,
    });
    const [inserted] = await db.insert(deerAssessmentsTable).values(body).returning();
    const [stalker] = inserted.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, inserted.stalkerId))
      : [];
    res.status(201).json({ ...inserted, stalkerName: stalker?.name ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create assessment" });
  }
});

router.get("/assessments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const rows = await db
      .select({
        id: deerAssessmentsTable.id,
        stalkerId: deerAssessmentsTable.stalkerId,
        stalkerName: stalkersTable.name,
        date: deerAssessmentsTable.date,
        woodlandBlock: deerAssessmentsTable.woodlandBlock,
        weather: deerAssessmentsTable.weather,
        recorder: deerAssessmentsTable.recorder,
        sbiNumber: deerAssessmentsTable.sbiNumber,
        standType: deerAssessmentsTable.standType,
        canopyCover: deerAssessmentsTable.canopyCover,
        mainSpeciesInStand: deerAssessmentsTable.mainSpeciesInStand,
        groundVegetation: deerAssessmentsTable.groundVegetation,
        vegWithoutDeer: deerAssessmentsTable.vegWithoutDeer,
        deerPresent: deerAssessmentsTable.deerPresent,
        speciesAssessed: deerAssessmentsTable.speciesAssessed,
        speciesCausingImpact: deerAssessmentsTable.speciesCausingImpact,
        distanceWalked: deerAssessmentsTable.distanceWalked,
        gpsRoute: deerAssessmentsTable.gpsRoute,
        deerSeenScore: deerAssessmentsTable.deerSeenScore,
        dungTally: deerAssessmentsTable.dungTally,
        couchesScore: deerAssessmentsTable.couchesScore,
        scrapesScore: deerAssessmentsTable.scrapesScore,
        wallowsScore: deerAssessmentsTable.wallowsScore,
        racksInWoodScore: deerAssessmentsTable.racksInWoodScore,
        racksEdgeScore: deerAssessmentsTable.racksEdgeScore,
        barkRemovalScore: deerAssessmentsTable.barkRemovalScore,
        frayingScore: deerAssessmentsTable.frayingScore,
        barkStrippingScore: deerAssessmentsTable.barkStrippingScore,
        brokenStemsScore: deerAssessmentsTable.brokenStemsScore,
        browselineScore: deerAssessmentsTable.browselineScore,
        browsingCoppiceScore: deerAssessmentsTable.browsingCoppiceScore,
        browsingBasalScore: deerAssessmentsTable.browsingBasalScore,
        browsingSaplingsScore: deerAssessmentsTable.browsingSaplingsScore,
        browsingBrambleScore: deerAssessmentsTable.browsingBrambleScore,
        grazingFlora: deerAssessmentsTable.grazingFlora,
        activitySummary: deerAssessmentsTable.activitySummary,
        impactSummary: deerAssessmentsTable.impactSummary,
        activityTrend: deerAssessmentsTable.activityTrend,
        impactTrend: deerAssessmentsTable.impactTrend,
        trendNotes: deerAssessmentsTable.trendNotes,
        comments: deerAssessmentsTable.comments,
        photos: deerAssessmentsTable.photos,
        createdAt: deerAssessmentsTable.createdAt,
        updatedAt: deerAssessmentsTable.updatedAt,
      })
      .from(deerAssessmentsTable)
      .leftJoin(stalkersTable, eq(deerAssessmentsTable.stalkerId, stalkersTable.id))
      .where(eq(deerAssessmentsTable.id, id));
    if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch assessment" });
  }
});

router.put("/assessments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const cleaned = pickAssessmentFields({
      ...req.body,
      date:      req.body.date      ? new Date(req.body.date)      : undefined,
      startedAt: req.body.startedAt ? new Date(req.body.startedAt) : undefined,
      endedAt:   req.body.endedAt   ? new Date(req.body.endedAt)   : undefined,
    });
    const body: Record<string, unknown> = { ...cleaned, updatedAt: new Date() };
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);
    const [updated] = await db
      .update(deerAssessmentsTable)
      .set(body)
      .where(eq(deerAssessmentsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    const [stalker] = updated.stalkerId
      ? await db.select().from(stalkersTable).where(eq(stalkersTable.id, updated.stalkerId))
      : [];
    res.json({ ...updated, stalkerName: stalker?.name ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update assessment" });
  }
});

router.delete("/assessments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [deleted] = await db
      .delete(deerAssessmentsTable)
      .where(eq(deerAssessmentsTable.id, id))
      .returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete assessment" });
  }
});

export default router;
