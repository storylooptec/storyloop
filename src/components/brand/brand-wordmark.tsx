"use client";

import { useState } from "react";

import styles from "@/app/brand/brand.module.css";

/** Show the uploaded light-theme logo, with a wordmark while it is unavailable. */
export function BrandWordmark() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <span className={styles.brandWordmark} data-logo-loaded={loaded && !failed} aria-hidden="true">
      <span className={styles.brandWordmarkText}>Storyloop<span>.</span></span>
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.brandLogoImage} src="/api/brand/logo?slot=light&public=1" alt="" width="144" height="38"
          ref={image => {
            // Cached images can finish before hydration attaches the handlers.
            if (image?.complete) {
              if (image.naturalWidth > 0) setLoaded(true);
              else setFailed(true);
            }
          }}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      ) : null}
    </span>
  );
}
