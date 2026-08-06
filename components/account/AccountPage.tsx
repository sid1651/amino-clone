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
  // Billing removed: all features are free in this build.
  const startCheckout = async (_mode: "subscription" | "token") => {
    if (!user) { window.location.href = signInPath; return; }
    window.alert("Billing is disabled — all features are free.");
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
          <section className="upgrade-account-card"><h2>All features free</h2><p>High-resolution exports and all motion templates are available without purchase in this distribution.</p><ul><li><Check />All {templateRegistry.length} motion templates</li><li><Check />HD exports available</li><li><Check />No watermark</li></ul></section>
          <div className="account-side">
            <section className="entitlement-card"><div className="account-card-title"><ShieldCheck size={18} /><div><h3>Export access</h3><p>Server-verified entitlement</p></div></div><dl><div><dt>Plan</dt><dd>Free</dd></div><div><dt>Max resolution</dt><dd>Unlimited</dd></div><div><dt>HD tokens</dt><dd>—</dd></div><div><dt>720p exports</dt><dd>Unlimited</dd></div></dl></section>
          </div>
        </div>
        <section className="account-links"><a href="mailto:hello@lumaloop.studio"><HelpCircle /><span><strong>Get support</strong><small>We usually reply within one business day.</small></span><ArrowRight /></a><a href="/editor"><Download /><span><strong>Export guide</strong><small>Choose the right format, ratio, and resolution.</small></span><ArrowRight /></a><a href="mailto:privacy@lumaloop.studio"><Mail /><span><strong>Privacy</strong><small>How we keep your source media on-device.</small></span><ArrowRight /></a></section>
        <div className="account-footer-action">{user ? <a href={signOutPath}><LogOut size={14} /> Sign out</a> : <a href={signInPath}><Zap size={14} /> Sign in with ChatGPT</a>}</div>
      </main>
    </div>
  );
}
