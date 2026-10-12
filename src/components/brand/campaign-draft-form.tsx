"use client";
import { useActionState, type ReactNode } from "react";
import { createCampaignDraftAction } from "@/app/brand/campaigns/new/actions";
import styles from "@/app/brand/brand.module.css";
export function CampaignDraftForm({children}:{children:ReactNode}) {
 const [state,action]=useActionState(createCampaignDraftAction,null);
 return <form action={action} className={styles.formWrap}>{state?.error?<p role="alert" className={styles.error}>{state.error}</p>:null}{children}</form>;
}
