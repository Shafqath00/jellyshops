import Link from "next/link";
import { geist, geistMono } from "@/features/brand/fonts";
import { MotionProvider } from "@/features/brand/motion";
import { SiteFooter } from "../_home/sections-bottom";
import { SiteHeader } from "../_home/site-header";
import { navigation, type NavItem } from "../home-content";
import { formatLegalDate, LEGAL_UPDATED, LEGAL_VERSION, legalDocuments, type LegalBlock, type LegalDocument } from "./legal-content";
import "@/features/brand/brand.css";
import home from "../home.module.css";
import styles from "./legal.module.css";

/** The home page navigation, with its in-page links ("#pricing") pointed back at the home page. */
function homeLinks(items: readonly NavItem[]): NavItem[] {
  const fix = (href?: string) => (href?.startsWith("#") ? `/${href}` : href);
  return items.map((item) => ({
    ...item,
    href: fix(item.href),
    groups: item.groups?.map((group) => ({ ...group, links: group.links.map((link) => ({ ...link, href: fix(link.href) ?? link.href })) })),
  }));
}

function Block({ block }: { block: LegalBlock }) {
  if ("p" in block) return <p>{block.p}</p>;
  if ("ul" in block) return <ul role="list" className={styles.list}>{block.ul.map((item) => <li key={item}>{item}</li>)}</ul>;
  const { head, rows } = block.table;
  return (
    <div className={styles.tableWrap} role="region" tabIndex={0} aria-label="Table, scrolls sideways on small screens">
      <table className={styles.table}>
        <thead><tr>{head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.join("|")}>{row.map((cell, index) => (index === 0 ? <th key={cell} scope="row">{cell}</th> : <td key={cell}>{cell}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
  const others = Object.values(legalDocuments);
  return (
    <MotionProvider>
      <div data-brand className={`${home.home} ${geist.variable} ${geistMono.variable}`}>
        <a className={home.skip} href="#main">Skip to content</a>
        <SiteHeader items={homeLinks(navigation)} />
        <main id="main" tabIndex={-1} className={home.container}>
          <header className={styles.intro}>
            <p className={home.label}>Legal</p>
            <h1 className={home.h2}>{doc.title}</h1>
            <p>{doc.summary}</p>
            <p className={styles.version}>
              Last updated <time dateTime={LEGAL_UPDATED}>{formatLegalDate(LEGAL_UPDATED)}</time> · Version {LEGAL_VERSION}
            </p>
            <nav aria-label="Legal pages" className={styles.tabs}>
              {others.map((item) => (
                <Link key={item.slug} href={`/legal/${item.slug}`} aria-current={item.slug === doc.slug ? "page" : undefined}>{item.label}</Link>
              ))}
            </nav>
          </header>
          <div className={styles.layout}>
            <nav aria-label="On this page" className={styles.toc}>
              <p className={home.label}>On this page</p>
              <ol role="list">
                {doc.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title.replace(/^\d+\.\s*/, "")}</a></li>)}
              </ol>
            </nav>
            <article className={styles.body}>
              {doc.sections.map((section) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={styles.section}>
                  <h2 id={`${section.id}-title`}>{section.title}</h2>
                  {section.blocks.map((block, index) => <Block key={index} block={block} />)}
                </section>
              ))}
            </article>
          </div>
        </main>
        <SiteFooter base="/" />
      </div>
    </MotionProvider>
  );
}
