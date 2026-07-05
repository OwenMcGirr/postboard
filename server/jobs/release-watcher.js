const { z } = require("zod");
const { anyApi, createConvexClient } = require("../convex-client");
const { listOrgRepos, listRepoReleases, toReleaseCandidate } = require("../github-releases");
const { generateReleasePost } = require("../release-posts");
const { getAccounts, scheduleTextPost } = require("../publer");

function parseBoolean(value, defaultValue = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return defaultValue;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseOrgList(value) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((org) => org.trim())
        .filter(Boolean)
    )
  );
}

function parseAccountMap(value) {
  if (!String(value || "").trim()) {
    return {};
  }

  const parsed = JSON.parse(value);
  const map = {};
  for (const [org, accountIds] of Object.entries(parsed)) {
    map[org.toLowerCase()] = Array.from(
      new Set((Array.isArray(accountIds) ? accountIds : []).map((id) => String(id || "").trim()).filter(Boolean))
    );
  }
  return map;
}

const ConfigSchema = z.object({
  enabled: z.boolean(),
  orgs: z.array(z.string().min(1)).min(1),
  intervalMs: z.number().int().min(60_000),
  postDelayMinutes: z.number().int().min(0).max(1440),
  includePrereleases: z.boolean(),
  baselineOnEmpty: z.boolean(),
  githubToken: z.string(),
  accountMap: z.record(z.string(), z.array(z.string())),
  codexTimeoutMs: z.number().int().min(30_000),
  maxReposPerOrg: z.number().int().min(1).max(500),
  maxReleasesPerRepo: z.number().int().min(1).max(100),
});

function loadConfig(env = process.env) {
  const config = ConfigSchema.parse({
    enabled: parseBoolean(env.RELEASE_WATCH_ENABLED, false),
    orgs: parseOrgList(env.RELEASE_WATCH_ORGS || "timberlogs,switchifyapp"),
    intervalMs: Number(env.RELEASE_WATCH_INTERVAL_MS || 900_000),
    postDelayMinutes: Number(env.RELEASE_POST_DELAY_MINUTES || 10),
    includePrereleases: parseBoolean(env.RELEASE_INCLUDE_PRERELEASES, false),
    baselineOnEmpty: parseBoolean(env.RELEASE_WATCH_BASELINE_ON_EMPTY, true),
    githubToken: String(env.RELEASE_GITHUB_TOKEN || "").trim(),
    accountMap: parseAccountMap(env.RELEASE_POST_ACCOUNT_MAP_JSON),
    codexTimeoutMs: Number(env.RELEASE_CODEX_TIMEOUT_MS || 180_000),
    maxReposPerOrg: Number(env.RELEASE_MAX_REPOS_PER_ORG || 100),
    maxReleasesPerRepo: Number(env.RELEASE_MAX_RELEASES_PER_REPO || 5),
  });

  if (config.enabled && Object.keys(config.accountMap).length === 0) {
    throw new Error("RELEASE_POST_ACCOUNT_MAP_JSON is required when RELEASE_WATCH_ENABLED=true.");
  }

  return config;
}

