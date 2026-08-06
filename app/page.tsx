import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { getChatGPTUser } from "./chatgpt-auth";

export const metadata: Metadata = {
  title: "LumaLoop — Turn static work into motion",
  description: "Create polished motion showcase loops from local images and videos, right in your browser.",
};
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <LandingPage user={user ? { displayName: user.displayName } : null} />;
}

