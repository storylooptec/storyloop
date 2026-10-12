type Failure = { code: string; status: number };
export type R2LogoStage = "configuration" | "client" | "request" | "body" | "response";

// Only fixed categories leave the server. SDK errors can contain credentials,
// signed URLs, endpoint names and object keys, so never return or log them raw.
export function classifyR2LogoError(error: unknown): Failure {
  const value = error && typeof error === "object"
    ? error as { name?: unknown; code?: unknown; message?: unknown; $metadata?: { httpStatusCode?: unknown } }
    : {};
  const name = typeof value.name === "string" ? value.name : "";
  const code = typeof value.code === "string" ? value.code : "";
  const status = value.$metadata?.httpStatusCode;
  const message = typeof value.message === "string" ? value.message : "";
  if (typeof value.message === "string" && /^Missing required environment variable: R2_(ACCOUNT_ID|ACCESS_KEY_ID|SECRET_ACCESS_KEY|BUCKET_NAME)$/.test(value.message)) {
    return { code: "configuration_missing", status: 503 };
  }
  if (name === "NoSuchKey") return { code: "object_not_found", status: 404 };
  if (name === "NoSuchBucket") return { code: "bucket_not_found", status: 502 };
  if (name === "InvalidArgument") {
    // Match provider wording, but never copy that wording into the response.
    if (/credential access key has length/i.test(message)) return { code: "access_key_id_length_invalid", status: 502 };
    if (/credential region/i.test(message)) return { code: "credential_region_invalid", status: 502 };
    if (/credential service/i.test(message)) return { code: "credential_service_invalid", status: 502 };
    if (/credential date|date header|x-amz-date/i.test(message)) return { code: "credential_date_invalid", status: 502 };
    if (/signedheaders/i.test(message)) return { code: "signed_headers_invalid", status: 502 };
    if (/authorization|credential/i.test(message)) return { code: "authorization_invalid", status: 502 };
  }
  if (["InvalidArgument", "InvalidRequest", "AuthorizationHeaderMalformed", "InvalidEndpoint", "PermanentRedirect"].includes(name)) {
    return { code: "request_invalid", status: 502 };
  }
  if (["Unauthorized", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredRequest", "ExpiredToken", "InvalidToken"].includes(name) || status === 401) {
    return { code: "authentication_failed", status: 502 };
  }
  if (name === "NotEntitled") return { code: "account_not_entitled", status: 502 };
  if (name === "AccessDenied" || status === 403) return { code: "access_denied", status: 502 };
  if (name === "InvalidBucketName" || ["ERR_INVALID_URL", "ERR_INVALID_CHAR", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return { code: "configuration_invalid", status: 502 };
  if (message === "Resolved credential object is not valid") return { code: "authentication_failed", status: 502 };
  if (/checksum mismatch|checksum validation failed/i.test(message)) return { code: "integrity_check_failed", status: 502 };
  if (/transformToByteArray is not a function|Unable to get a reader|Unexpected stream implementation/i.test(message)) return { code: "body_unreadable", status: 502 };
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

export function r2LogoFailureResponse(error: unknown, stage: R2LogoStage = "request"): Response {
  const failure = classifyR2LogoError(error);
  const value = error && typeof error === "object" ? error as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } : {};
  const knownTypes = ["Error", "TypeError", "SyntaxError", "S3ServiceException", "NoSuchKey", "NoSuchBucket", "InvalidArgument", "InvalidRequest", "AuthorizationHeaderMalformed", "InvalidEndpoint", "PermanentRedirect", "Unauthorized", "InvalidAccessKeyId", "SignatureDoesNotMatch", "ExpiredRequest", "ExpiredToken", "InvalidToken", "AccessDenied", "NotEntitled", "InvalidBucketName", "TimeoutError", "AbortError", "RequestTimeout", "SlowDown", "TooManyRequests", "ServiceUnavailable"];
  const errorType = typeof value.name === "string" && knownTypes.includes(value.name) ? value.name : "unclassified";
  const rawStatus = value.$metadata?.httpStatusCode;
  const upstreamStatus = typeof rawStatus === "number" && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599 ? rawStatus : null;
  console.error("R2 logo read failed", { ...failure, stage, errorType, upstreamStatus });
  return new Response("Logo unavailable", {
    status: failure.status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Storyloop-Asset-Error": failure.code,
      "X-Storyloop-Asset-Stage": stage,
      "X-Storyloop-Asset-Error-Type": errorType,
      "X-Storyloop-Asset-Upstream-Status": upstreamStatus === null ? "none" : String(upstreamStatus),
    },
  });
}
