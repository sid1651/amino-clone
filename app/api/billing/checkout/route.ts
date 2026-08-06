import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { z } from "zod";

const checkoutRequest = z.object({ mode: z.enum(["subscription", "token"]) });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ message: "Sign in to purchase Pro or an HD token." }, { status: 401 });
  const parsed = checkoutRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Choose a valid purchase option." }, { status: 400 });
  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = parsed.data.mode === "subscription" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_HD_TOKEN_PRICE_ID;
  const origin = new URL(request.url).origin;
  if (!secret || !priceId) return NextResponse.json({ message: "Billing is not configured for this preview. Editing and 720p export remain free." }, { status: 503 });
  const body = new URLSearchParams({
    mode: parsed.data.mode === "subscription" ? "subscription" : "payment",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    customer_email: user.email,
    client_reference_id: user.email,
    success_url: `${origin}/account?checkout=success`,
    cancel_url: `${origin}/account?checkout=cancelled`,
    "metadata[purchase_mode]": parsed.data.mode,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded" }, body });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) return NextResponse.json({ message: payload.error?.message ?? "Checkout could not be created." }, { status: 502 });
  return NextResponse.json({ url: payload.url });
}

