import type { Metadata } from "next";
import { EditorApp } from "@/components/editor/EditorApp";
import { getChatGPTUser } from "@/app/chatgpt-auth";

export const metadata: Metadata = { title: "Editor — LumaLoop" };
export const dynamic = "force-dynamic";

export default async function EditorPage() {
  const user = await getChatGPTUser();
  return <EditorApp user={user ? { displayName: user.displayName, email: user.email } : null} />;
}

