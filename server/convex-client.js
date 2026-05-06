const { ConvexHttpClient } = require("convex/browser");
const { anyApi } = require("convex/server");

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.VITE_CONVEX_URL ||
    process.env.CONVEX_DEPLOYMENT_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

function createConvexClient() {
  const url = getConvexUrl();
  if (!url) {
    return null;
  }

  return new ConvexHttpClient(url, { logger: false });
}

module.exports = {
  anyApi,
  createConvexClient,
  getConvexUrl,
};
