import Link from "next/link";

import { BrandWordmark } from "@/components/brand/brand-wordmark";
import { sendBrandEmailCodeAction, signInBrandAction } from "./actions";
import styles from "./brand.module.css";

type Props = {
  searchParams: Promise<{ error?: string; sent?: string }>;
};

function errorMessage(error?: string) {
  switch (error) {
    case "missing": return "Enter a valid work email and complete the selected sign-in method.";
    case "credentials": return "We couldn’t sign you in. Check your details and try again.";
    case "access": return "This account does not have an active brand workspace yet. Contact your Storyloop representative.";
    case "code": return "We couldn’t send or verify that code. Try again.";
    case "login": return "Sign in to open your brand workspace.";
    default: return "";
  }
}

export default async function BrandLandingPage({ searchParams }: Props) {
  const { error, sent } = await searchParams;

  return (
    <main className={styles.publicPage}>
      <header className={`${styles.brandHeader} ${styles.landingHeader}`}>
        <div className={styles.headerIdentity}>
          <Link href="/" className={styles.logoLockup} aria-label="Storyloop home">
            <BrandWordmark />
          </Link>
          <Link href="/" className={styles.homeLink}><span aria-hidden="true">←</span> Home</Link>
        </div>
        <nav className={styles.publicNav} aria-label="Main navigation">
          <a href="#for-brands">For brands</a>
          <a href="#how-it-works">How it works</a>
          <a href="#platform">Platform</a>
          <a href="#about">About</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.textButton} href="#login">Sign in</a>
          <a className={styles.outlineButton} href="/brand/register">Create account</a>
        </div>
      </header>

      <section id="for-brands" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Storyloop for brands</p>
          <h1 className={styles.heroTitle}>Creator campaigns, built on real market signals.</h1>
          <p className={styles.heroText}>
            Scan your market, shape an evidence-backed brief, find the right creators, and track what your campaign delivers.
          </p>

          <div id="how-it-works" className={styles.steps} aria-label="Campaign workflow">
            <div className={styles.step}><span className={styles.stepIcon}>⌕</span><strong>Discover</strong><span>Find market signals and creators</span></div>
            <div className={styles.step}><span className={styles.stepIcon}>▤</span><strong>Plan</strong><span>Build the brief, creator mix and budget</span></div>
            <div className={styles.step}><span className={styles.stepIcon}>✳</span><strong>Create</strong><span>Develop campaign angles and scripts</span></div>
            <div className={styles.step}><span className={styles.stepIcon}>▥</span><strong>Reports</strong><span>Track results after launch</span></div>
          </div>

          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href="/brand/register">Start a campaign <span aria-hidden="true">→</span></a>
            <a className={styles.textButton} href="#platform">See how it works</a>
          </div>

          <section id="platform" className={styles.evidencePreview} aria-label="Evidence preview example">
            <div className={styles.evidenceHead}>
              <strong>Evidence preview</strong>
              <span className={styles.exampleTag}>Example layout</span>
            </div>
            <div className={styles.skeletonLine} aria-hidden="true" />
            <div className={styles.skeletonLine + " " + styles.skeletonLineShort} aria-hidden="true" />
            <p className={styles.evidenceNote}>A dated observation with its source appears here after a scan.</p>
          </section>
        </div>

        <aside id="login" className={styles.loginCard} aria-labelledby="brand-login-title">
          <h2 id="brand-login-title">Welcome back</h2>
          <p className={styles.loginIntro}>Sign in to your brand workspace.</p>
          {sent ? <p className={styles.evidenceNote} role="status">A sign-in code has been sent if this email is registered.</p> : null}
          {error ? <p className={styles.error} role="alert">{errorMessage(error)}</p> : null}
          <form action={signInBrandAction} className={styles.loginForm}>
            <label className={styles.field}>
              Work email
              <input type="email" name="email" autoComplete="email" placeholder="name@yourcompany.com" required />
            </label>
            <label className={styles.field}>
              <span className={styles.passwordRow}><span>Password</span><a href="#email-code">Use a code instead</a></span>
              <input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required />
            </label>
            <button className={styles.primaryButton} type="submit">Sign in</button>
            <div id="email-code" className={styles.loginForm}>
              <span className={styles.muted}>Or sign in without a password</span>
              <button className={styles.secondaryButton} type="submit" formAction={sendBrandEmailCodeAction} formNoValidate>Continue with email code</button>
            </div>
          </form>
          <p className={styles.loginFoot}>New to Storyloop? <Link href="/brand/register">Create your account</Link></p>
        </aside>
      </section>

      <section id="about" className={styles.featureStrip} aria-label="Brand workspace features">
        <article className={styles.feature}><span className={styles.featureIcon}>⌕</span><div><strong>Competitor evidence</strong><p>Dated observations with source links.</p></div></article>
        <article className={styles.feature}><span className={styles.featureIcon}>◎</span><div><strong>Creator planning</strong><p>Compare the requested mix against Storyloop campaign history.</p></div></article>
        <article className={styles.feature}><span className={styles.featureIcon}>▥</span><div><strong>Campaign reporting</strong><p>Track campaign results after launch.</p></div></article>
      </section>
    </main>
  );
}
