import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createBrandWorkspaceAction,signOutBrandAction } from "../actions";
import styles from "../brand.module.css";
export default async function BrandSetupPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const db=await createServerSupabaseClient();const {data:{user}}=await db.auth.getUser();
  if(!user)redirect("/brand?error=login");
  const {data:membership}=await db.from("brand_memberships").select("company_id,status").eq("user_id",user.id).limit(1).maybeSingle();
  if(membership?.status==='active')redirect('/brand/home');
  const {error}=await searchParams;
  return <main className={styles.publicPage}><section className={styles.hero} style={{gridTemplateColumns:"minmax(0,520px)",justifyContent:"center"}}><div className={styles.loginCard}>
    <p className={styles.eyebrow}>Welcome to Storyloop</p><h1>Your brand workspace</h1><p className={styles.loginIntro}>Signed in as {user.email}. Start with your company name; campaign details come next.</p>
    {error?<p className={styles.error} role="alert">The workspace could not be created. Verify your email and try again.</p>:null}
    {membership?<p className={styles.error}>Your workspace access is inactive. Contact your Storyloop representative.</p>:<form action={createBrandWorkspaceAction} className={styles.loginForm}>
      <label className={styles.field}>Company name<input name="workspace_name" required minLength={2} maxLength={120} autoComplete="organization"/></label>
      <button className={styles.primaryButton} type="submit">Create workspace →</button></form>}
    <form action={signOutBrandAction}><button className={styles.textButton}>Sign out</button></form>
  </div></section></main>;
}
