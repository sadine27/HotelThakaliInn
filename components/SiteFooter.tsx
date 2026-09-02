"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Glyph from "./Glyph";
import { useLive } from "./Live";
import LogoMark from "./LogoMark";
import { FacebookMark, InstagramMark } from "./SocialMarks";
import { DESCRIPTION, phoneHref } from "@/lib/site";

const MARK: Record<string, (props: { size?: number }) => React.JSX.Element> = {
  Instagram: InstagramMark,
  Facebook: FacebookMark,
};

/* The close of every public page — the one place a footer belongs and the one
   thing the dial, the dock and the hero never cover: the hotel's mark, how to
   reach it, and the accounts it actually posts from. Same reasoning as
   FloatDock — mounted once in the root layout, absent on /admin.

   Address, phone and email ride in on the live payload rather than a second
   D1 read: /api/live already fetches settings for the coordinates, and this
   is the same object with two more fields on it. */
export default function SiteFooter() {
  const pathname = usePathname();
  const live = useLive();
  const footerRef = useRef<HTMLElement>(null);
  /* Curtain reveal only on the home page — it's the one route whose `main` is
     a single 100svh hero with nothing else in flow, so scrolling past it and
     into the footer is one clean gesture. Every other page is a normal
     scrolling read (rooms, gallery, contact...): pinning the footer there
     would float it over that page's own content instead of closing it. */
  const curtain = pathname === "/";
  /* When curtained, the footer itself is position:fixed (see .site-footer),
     so it always sits inside the viewport rectangle — watching it directly
     would report "visible" from the first paint. This spacer is the in-flow
     stand-in that only enters the viewport once the page has actually
     scrolled far enough to open the curtain, so it's what both the fade and
     the reveal hole measure against. On other pages the footer stays in
     normal flow and is its own IO target, like before. */
  const spacerRef = useRef<HTMLDivElement>(null);

  /* The dial and the dock are position:fixed to the viewport corner, so they
     never scroll away — including once the footer scrolls up underneath them.
     Without this, an open dial fan draws its arcs straight over the footer's
     text. Fading them out while the footer is on screen is the fix: nothing
     below the fold needs a way to leave the page it already ends. */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const el = curtain ? spacerRef.current : footerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) document.documentElement.dataset.footerVisible = "";
        else delete document.documentElement.dataset.footerVisible;
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.footerVisible;
    };
  }, [pathname, curtain]);

  /* Sizes the spacer to the footer's real, responsive height (it changes with
     viewport width and how many social links load in) so the curtain opens
     exactly as far as the footer is tall — never a gap, never a jump. */
  useEffect(() => {
    if (!curtain) return;
    const el = footerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty("--footer-h", `${entry.contentRect.height}px`);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [curtain]);

  if (pathname.startsWith("/admin")) return null;

  const socials = live?.socials ?? [];

  return (
    <>
      {curtain && <div className="site-footer-spacer" ref={spacerRef} aria-hidden="true" />}
      <footer className={`site-footer${curtain ? " site-footer--curtain" : ""}`} ref={footerRef}>
      <div className="site-footer-grid">
        <div className="site-footer-col site-footer-brand">
          <LogoMark size={44} green="#9fbcac" olive="#c9985a" title="Hotel Thakali Inn" />
          <strong>Hotel Thakali Inn</strong>
          <p>Sinamangal, Kathmandu — five minutes from the runway.</p>
        </div>

        <div className="site-footer-col">
          <h2>Contact</h2>
          {live?.address && (
            <p className="site-footer-line">
              <Glyph name="pin" /> {live.address}
            </p>
          )}
          {live?.phone && (
            <p className="site-footer-line">
              <Glyph name="phone" /> <a href={phoneHref(live.phone)}>{live.phone}</a>
            </p>
          )}
          {live?.email && (
            <p className="site-footer-line">
              <Glyph name="mail" /> <a href={`mailto:${live.email}`}>{live.email}</a>
            </p>
          )}
          {socials.length > 0 && (
            <ul className="site-footer-socials">
              {socials.map((s) => {
                const Icon = MARK[s.label];
                return (
                  <li key={s.label}>
                    <a
                      className="site-footer-social-btn"
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                    >
                      {Icon ? <Icon /> : s.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="site-footer-col">
          <h2>Hotel Thakali Inn</h2>
          <p>{DESCRIPTION}</p>
        </div>
      </div>

      <div className="site-footer-bar">
        © {new Date().getFullYear()} Hotel Thakali Inn. All rights reserved. ·{" "}
        <Link href="/contact">Contact</Link>
      </div>
    </footer>
    </>
  );
}
