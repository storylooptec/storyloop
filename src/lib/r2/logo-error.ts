type Failure = { code: string; status: number };

// Only fixed categories leave the server. SDK errors can contain credentials,
// signed URLs, endpoint names and object keys, so never return or log them raw.
export function classifyR2LogoError(error: unknown): Failure {
  const value = error && typeof error === "object"
    ? error as { name?: unknown; code?: unknown; message?: unknown; $metadata?: { httpStatusCode?: unknown } }
    : {};
  const name = typeof value.name === "string" ? value.name : "";
  const code = typeof value.code === "string" ? value.code : "";
  const status = value.$metadata?.httpStatusCode;
  if (typeof value.message === "string" && /^Missing required environment variable: R2_(ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET_NAME)$/.test(value.message)) {
    return { code: "configuration_missing", status: 503 };
  }
  if (name === "NoSuchKey") return { code: "object_not_found", status: 404 };
  if (name === "NoSuchBucket") return { code: "bucket_not_found", status: 502 };
  if (["Unauthorized", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredRequest", "ExpiredToken", "InvalidToken"].includes(name) || status === 401) {
    return { code: "authentication_failed", status: 502 };
  }
  if (name === "NotEntitled") return { code: "account_not_entitled", status: 502 };
  if (name === "AccessDenied" || status === 403) return { code: "access_denied", status: 502 };
  if (name === "InvalidBucketName" || code === "ERR_INVALID_URL") return { code: "configuration_invalid", status: 502 };
  if (["TimeoutError", "AbortError", "RequestTimeout"].includes(name) || ["ETIMEDOUT", "ESOCKETTIMEDOUT"].includes(code)) {
    return { code: "connection_timeout", status: 504 };
  }
  if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
    return { code: "connection_failed", status: 502 };
  }
  if (["SlowDown", "TooManyRequests", "ServiceUnavailable"].includes(name) || status === 429 || status === 503) {
    return { code: "service_unavailable", status: 503 };
  }
  // An unspecified HTTP 404 is not proof that the object is missing.
  return { code: "request_failed", status: 502 };
}

export function r2LogoFailureResponse(error: unknown): Response {
  const failure = classifyR2LogoError(error);
  console.error("R2 logo read failed", failure);
  return new Response("Logo unavailable", {
    status: failure.status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Storyloop-Asset-Error": failure.code,
    },
  });
}
