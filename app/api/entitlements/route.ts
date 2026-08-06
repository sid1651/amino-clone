import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export async function GET() {
  const user = await getChatGPTUser();
  const entitlement = { subject: user?.email ?? "anonymous", plan: "free", maxResolution: "720p", hdTokens: 0, issuedAt: Date.now() } as const;
  const secret = process.env.ENTITLEMENT_SIGNING_SECRET ?? "local-preview-only";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(entitlement)));
  const signature = toBase64Url(new Uint8Array(signed));
  return NextResponse.json({ entitlement, signature }, { headers: { "cache-control": "private, no-store" } });
}
