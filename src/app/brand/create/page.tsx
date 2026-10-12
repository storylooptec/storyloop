import Link from "next/link";

import { requireBrandContext } from "@/brand/context";
import { BrandShell } from "@/components/brand/brand-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { generateCampaignScriptsAction } from "./actions";
import styles from "../brand.module.css";

type Props = { searchParams: Promise<{ campaign?: string; error?: string; generated?: string }> };
type Concept = { angle: string; hook: string; script: string; cta: string; format: string };

function readConcepts(value: Json): Concept[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const concepts = (value as Record<string, Json>).concepts;
  if (!Array.isArray(concepts)) return [];
  return concepts.filter((item): item is Json & Concept =>
    Boolean(item && typeof item === "object" && !Array.isArray(item)
      && typeof item.angle === "string" && typeof item.hook === "string"
      && typeof item.script === "string" && typeof item.cta === "string" && typeof item.format === "string"),
  );
}
function errorText(value?: string) {
  if (value === "approval") return "Approve the campaign brief before generating scripts.";
  if (value === "provider") return "OpenAI is not configured in this environment.";
  if (value === "limit") return "This campaign reached the AI generation limit for this hour.";
  if (value === "provider_limit") return "The AI provider rate limited this request.";
  if (value === "generation") return "Campaign concepts could not be generated. Try again after checking the approved brief.";
  return "";
}

export default async function BrandCreatePage({ searchParams }: Props) {
  const [{ campaign: selectedId, error, generated }, context] = await Promise.all([searchParams, requireBrandContext()]);
  const supabase = await createServerSupabaseClient();
  const { data: campaigns } = await supabase.from("brand_campaigns")
    .select("id,title,status,objective,deliverables")
    .eq("company_id", context.companyId).order("updated_at", { ascending: false }).limit(10);
  const campaign = selectedId ? campaigns?.find((item) => item.id === selectedId) : campaigns?.find((item) => item.status === "ready_for_desk");
  const { data: plan } = campaign ? await supabase.from("brand_campaign_plans")
    .select("approval_state").eq("campaign_id", campaign.id).eq("company_id", context.companyId).maybeSingle() : { data: null };
  const { data: creatives } = campaign ? await supabase.from("brand_campaign_creatives")
    .select("id,content,created_at").eq("campaign_id", campaign.id).eq("company_id", context.companyId)
    .order("created_at", { ascending: false }).limit(4) : { data: [] };

  return (
    <BrandShell active="Create" companyName={context.companyName} email={context.email}>
      <header>
        <p className={styles.eyebrow}>Campaign workspace · Step 4</p>
        <h1 className={styles.appTitle}>Create campaign content</h1>
        <p className={styles.appCopy}>Generate creator-ready angles, hooks and scripts from the approved brief. Review and refine concepts before any creator preview is requested.</p>
      </header>
      {errorText(error) ? <p className={styles.error} role="alert">{errorText(error)}</p> : null}
      {generated ? <p className={styles.evidenceNote} role="status">Three draft concepts are ready for review.</p> : null}

      {campaign ? (
        <section className={styles.panel} style={{ marginTop: 18 }}>
          <p className={styles.eyebrow}>Selected campaign</p>
          <h2 style={{ margin: 0, fontSize: 19 }}>{campaign.title}</h2>
          <p className={styles.muted}>{campaign.objective} · {campaign.deliverables.join(", ")}</p>
          {plan?.approval_state === "approved" ? (
            <form action={generateCampaignScriptsAction}>
              <input type="hidden" name="campaign_id" value={campaign.id} />
              <button className={styles.primaryButton} type="submit">Generate 3 campaign concepts</button>
            </form>
          ) : (
            <div className={styles.evidenceNote}>Approve the evidence-backed brief before generating campaign scripts. <Link href={"/brand/plan?campaign=" + campaign.id}>Review plan →</Link></div>
          )}

          {creatives?.length ? (
            <div className={styles.campaignList} style={{ marginTop: 20 }}>
              {creatives.map((draft) => (
                <div key={draft.id}>
                  <p className={styles.eyebrow}>Draft set · {new Date(draft.created_at).toLocaleString("en-IN")}</p>
                  <div className={styles.homeGrid}>
                    {readConcepts(draft.content).map((concept, index) => (
                      <article className={styles.panel} key={draft.id + "-" + index}>
                        <span className={styles.statusPill}>{concept.format}</span>
                        <h3 style={{ fontSize: 17 }}>{concept.angle}</h3>
                        <p><strong>Hook:</strong> {concept.hook}</p>
                        <p className={styles.muted}>{concept.script}</p>
                        <p><strong>CTA:</strong> {concept.cta}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <section className={styles.panel} style={{ marginTop: 18 }}>
          <div className={styles.emptyState}>Approve a campaign brief to start generating scripts.</div>
          <Link href="/brand/plan" className={styles.secondaryButton}>Go to Plan →</Link>
        </section>
      )}
      <section className={styles.panel} style={{ marginTop: 18 }}>
        <p className={styles.eyebrow}>Creator approved previews</p>
        <p className={styles.muted}>A creator’s face, voice or likeness will only be used when that creator has explicitly enabled brand requests. The preview request and creator consent gate will be connected after the directory consent workflow is ready.</p>
      </section>
    </BrandShell>
  );
}