function now() {
  return Date.now();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function candidateIsEligible(candidate, includePrereleases) {
  if (!candidate.publishedAt) return false;
  if (candidate.draft) return false;
  if (candidate.prerelease && !includePrereleases) return false;
  return true;
}

function releaseForConvex(candidate) {
  return {
    externalId: candidate.externalId,
    org: candidate.org,
    owner: candidate.owner,
    repo: candidate.repo,
    releaseId: candidate.releaseId,
    tagName: candidate.tagName,
    releaseName: candidate.releaseName,
    releaseUrl: candidate.releaseUrl,
    releaseBody: candidate.releaseBody,
    publishedAt: candidate.publishedAt,
  };
}

async function hasBaselineForOrgs(client, orgs) {
  const announcements = await client.query(anyApi.releases.getRecentAnnouncements, { limit: 500 });
  const normalizedOrgs = new Set(orgs.map((org) => org.toLowerCase()));
  return announcements.some((announcement) => normalizedOrgs.has(String(announcement.org || "").toLowerCase()));
}

async function markSkipped(client, announcementId, reason) {
  await client.mutation(anyApi.releases.markAnnouncementSkipped, {
    announcementId,
    reason,
    now: now(),
  });
}

async function markFailed(client, announcementId, error) {
  await client.mutation(anyApi.releases.markAnnouncementFailed, {
    announcementId,
    error: error instanceof Error ? error.message : String(error || "Unknown error"),
    now: now(),
  });
}

async function processCandidate({ client, config, accounts, candidate, baselineMode }) {
  const reservation = await client.mutation(anyApi.releases.reserveAnnouncement, {
    release: releaseForConvex(candidate),
    now: now(),
  });

  if (!reservation.reserved) {
    return { status: "duplicate" };
  }

  if (baselineMode) {
    await markSkipped(client, reservation.id, "initial_baseline");
    return { status: "skipped" };
  }

  const accountIds = config.accountMap[candidate.org.toLowerCase()];
  if (!accountIds || accountIds.length === 0) {
    await markSkipped(client, reservation.id, "missing_account_mapping");
    return { status: "skipped" };
  }

  try {
    const postText = await generateReleasePost({
      release: candidate,
      timeoutMs: config.codexTimeoutMs,
    });
    const scheduledAt = new Date(Date.now() + config.postDelayMinutes * 60 * 1000).toISOString();
    const publerResult = await scheduleTextPost({
      text: postText,
      accountIds,
      scheduledAt,
      accounts,
    });

    await client.mutation(anyApi.releases.markAnnouncementScheduled, {
      announcementId: reservation.id,
      postText,
      publerJobId: String(publerResult.job_id || ""),
      scheduledAt,
      now: now(),
    });

    console.log(
      `[release-watcher] scheduled ${candidate.owner}/${candidate.repo} ${candidate.tagName} job=${publerResult.job_id || "unknown"}`
    );

    return { status: "scheduled" };
  } catch (error) {
    await markFailed(client, reservation.id, error);
    console.error(
      `[release-watcher] failed ${candidate.owner}/${candidate.repo} ${candidate.tagName}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return { status: "failed" };
  }
}

async function runOnce({ config, client }) {
  const startedAt = now();
  const runId = await client.mutation(anyApi.releases.recordWatchRunStarted, {
    orgs: config.orgs,
    startedAt,
  });
  const counts = {
    reposChecked: 0,
    releasesSeen: 0,
    announcementsCreated: 0,
    announcementsSkipped: 0,
    announcementsFailed: 0,
  };

  try {
    const baselineMode = config.baselineOnEmpty && !(await hasBaselineForOrgs(client, config.orgs));
    if (baselineMode) {
      console.log("[release-watcher] baseline mode active; existing releases will be marked skipped");
    }

    const accounts = await getAccounts();

    for (const org of config.orgs) {
      console.log(`[release-watcher] scanning org=${org}`);
      const repos = await listOrgRepos({
        org,
        token: config.githubToken,
        maxRepos: config.maxReposPerOrg,
      });

      for (const repo of repos) {
        counts.reposChecked += 1;
        const releases = await listRepoReleases({
          owner: repo.owner?.login || org,
          repo: repo.name,
          token: config.githubToken,
          perPage: config.maxReleasesPerRepo,
        });

        for (const release of releases) {
          counts.releasesSeen += 1;
          const candidate = toReleaseCandidate({ org, repo, release });
          if (!candidateIsEligible(candidate, config.includePrereleases)) {
            counts.announcementsSkipped += 1;
            continue;
          }

          const result = await processCandidate({
            client,
            config,
            accounts,
            candidate,
            baselineMode,
          });

          if (result.status === "scheduled") counts.announcementsCreated += 1;
          if (result.status === "skipped" || result.status === "duplicate") counts.announcementsSkipped += 1;
          if (result.status === "failed") counts.announcementsFailed += 1;
        }
      }
    }

    await client.mutation(anyApi.releases.recordWatchRunFinished, {
      runId,
      finishedAt: now(),
      status: counts.announcementsFailed > 0 ? "completed_with_failures" : "completed",
      counts,
    });

    console.log(
      `[release-watcher] run complete repos=${counts.reposChecked} releases=${counts.releasesSeen} scheduled=${counts.announcementsCreated} skipped=${counts.announcementsSkipped} failed=${counts.announcementsFailed}`
    );
  } catch (error) {
    await client.mutation(anyApi.releases.recordWatchRunFinished, {
      runId,
      finishedAt: now(),
      status: "failed",
      counts,
      error: error instanceof Error ? error.message : String(error || "Unknown error"),
    });
    throw error;
  }
}

async function main() {
  const config = loadConfig();
  if (!config.enabled) {
    console.log("[release-watcher] disabled; set RELEASE_WATCH_ENABLED=true to start polling");
    setInterval(() => {}, 60 * 60 * 1000);
    await new Promise(() => {});
    return;
  }

  const client = createConvexClient();
  if (!client) {
    throw new Error("Convex is not configured. Set CONVEX_URL and VITE_CONVEX_URL.");
  }

  let stopping = false;
  let running = false;

  async function tick() {
    if (stopping || running) return;
    running = true;
    try {
      await runOnce({ config, client });
    } catch (error) {
      console.error(`[release-watcher] run failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  }

  process.on("SIGTERM", () => {
    stopping = true;
    console.log("[release-watcher] received SIGTERM; stopping after current run");
  });
  process.on("SIGINT", () => {
    stopping = true;
    console.log("[release-watcher] received SIGINT; stopping after current run");
  });

  await tick();
  while (!stopping) {
    await wait(config.intervalMs);
    await tick();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[release-watcher] fatal: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

module.exports = {
  candidateIsEligible,
  loadConfig,
  processCandidate,
  runOnce,
};
