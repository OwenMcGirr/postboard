export const config = { matcher: ["/((?!_next).*)"] };

export default function middleware(req: Request): Response | undefined {
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!password) return undefined;

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === password) return undefined;
    }
  }

  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Postboard"' },
  });
}
