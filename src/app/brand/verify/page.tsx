import Link from "next/link";

import { verifyBrandEmailCodeAction } from "../actions";
import styles from "../brand.module.css";

type Props = {
  searchParams: Promise<{ email?: string; error?: string; sent?: string }>;
};

export default async function BrandVerifyPage({ searchParams }: Props) {
  const { email = "", error, sent } = await searchParams;
  const normalizedEmail = email.trim().toLowerCase();

  return (
    <main className={styles.publicPage}>
      <header className={styles.brandHeader}>
        <Link href="/brand" className={styles.logoLockup}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.brandLogoImage} src="/api/brand/logo?slot=light&public=1" alt="Storyloop" />
        </Link>
        <Link href="/brand" className={styles.textButton}>Back to brand homepage</Link>
      </header>
      <section className={styles.hero} style={{ gridTemplateColumns: "minmax(0, 520px)", justifyContent: "center" }}>
        <div className={styles.loginCard}>
          <p className={styles.eyebrow}>Brand workspace sign in</p>
          <h2>Check your email</h2>
          <p className={styles.loginIntro}>Enter the six-digit code sent to {normalizedEmail || "your work email"}.</p>
          {sent ? <p className={styles.evidenceNote} role="status">If this email is registered, a sign-in code has been sent.</p> : null}
          {error ? <p className={styles.error} role="alert">That code could not be verified. Check it and try again.</p> : null}
          <form action={verifyBrandEmailCodeAction} className={styles.loginForm}>
            <input type="hidden" name="email" value={normalizedEmail} />
            <label className={styles.field}>
              Email verification code
              <input name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required />
            </label>
            <button className={styles.primaryButton} type="submit">Verify and continue</button>
          </form>
          <p className={styles.loginFoot}><Link href="/brand#login">Use a different sign-in method</Link></p>
        </div>
      </section>
    </main>
  );
}
