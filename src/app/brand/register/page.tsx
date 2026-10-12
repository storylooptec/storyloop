import Link from "next/link";
import { registerBrandAction } from "../actions";
import styles from "../brand.module.css";
export default async function RegisterBrandPage({searchParams}:{searchParams:Promise<{error?:string;sent?:string}>}) {
  const query=await searchParams;
  return <main className={styles.publicPage}><section className={styles.hero} style={{gridTemplateColumns:"minmax(0,520px)",justifyContent:"center"}}>
    <div className={styles.loginCard}><Link href="/brand" className={styles.textButton}>← Storyloop for brands</Link>
      <p className={styles.eyebrow}>Get started</p><h1>Create your brand account</h1><p className={styles.loginIntro}>Verify your work email, then set up your campaign workspace.</p>
      {query.sent?<p role="status" className={styles.evidenceNote}>Check your email for a confirmation link. Once verified, sign in to create your workspace.</p>:null}
      {query.error?<p role="alert" className={styles.error}>Check your email and use a password of at least 12 characters. If you already have an account, sign in.</p>:null}
      <form action={registerBrandAction} className={styles.loginForm}>
        <label className={styles.field}>Work email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
        <label className={styles.field}>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
        <button type="submit" className={styles.primaryButton}>Create account</button>
      </form><p className={styles.loginFoot}>Already registered? <Link href="/brand#login">Sign in</Link></p>
    </div></section></main>;
}
