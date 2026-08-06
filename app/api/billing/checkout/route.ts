import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { z } from "zod";

const checkoutRequest = z.object({ mode: z.enum(["subscription", "token"]) });

export async function POST(request: Request) {
  // Billing and checkout have been disabled — this distribution is free to use.
  return NextResponse.json({ message: "Billing is disabled: all features are free in this build." }, { status: 404 });
}

