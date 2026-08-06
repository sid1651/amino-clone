"use client";

import { ArrowLeft, ArrowRight, Check, CreditCard, Download, HelpCircle, KeyRound, LogOut, Mail, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { templateRegistry } from "@/lib/motion/registry";
import Link from "next/link";

type AccountPageProps = {
  user: { displayName: string; email: string } | null;
  signInPath: string;
  signOutPath: string;
};

export function AccountPage({ user, signInPath, signOutPath }: AccountPageProps) {
  const initials = user?.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "G";
  const startCheckout = async (mode: "subscription" | "token") => {
    if (!user) { window.location.href = signInPath; return; }
    const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode }) });
    const payload = await response.json() as { url?: string; message?: string };
    if (payload.url) window.location.href = payload.url;
    else window.alert(payload.message ?? "Checkout is temporarily unavailable.");
  };
  return (
    <div className="account-page">
      <header className="account-header"><Link className="editor-brand" href="/"><span className="brand-mark"><Sparkles size={14} /></span><strong>LumaLoop</strong></Link><Link className="primary-button" href="/editor">Open editor <ArrowRight size={14} /></Link></header>
      <main className="account-main">
        <Link href="/" className="back-link"><ArrowLeft size={14} /> Back to home</Link>
        <div className="account-title"><div><span className="section-kicker">Account</span><h1>Your space, your exports.</h1></div><p>Manage your plan, export access, and support options.</p></div>
        <section className="profile-card">
          <div className="profile-avatar">{initials}</div><div className="profile-copy"><h2>{user?.displayName ?? "Guest creator"}</h2><p>{user?.email ?? "Sign in to sync your plan and HD token balance."}</p></div><span className="plan-status">Free plan</span>
        </section>
        <div className="account-grid">
          <section className="upgrade-account-card"><span className="popular-pill">LumaLoop Pro</span><h2>Export every detail.</h2><p>Move from free 720p to unlimited 1080p, 2K, 4K, and 8K delivery.</p><div className="account-price"><strong>$9</strong><span>/ month</span></div><ul><li><Check />Unlimited HD exports</li><li><Check />All {templateRegistry.length} motion templates</li><li><Check />No watermark, ever</li></ul><button className="primary-button full" onClick={() => void startCheckout("subscription")}>Upgrade to Pro <ArrowRight size={14} /></button><small>Cancel anytime · $90 billed annually also available</small></section>
          <div className="account-side">
            <section className="entitlement-card"><div className="account-card-title"><ShieldCheck size={18} /><div><h3>Export access</h3><p>Server-verified entitlement</p></div></div><dl><div><dt>Plan</dt><dd>Free</dd></div><div><dt>Max resolution</dt><dd>720p</dd></div><div><dt>HD tokens</dt><dd>0</dd></div><div><dt>720p exports</dt><dd>Unlimited</dd></div></dl></section>
            <section className="token-card"><div><KeyRound size={18} /><span><strong>Need just one HD export?</strong><small>Prepaid tokens are available for Indonesian creators.</small></span></div><button className="secondary-button full" onClick={() => void startCheckout("token")}>Buy an HD token</button></section>
          </div>
        </div>
        <section className="account-links"><a href="mailto:hello@lumaloop.studio"><HelpCircle /><span><strong>Get support</strong><small>We usually reply within one business day.</small></span><ArrowRight /></a><a href="mailto:billing@lumaloop.studio"><CreditCard /><span><strong>Billing help</strong><small>Questions about Pro or export tokens.</small></span><ArrowRight /></a><a href="/editor"><Download /><span><strong>Export guide</strong><small>Choose the right format, ratio, and resolution.</small></span><ArrowRight /></a><a href="mailto:privacy@lumaloop.studio"><Mail /><span><strong>Privacy</strong><small>How we keep your source media on-device.</small></span><ArrowRight /></a></section>
        <div className="account-footer-action">{user ? <a href={signOutPath}><LogOut size={14} /> Sign out</a> : <a href={signInPath}><Zap size={14} /> Sign in with ChatGPT</a>}</div>
      </main>
    </div>
  );
}
