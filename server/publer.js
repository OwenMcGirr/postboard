const publerBaseUrl = process.env.PUBLER_API_BASE || "https://app.publer.com/api/v1";

function requireEnv(name, value) {
  if (!value) {
    const err = new Error(`${name} is not configured.`);
    err.status = 500;
    throw err;
  }
}

async function readErrorMessage(response) {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status}`;
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.message === "string") {
      return parsed.message;
    }
    if (parsed && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {}

  return text;
}

async function publerRequest(endpoint, options = {}) {
  const publerToken = process.env.PUBLER_TOKEN || "";
  const publerWorkspaceId = process.env.PUBLER_WORKSPACE_ID || "";

  requireEnv("PUBLER_TOKEN", publerToken);
  requireEnv("PUBLER_WORKSPACE_ID", publerWorkspaceId);

  const { skipContentType = false, headers = {}, ...fetchOptions } = options;
  const requestHeaders = {
    Authorization: `Bearer-API ${publerToken}`,
    "Publer-Workspace-Id": publerWorkspaceId,
    ...headers,
  };

  if (!skipContentType) {
    requestHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(`${publerBaseUrl}${endpoint}`, {
    ...fetchOptions,
    headers: requestHeaders,
  });

  if (!response.ok) {
    const err = new Error(await readErrorMessage(response));
    err.status = response.status;
    throw err;
  }

  return response;
}

async function getAccounts() {
  const response = await publerRequest("/accounts");
  return await response.json();
}

async function scheduleTextPost({ text, accountIds, scheduledAt, accounts }) {
  const selectedAccountIds = Array.from(new Set((accountIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (selectedAccountIds.length === 0) {
    throw new Error("At least one Publer account ID is required.");
  }

  const accountList = Array.isArray(accounts) ? accounts : await getAccounts();
  const selectedAccounts = accountList.filter((account) => selectedAccountIds.includes(account.id));
  const missingIds = selectedAccountIds.filter((id) => !selectedAccounts.some((account) => account.id === id));
  if (missingIds.length > 0) {
    throw new Error(`Publer account IDs were not found: ${missingIds.join(", ")}`);
  }

  const networks = Object.fromEntries(
    [...new Set(selectedAccounts.map((account) => account.provider))].map((provider) => [
      provider,
      { type: "status", text },
    ])
  );

  const response = await publerRequest("/posts/schedule", {
    method: "POST",
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [
          {
            networks,
            accounts: selectedAccountIds.map((id) => ({
              id,
              scheduled_at: scheduledAt,
            })),
          },
        ],
      },
    }),
  });

  return await response.json();
}

module.exports = {
  getAccounts,
  publerRequest,
  readErrorMessage,
  scheduleTextPost,
};
