"use client";

import { useActionState, useEffect, useState } from "react";
import type { SearchApiTestResult } from "@/lib/providers/searchapi-test";
import { testSearchApiAction } from "./searchapi-test-action";
import brand from "../../../brand.module.css";
import styles from "./searchapi-test.module.css";

export function SearchApiTestPanel() {
  const [result, submit, pending] = useActionState<SearchApiTestResult | null, FormData>(
    async () => testSearchApiAction(), null,
  );
  const [cooling, setCooling] = useState(false);
  useEffect(() => {
    const delay = (result?.retryAt ?? 0) - Date.now();
    if (delay <= 0) return;
    const start = setTimeout(() => setCooling(true), 0);
    const end = setTimeout(() => setCooling(false), delay);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [result]);

  return <section className={`${brand.panel} ${styles.panel}`} aria-labelledby="searchapi-test-title">
    <div className={styles.header}>
      <div>
        <h2 id="searchapi-test-title">Test SearchAPI</h2>
        <p>Run one search and see the response here. This does not start a competition scan.</p>
      </div>
      <form action={submit}>
        <button type="submit" className={brand.secondaryButton} disabled={pending || cooling} aria-busy={pending}>
          {pending ? "Testing SearchAPI…" : cooling ? "Test complete" : "Test SearchAPI"}
        </button>
      </form>
    </div>
    <p className={styles.query}><strong>Test query:</strong> oral care toothpaste brands India</p>
    <p className={styles.note}>One Google search request; repeated tests reuse the response for up to five minutes.</p>
    {pending ? <p role="status">Waiting for SearchAPI…</p> : null}
    {result && !pending ? <div className={styles.result}>
      <p className={result.ok ? styles.success : brand.error} role={result.ok ? "status" : "alert"}>{result.message}</p>
      <p className={styles.note}>
        {result.httpStatus !== null ? `HTTP ${result.httpStatus} · ` : ""}
        {result.code ? `${result.code} · ` : ""}
        {(result.durationMs / 1000).toFixed(2)} seconds
        {result.reused ? " · Reused test response; no new search" : ""}
      </p>
      <p className={styles.note}>Checked {new Date(result.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST{cooling ? ` · Next test after ${new Date(result.retryAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : ""}</p>
      {result.results.length ? <ol className={styles.results}>
        {result.results.map((item) => <li key={item.url}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
          <span className={styles.url}>{item.url}</span>
          {item.snippet ? <p>{item.snippet}</p> : null}
        </li>)}
      </ol> : null}
    </div> : null}
  </section>;
}
