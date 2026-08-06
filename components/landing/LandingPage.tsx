"use client";

import { useRef, useState } from "react";
import { AppWindow, ArrowRight, Check, ChevronDown, Clock3, Code2, Layers3, Menu, MousePointer2, Play, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { categoryCounts, categoryLabels, categoryOrder, templateRegistry } from "@/lib/motion/registry";
import { useLandingMotion } from "./useLandingMotion";

const galleryItems = [
  { title: "Orbit Bloom", className: "orbit", hue: "violet" },
  { title: "Hero Reel", className: "reel", hue: "coral" },
  { title: "Iso Focus", className: "iso", hue: "cyan" },
  { title: "Card Toss", className: "toss", hue: "lime" },
  { title: "Grid Reveal", className: "grid", hue: "rose" },
  { title: "Spiral Stream", className: "spiral", hue: "blue" },
];

const faqs = [
  ["Do my images or videos get uploaded?", "No. LumaLoop decodes, previews, and renders your files locally in the browser. Your source media never travels to our servers."],
  ["Can I use every template on the free plan?", `Yes. All ${templateRegistry.length} templates are available to everyone. The free plan includes unlimited editing and 720p exports.`],
  ["Which browsers support export?", "The best experience is in current Chrome and Edge, where WebCodecs provides fast MP4 and WebM encoding. Other browsers receive clear capability guidance."],
  ["Are exports watermarked?", "Never. Free 720p exports and Pro high-resolution exports are clean and ready to share."],
  ["Can I cancel Pro anytime?", "Yes. Monthly and annual plans can be managed from your account. You keep Pro access until the end of the billing period."],
  ["What are HD tokens?", "Creators in Indonesia can buy prepaid tokens instead of subscribing. One token authorizes one completed 1080p-or-higher export."],
];

function Brand() {
  return <span className="landing-brand"><span className="brand-mark"><Sparkles size={15} /></span><strong>LumaLoop</strong></span>;
}

function MiniEditor() {
  return (
    <div className="mini-editor" aria-label="LumaLoop editor preview">
      <div className="mini-top"><Brand /><span className="mini-title">Summer launches</span><span className="mini-export">Export</span></div>
      <div className="mini-body">
        <aside className="mini-templates"><small>Templates</small>{[0, 1, 2, 3, 4, 5].map((index) => <span className={index === 0 ? "active" : ""} key={index}><i /><i /></span>)}</aside>
        <main className="mini-workspace"><div className="mini-canvas">{[0, 1, 2, 3, 4, 5].map((index) => <span key={index} style={{ "--index": index } as React.CSSProperties}><i /></span>)}</div><div className="mini-transport"><Play size={10} fill="currentColor" /><i /><small>0:05</small></div></main>
        <aside className="mini-settings"><small>Customize</small>{["Frame", "Media slots", "Timing", "Background"].map((label, index) => <span key={label}><b>{label}</b><i style={{ width: `${68 - index * 7}%` }} /></span>)}</aside>
      </div>
    </div>
  );
}

export function LandingPage({ user }: { user: { displayName: string } | null }) {
  const [currency, setCurrency] = useState<"USD" | "IDR">("USD");
  const [openFaq, setOpenFaq] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const price = currency === "USD" ? "$9" : "Rp149k";
  const page = useRef<HTMLDivElement>(null);
  useLandingMotion(page);

  return (
    <div className="landing-page" ref={page}>
      <header className="landing-nav">
        <a href="#top" aria-label="LumaLoop home"><Brand /></a>
        <nav className={mobileOpen ? "mobile-open" : ""} aria-label="Primary navigation">
          <a href="#how" onClick={() => setMobileOpen(false)}>How it works</a><a href="#features" onClick={() => setMobileOpen(false)}>Features</a><a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a><a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
        </nav>
        <div className="nav-actions">{user ? <a href="/account" className="nav-account">{user.displayName.slice(0, 1).toUpperCase()}</a> : <a href="/signin-with-chatgpt?return_to=%2F" className="nav-sign-in">Sign in</a>}<a className="nav-editor-button" href="/editor">Open editor <ArrowRight size={13} /></a><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">{mobileOpen ? <X /> : <Menu />}</button></div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-glow one" /><div className="hero-glow two" />
          <div className="credibility-badge"><span className="live-dot" />Browser-only motion studio <span>·</span> No installs</div>
          <h1>Turn static work into<br /><em>motion people notice.</em></h1>
          <p>Drop in your images or clips, choose a professionally choreographed loop, and export a polished showcase in minutes.</p>
          <div className="hero-actions"><a className="hero-cta" href="/editor">Create your first loop <ArrowRight size={16} /></a><a className="text-cta" href="#showcase"><Play size={13} fill="currentColor" /> See what moves</a></div>
          <div className="hero-trust"><span><ShieldCheck size={14} />Your media stays private</span><span><Zap size={14} />Free 720p exports</span><span><AppWindow size={14} />Works in your browser</span></div>
          <div className="hero-editor-wrap"><div className="editor-aura" /><MiniEditor /><div className="floating-label label-one"><Sparkles size={13} />55 motion templates</div><div className="floating-label label-two"><ShieldCheck size={13} />100% local render</div></div>
        </section>

        <section id="showcase" className="showcase-section section-wrap">
          <div className="section-heading split"><div><span className="section-kicker">Made to loop</span><h2>One canvas. Endless energy.</h2></div><p>Every template is crafted for a seamless beginning and end—ideal for product launches, portfolios, socials, and decks.</p></div>
          <div className="showcase-grid">{galleryItems.map((item, index) => <article key={item.title} className={`showcase-card ${item.hue}`}><div className={`showcase-visual ${item.className}`}>{Array.from({ length: item.className === "grid" ? 9 : 7 }, (_, card) => <span key={card} style={{ "--card": card } as React.CSSProperties}><i /></span>)}</div><div><strong>{item.title}</strong><small>{categoryLabels[categoryOrder[index % categoryOrder.length]]}</small></div></article>)}</div>
          <div className="registry-strip"><span>Explore all {templateRegistry.length}</span>{categoryOrder.map((category) => <i key={category}>{categoryLabels[category]} <b>{categoryCounts[category]}</b></i>)}</div>
        </section>

        <section id="how" className="steps-section section-wrap">
          <div className="section-heading centered"><span className="section-kicker">Three steps. Zero keyframes.</span><h2>From folder to motion,<br />without the learning curve.</h2></div>
          <div className="steps-grid">
            <article><span className="step-number">01</span><div className="step-visual choose"><i /><i /><i /></div><h3>Choose a motion</h3><p>Browse {templateRegistry.length} reusable templates—from subtle carousels to cinematic 3D scenes.</p></article>
            <article><span className="step-number">02</span><div className="step-visual add"><i /><i /><i /><MousePointer2 /></div><h3>Add your media</h3><p>Drop local images and video into ordered slots, then rearrange everything in seconds.</p></article>
            <article><span className="step-number">03</span><div className="step-visual export"><span>MP4</span><i /><b><ArrowRight size={15} /></b></div><h3>Tune and export</h3><p>Adjust timing, framing, text, and color. Download a seamless loop when it feels just right.</p></article>
          </div>
        </section>

        <section id="features" className="benefits-section section-wrap">
          <div className="benefits-intro"><span className="section-kicker">More creating. Less setup.</span><h2>The shortcut your<br />static work deserved.</h2><p>Powerful enough for a studio. Fast enough for the idea you need to share before lunch.</p><a href="/editor">Start making <ArrowRight size={14} /></a></div>
          <div className="benefit-grid"><article><AppWindow /><h3>Browser-only</h3><p>No downloads, plugins, or heavyweight render queues.</p></article><article><Clock3 /><h3>Hours saved</h3><p>Skip timelines and keyframes. Start from designed movement.</p></article><article><Layers3 /><h3>Static to story</h3><p>Give screenshots, products, and posters a reason to be watched.</p></article><article><Code2 /><h3>Every platform</h3><p>Switch between five aspect ratios without rebuilding the scene.</p></article></div>
        </section>

        <section className="testimonial-section section-wrap">
          <div className="quote-mark">“</div><blockquote>LumaLoop turned six product screenshots into a launch film before our stand-up ended. It feels like having a motion designer on speed dial.</blockquote><div className="quote-author"><span>AM</span><div><strong>Amara M.</strong><small>Product designer, Kinfield</small></div></div>
        </section>

        <section className="audience-section section-wrap">
          <div className="section-heading centered"><span className="section-kicker">Built for visual storytellers</span><h2>Whatever you’re showing,<br />show it moving.</h2></div>
          <div className="audience-grid">{[["Designers", "Present product work with pace and polish."], ["Creators", "Build thumb-stopping loops for every feed."], ["Marketers", "Launch campaigns without a render backlog."], ["Founders", "Turn your pitch into a product moment."], ["Developers", "Show code, UI, and shipped features in context."], ["Agencies", "Deliver more motion without expanding scope."]].map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p><ArrowRight size={15} /></article>)}</div>
        </section>

        <section id="pricing" className="pricing-section section-wrap">
          <div className="section-heading centered"><span className="section-kicker">Simple pricing</span><h2>Create free. Go crisp when it counts.</h2><p>Every motion template is included from day one.</p><div className="currency-toggle"><button className={currency === "USD" ? "active" : ""} onClick={() => setCurrency("USD")}>USD</button><button className={currency === "IDR" ? "active" : ""} onClick={() => setCurrency("IDR")}>IDR</button></div></div>
          <div className="pricing-grid"><article className="price-card"><span className="price-label">Free</span><h3>$0</h3><p>Make as much as you like.</p><a href="/editor" className="price-button">Start creating</a><ul><li><Check />All {templateRegistry.length} templates</li><li><Check />Unlimited editing</li><li><Check />720p MP4 & WebM</li><li><Check />No watermark</li></ul></article><article className="price-card pro"><span className="popular-pill">Most popular</span><span className="price-label">Pro</span><h3>{price}<small>/ month</small></h3><p>For work that deserves every pixel.</p><a href="/account" className="price-button primary">Upgrade to Pro</a><ul><li><Check />Everything in Free</li><li><Check />1080p, 2K, 4K & 8K</li><li><Check />Unlimited HD exports</li><li><Check />Priority export codecs</li></ul></article></div>
          {currency === "IDR" && <p className="token-note">Prefer prepaid? Creators in Indonesia can purchase single-use HD export tokens from their account.</p>}
        </section>

        <section id="faq" className="faq-section section-wrap">
          <div className="faq-heading"><span className="section-kicker">Questions, answered</span><h2>Good to know.</h2><p>Still curious? <a href="mailto:hello@lumaloop.studio">Talk to us.</a></p></div>
          <div className="faq-list">{faqs.map(([question, answer], index) => <article key={question} className={openFaq === index ? "open" : ""}><button onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}><span>{question}</span><ChevronDown size={17} /></button>{openFaq === index && <p>{answer}</p>}</article>)}</div>
        </section>

        <section className="final-cta section-wrap"><div className="cta-orbit"><i /><i /><i /><i /><i /></div><span className="section-kicker">Your work is ready to move</span><h2>Make the scroll stop.</h2><p>Open the editor, add your media, and leave with a loop worth watching.</p><a href="/editor">Create a loop — it’s free <ArrowRight size={16} /></a></section>
      </main>

      <footer className="landing-footer section-wrap"><div><Brand /><p>Motion showcases, made in your browser.</p></div><div><strong>Product</strong><a href="#how">How it works</a><a href="#features">Features</a><a href="#pricing">Pricing</a></div><div><strong>Company</strong><a href="mailto:hello@lumaloop.studio">Contact</a><a href="#faq">FAQ</a><a href="/account">Account</a></div><div><strong>Legal</strong><a href="#privacy">Privacy</a><a href="#terms">Terms</a></div><small>© 2026 LumaLoop Studio. Built to move.</small></footer>
    </div>
  );
}
