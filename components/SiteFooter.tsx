"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Glyph from "./Glyph";
import { useLive } from "./Live";
import LogoMark from "./LogoMark";
import { MARKS } from "./SocialMarks";
import { DESCRIPTION, phoneHref } from "@/lib/site";

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

  /* The dial and the dock are position:fixed to the viewport corner, so they
     never scroll away — including once the footer scrolls up underneath them.
     Without this, an open dial fan draws its arcs straight over the footer's
     text. Fading them out while the footer is on screen is the fix: nothing
     below the fold needs a way to leave the page it already ends. */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const el = footerRef.current;
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
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  const socials = live?.socials ?? [];

  return (
    <footer className="site-footer" ref={footerRef}>
      <div className="site-footer-grid">
        <div className="site-footer-col site-footer-brand">
          <LogoMark size={44} green="#9fbcac" olive="#c9985a" title="Hotel Thakali Inn" />
          <strong>Hotel Thakali Inn</strong>
          <p>Sinamangal, Kathmandu — five minutes from the airport.</p>
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
                const Icon = MARKS[s.label];
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
  );
}
