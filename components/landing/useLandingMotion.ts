"use client";

import { useEffect, type RefObject } from "react";

/**
 * GSAP motion for the marketing page.
 *
 * Two deliberate choices keep this safe:
 *  - Elements are hidden with `gsap.set` inside the same block that animates
 *    them, so the page stays fully readable if the bundle never loads.
 *  - Entrances animate with `to` rather than `from`. A `from` tween that gets
 *    killed mid-flight (React's double-mount, a reverted context) can strand an
 *    element at opacity 0; a `to` tween always resolves toward visible.
 */
export function useLandingMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup = () => {};
    let cancelled = false;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      // Entrance and reveal tweens, so they can be snapped to their end state
      // if the page is not visible — a background tab throttles rAF, which
      // would otherwise strand content part-way through a fade.
      const settleable: gsap.core.Animation[] = [];
      const settleAll = () => settleable.forEach((animation) => animation.progress(1));
      const onVisibility = () => { if (document.visibilityState === "hidden") settleAll(); };

      const context = gsap.context(() => {
        const q = (selector: string) => gsap.utils.toArray<HTMLElement>(selector);
        const hidden = (selector: string, vars: gsap.TweenVars) => {
          const targets = q(selector);
          if (targets.length > 0) gsap.set(targets, { opacity: 0, ...vars });
          return targets;
        };

        /* ---- Hero entrance ------------------------------------------------ */
        hidden(".credibility-badge", { y: 18 });
        hidden(".hero-section h1", { y: 44 });
        hidden(".hero-section > p", { y: 24 });
        hidden(".hero-actions > *", { y: 20 });
        hidden(".hero-trust span", { y: 14 });
        hidden(".mini-editor", { y: 90, rotateX: 22, scale: 0.94, transformOrigin: "50% 0%" });
        hidden(".editor-aura", { scale: 0.7 });
        hidden(".floating-label", { y: 26, scale: 0.85 });
        hidden(".mini-canvas > span", { scale: 0.4 });

        const hero = gsap.timeline({ defaults: { ease: "power3.out", opacity: 1 } });
        hero
          .to(".credibility-badge", { y: 0, duration: 0.6 })
          .to(".hero-section h1", { y: 0, duration: 0.95 }, "-=0.35")
          .to(".hero-section > p", { y: 0, duration: 0.7 }, "-=0.6")
          .to(".hero-actions > *", { y: 0, duration: 0.6, stagger: 0.09 }, "-=0.45")
          .to(".hero-trust span", { y: 0, duration: 0.5, stagger: 0.07 }, "-=0.4")
          .to(".mini-editor", { y: 0, rotateX: 4, scale: 1, duration: 1.15 }, "-=0.35")
          .to(".editor-aura", { scale: 1, duration: 1 }, "<")
          .to(".floating-label", { y: 0, scale: 1, duration: 0.6, stagger: 0.12 }, "-=0.5")
          .to(".mini-canvas > span", { scale: 1, duration: 0.55, stagger: 0.05, ease: "back.out(1.7)" }, "-=0.7");

        settleable.push(hero);

        /* ---- Ambient loops ------------------------------------------------ */
        gsap.to(".hero-glow.one", { x: 90, y: -50, duration: 13, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hero-glow.two", { x: -80, y: 60, duration: 16, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".floating-label", { y: -9, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.5, delay: 2.2 });

        /* ---- Hero mock settles as you scroll ------------------------------ */
        gsap.to(".mini-editor", {
          rotateX: 0,
          rotateZ: 0,
          scale: 1.03,
          ease: "none",
          scrollTrigger: { trigger: ".hero-editor-wrap", start: "top 70%", end: "bottom 40%", scrub: 0.6 },
        });

        /* ---- Scroll reveals ------------------------------------------------ */
        const revealOnScroll = (targets: HTMLElement[], from: gsap.TweenVars, to: gsap.TweenVars = {}) => {
          targets.forEach((element) => {
            gsap.set(element, { opacity: 0, ...from });
            settleable.push(gsap.to(element, {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: { trigger: element, start: "top 88%", once: true },
              ...to,
            }));
          });
        };

        revealOnScroll(q(".section-heading, .benefits-intro, .faq-heading"), { y: 34 });
        revealOnScroll(q(".registry-strip"), { y: 20 }, { duration: 0.6 });
        revealOnScroll(q(".testimonial-section blockquote"), { y: 30 }, { duration: 0.9 });
        revealOnScroll(q(".quote-mark"), { scale: 0.5 }, { duration: 0.7, ease: "back.out(2)" });
        revealOnScroll(q(".quote-author"), { y: 18 }, { duration: 0.6 });
        revealOnScroll(q(".final-cta > *:not(.cta-orbit)"), { y: 30 }, { stagger: 0.08 });

        // Grids animate as a group so the stagger reads across the row.
        const grids: [string, string][] = [
          [".showcase-grid", ".showcase-card"],
          [".steps-grid", "article"],
          [".benefit-grid", "article"],
          [".audience-grid", "article"],
          [".pricing-grid", ".price-card"],
          [".faq-list", "article"],
          [".landing-footer", "div"],
        ];
        grids.forEach(([container, child]) => {
          q(container).forEach((element) => {
            const children = Array.from(element.querySelectorAll<HTMLElement>(child));
            if (children.length === 0) return;
            gsap.set(children, { opacity: 0, y: 42 });
            settleable.push(gsap.to(children, {
              opacity: 1,
              y: 0,
              duration: 0.75,
              ease: "power3.out",
              stagger: 0.08,
              scrollTrigger: { trigger: element, start: "top 85%", once: true },
            }));
          });
        });

        q(".step-visual").forEach((visual) => {
          const parts = Array.from(visual.children) as HTMLElement[];
          if (parts.length === 0) return;
          gsap.set(parts, { opacity: 0, y: 26, scale: 0.88 });
          settleable.push(gsap.to(parts, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            ease: "back.out(1.6)",
            stagger: 0.08,
            scrollTrigger: { trigger: visual, start: "top 85%", once: true },
          }));
        });

        /* ---- Parallax accents ---------------------------------------------- */
        q(".cta-orbit i").forEach((card, index) => {
          gsap.to(card, {
            y: index % 2 === 0 ? -70 : 70,
            rotate: index % 2 === 0 ? 8 : -8,
            ease: "none",
            scrollTrigger: { trigger: ".final-cta", start: "top bottom", end: "bottom top", scrub: 0.8 },
          });
        });

        /* ---- Nav condenses past the hero ------------------------------------ */
        gsap.to(".landing-nav", {
          backgroundColor: "rgba(8,9,13,.94)",
          borderBottomColor: "rgba(255,255,255,.10)",
          duration: 0.3,
          scrollTrigger: { trigger: ".hero-section", start: "top+=90 top", toggleActions: "play none none reverse" },
        });

        ScrollTrigger.refresh();
      }, scope);

      if (document.visibilityState === "hidden") settleAll();
      document.addEventListener("visibilitychange", onVisibility);

      cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        context.revert();
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [root]);
}
