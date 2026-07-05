const GITHUB_API_BASE = "https://api.github.com";

function buildHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "postboard-release-watcher",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getNextLink(linkHeader) {
  const header = String(linkHeader || "");
  const next = header
    .split(",")
    .map((part) => part.trim())
    .find((part) => /rel="next"/.test(part));
  const match = next?.match(/<([^>]+)>/);
  return match?.[1] || "";
}

async function githubRequest(url, token) {
  const response = await fetch(url, {
    headers: buildHeaders(token),
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 403) {
    const text = await response.text();
    const err = new Error(`GitHub API rate limit or permission error: ${text || "HTTP 403"}`);
    err.status = 403;
    throw err;
  }

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`GitHub API error ${response.status}: ${text || response.statusText}`);
    err.status = response.status;
    throw err;
  }

  return response;
}

async function listOrgRepos({ org, token, maxRepos = 100 }) {
  const repos = [];
  let url = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(org)}/repos?type=all&sort=updated&per_page=100`;

  while (url && repos.length < maxRepos) {
    const response = await githubRequest(url, token);
    if (!response) {
      return repos;
    }

    const pageRepos = await response.json();
    for (const repo of Array.isArray(pageRepos) ? pageRepos : []) {
      if (repos.length >= maxRepos) break;
      if (repo?.archived) continue;
      repos.push(repo);
    }

    url = getNextLink(response.headers.get("link"));
  }

  return repos;
}

async function listRepoReleases({ owner, repo, token, perPage = 5 }) {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}/releases?per_page=${encodeURIComponent(String(perPage))}`;
  const response = await githubRequest(url, token);
  if (!response) {
    return [];
  }

  const releases = await response.json();
  return Array.isArray(releases) ? releases : [];
}

function toReleaseCandidate({ org, repo, release }) {
  const owner = repo.owner?.login || org;
  const repoName = repo.name;
  const releaseId = Number(release.id);

  return {
    externalId: `github:${owner}/${repoName}:release:${releaseId}`,
    org,
    owner,
    repo: repoName,
    repoFullName: repo.full_name || `${owner}/${repoName}`,
    repoDescription: repo.description || "",
    repoUrl: repo.html_url || `https://github.com/${owner}/${repoName}`,
    releaseId,
    tagName: String(release.tag_name || ""),
    releaseName: String(release.name || release.tag_name || ""),
    releaseUrl: String(release.html_url || ""),
    releaseBody: typeof release.body === "string" && release.body.trim() ? release.body.trim() : undefined,
    publishedAt: String(release.published_at || ""),
    draft: Boolean(release.draft),
    prerelease: Boolean(release.prerelease),
  };
}

module.exports = {
  listOrgRepos,
  listRepoReleases,
  toReleaseCandidate,
};
