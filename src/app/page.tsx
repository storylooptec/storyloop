import type { Metadata } from "next";
import Link from "next/link";
import { HomeWordmark } from "@/components/home/home-wordmark";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "Storyloop — Where creators and brands come together",
  description: "Your next story starts here. Join Storyloop as a creator, build your next brand campaign, or access the Storyloop team workspace.",
};

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
  </svg>;
}

function RoleIcon({ kind }: { kind: "creator" | "brand" | "admin" }) {
  return <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "creator" ? <><rect x="4" y="8" width="20" height="15" rx="3" /><path d="m9 8 2-3h6l2 3" /><circle cx="14" cy="15.5" r="4" /></>
      : kind === "brand" ? <><rect x="4" y="8" width="20" height="16" rx="3" /><path d="M10 8V5h8v3M4 14c6 4 14 4 20 0M12 16h4v3h-4z" /></>
        : <><rect x="6" y="12" width="16" height="12" rx="2" /><path d="M9 12V8a5 5 0 0 1 10 0v4M14 17v3" /></>}
  </svg>;
}

const steps = [
  { number: "01", title: "Show what you bring.", copy: "Creators share their profile and rates. Brands bring their campaign goals." },
  { number: "02", title: "Find the right fit.", copy: "Build a creator shortlist around the audience, the idea and the budget." },
  { number: "03", title: "Create with clarity.", copy: "Align on the brief and deliverables before the work begins." },
];

export default function HomePage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link href="/" aria-label="Storyloop home" className={styles.logoLink}><HomeWordmark /></Link>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <Link href="/creator" prefetch={false}>For creators</Link>
          <Link href="/brand" prefetch={false}>For brands</Link>
          <a href="#how-it-works" className={styles.howLink}>How it works</a>
        </nav>
        <Link href="/admin" prefetch={false} className={styles.adminNav}>Admin <Arrow diagonal /></Link>
      </header>
      <main id="main" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroHeading}>
            <p className={styles.eyebrow}>Creators meet brands. Stories happen.</p>
            <h1 id="home-title">Good stories.<br /><span>Great partnerships.</span></h1>
          </div>
          <div className={styles.heroAside}>
            <p>A space for original voices<br className={styles.desktopBreak} /> and brands with a story to tell.</p>
            <a href="#choose-your-space" className={styles.startLink}>Find your place in Storyloop <span aria-hidden="true">↓</span></a>
          </div>
        </section>
        <section id="choose-your-space" className={styles.spaces} aria-labelledby="spaces-title">
          <div className={styles.sectionHeading}>
            <h2 id="spaces-title">Two sides. One great story.</h2>
            <span className={styles.sectionLabel}>Choose your space</span>
          </div>
          <div className={styles.spaceGrid}>
            <Link href="/creator" prefetch={false} className={`${styles.space} ${styles.creatorSpace}`} aria-labelledby="creator-title creator-cta" aria-describedby="creator-description">
              <div className={styles.spaceTop}><span className={styles.spaceLabel}>The creator side</span><RoleIcon kind="creator" /></div>
              <div className={styles.spaceContent}>
                <h3 id="creator-title">Your voice.<br />Your next chapter.</h3>
                <p id="creator-description">Bring your talent, share your rates and explore your next brand collaboration.</p>
              </div>
              <div className={styles.spaceBottom}><span id="creator-cta">I&apos;m a creator</span><span className={styles.arrowCircle}><Arrow diagonal /></span></div>
            </Link>
            <Link href="/brand" prefetch={false} className={`${styles.space} ${styles.brandSpace}`} aria-labelledby="brand-title brand-cta" aria-describedby="brand-description">
              <div className={styles.spaceTop}><span className={styles.spaceLabel}>The brand side</span><RoleIcon kind="brand" /></div>
              <div className={styles.spaceContent}>
                <h3 id="brand-title">Your brand.<br />A fresh perspective.</h3>
                <p id="brand-description">Find your creator mix, shape the brief and turn a campaign idea into a plan.</p>
              </div>
              <div className={styles.spaceBottom}><span id="brand-cta">I&apos;m a brand</span><span className={styles.arrowCircle}><Arrow diagonal /></span></div>
            </Link>
          </div>
        </section>
        <section id="how-it-works" className={styles.process} aria-labelledby="process-title">
          <div className={styles.processIntro}>
            <p className={styles.eyebrow}>A little clarity. A lot of possibility.</p>
            <h2 id="process-title">Good work starts<br />with a real connection.</h2>
          </div>
          <ol className={styles.steps}>
            {steps.map(step => <li key={step.number}>
              <span className={styles.stepNumber} aria-hidden="true">{step.number}</span>
              <div><h3>{step.title}</h3><p>{step.copy}</p></div>
            </li>)}
          </ol>
        </section>
        <aside className={styles.team} aria-labelledby="team-title">
          <div className={styles.teamIcon}><RoleIcon kind="admin" /></div>
          <div className={styles.teamCopy}><p className={styles.sectionLabel}>For the Storyloop team</p><h2 id="team-title">Keep the work moving.</h2><p>Manage creators, brands and campaigns from the admin workspace.</p></div>
          <Link href="/admin" prefetch={false} className={styles.teamLink}>Open Admin <Arrow /><span className={styles.teamAccess}>Authorised team access</span></Link>
        </aside>
      </main>
      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand} aria-label="Storyloop home">Storyloop<span aria-hidden="true">.</span></Link>
        <p>Original voices. Shared possibilities.</p>
        <span>© 2026 Storyloop</span>
      </footer>
    </div>
  );
}
