export interface VerifiedLineUser {
  sub: string;
  name?: string;
  picture?: string;
}

export async function verifyLineIdToken(idToken: string): Promise<VerifiedLineUser> {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    throw new Error("Missing LINE_CHANNEL_ID environment variable");
  }

  const body = new URLSearchParams({
    id_token: idToken,
    client_id: channelId,
  });

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Invalid LINE ID Token: ${errText}`);
  }

  const data = (await res.json()) as VerifiedLineUser;
  if (!data.sub) {
    throw new Error("LINE ID Token missing sub (userId)");
  }

  return data;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
