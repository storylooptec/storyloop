"use client";

import { useState } from "react";
import styles from "@/app/home.module.css";

/** Keep the identity legible while a logo is loading or awaiting re-upload. */
export function HomeWordmark() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <span className={styles.wordmark} data-logo-loaded={loaded && !failed}>
    <span className={styles.wordmarkText} aria-hidden="true">Storyloop<span>.</span></span>
    {!failed ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/api/brand/logo?slot=dark&public=1" alt="" aria-hidden="true" width="172" height="40"
        ref={image => {
          // The request can finish before hydration attaches load/error handlers.
          if (image?.complete) {
            if (image.naturalWidth > 0) setLoaded(true);
            else setFailed(true);
          }
        }}
        onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
    ) : null}
  </span>;
}
