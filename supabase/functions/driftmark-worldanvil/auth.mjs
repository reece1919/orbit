import { OWNER } from "./core.mjs";

export function createAuthorize(client) {
  return async function authorize(header) {
    if (!/^Bearer\s+[A-Za-z0-9._-]+$/.test(header)) return null;
    const token = header.replace(/^Bearer\s+/, "");
    // Auth validates this exact JWT, including its signature and expiry, before
    // its assurance claim is inspected. An API key alone is never sufficient.
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.id !== OWNER) return null;
    try {
      const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const claims = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
      if (claims.sub !== data.user.id || claims.aal !== "aal2") return null;
      return { id: data.user.id, aal: claims.aal };
    } catch { return null; }
  };
}
