import type { Metadata } from "next";
import { AccountPage } from "@/components/account/AccountPage";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "@/app/chatgpt-auth";

export const metadata: Metadata = { title: "Account — LumaLoop" };
export const dynamic = "force-dynamic";

export default async function AccountRoute() {
  const user = await getChatGPTUser();
  return <AccountPage user={user ? { displayName: user.displayName, email: user.email } : null} signInPath={chatGPTSignInPath("/account")} signOutPath={chatGPTSignOutPath("/")} />;
}

