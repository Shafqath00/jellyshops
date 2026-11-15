import type { Metadata } from "next";
import { geist, geistMono } from "@/features/brand/fonts";
import { MotionProvider } from "@/features/brand/motion";
import { SiteFooter } from "../_home/sections-bottom";
import { SiteHeader } from "../_home/site-header";
import { navigation, type NavItem } from "../home-content";
import { changelog, formatChangelogDate } from "./changelog-content";
import "@/features/brand/brand.css";
import home from "../home.module.css";
import styles from "./changelog.module.css";

export const metadata: Metadata = {
  title: "Changelog | Jellyshop",
  description: "What is new in Jellyshop: the latest features for your store, your dashboard and your shoppers.",
};

/** The home page navigation, with its in-page links ("#pricing") pointed back at the home page. */
function homeLinks(items: readonly NavItem[]): NavItem[] {
  const fix = (href?: string) => (href?.startsWith("#") ? `/${href}` : href);
  return items.map((item) => ({
    ...item,
    href: fix(item.href),
    groups: item.groups?.map((group) => ({ ...group, links: group.links.map((link) => ({ ...link, href: fix(link.href) ?? link.href })) })),
  }));
}

export default function ChangelogPage() {
  return (
    <MotionProvider>
      <div data-brand className={`${home.home} ${geist.variable} ${geistMono.variable}`}>
        <a className={home.skip} href="#main">Skip to content</a>
        <SiteHeader items={homeLinks(navigation)} />
        <main id="main" tabIndex={-1} className={home.container}>
          <header className={styles.intro}>
            <p className={home.label}>Changelog</p>
            <h1 className={home.h2}>What&apos;s new in Jellyshop</h1>
            <p>New features for your store, your dashboard and your shoppers, newest first.</p>
          </header>
          <ol role="list" className={styles.list}>
            {changelog.map((entry) => (
              <li key={entry.date + entry.title}>
                <article className={styles.entry} aria-labelledby={`entry-${entry.date}`}>
                  <div className={styles.meta}>
                    <time dateTime={entry.date}>{formatChangelogDate(entry.date)}</time>
                    <span className={styles.areas}>{entry.areas.map((area) => <em key={area} className={home.soon}>{area}</em>)}</span>
                  </div>
                  <div className={styles.body}>
                    <h2 id={`entry-${entry.date}`}>{entry.title}</h2>
                    <p>{entry.summary}</p>
                    <ul role="list" className={styles.points}>
                      {entry.points.map((point) => <li key={point}>{point}</li>)}
                    </ul>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </main>
        <SiteFooter base="/" />
      </div>
    </MotionProvider>
  );
}
