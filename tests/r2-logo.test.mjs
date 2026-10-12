import assert from "node:assert/strict";
import test from "node:test";
import { classifyR2LogoError, r2LogoFailureResponse } from "../src/lib/r2/logo-error.ts";
import { r2ConfigurationIssues } from "../src/lib/r2/config-diagnostics.ts";

test("R2 logo errors distinguish a missing object from bucket, authorization and connectivity failures", () => {
  const cases = [
    [{ name: "NoSuchKey", $metadata: { httpStatusCode: 404 } }, "object_not_found", 404],
    [{ name: "NoSuchBucket", $metadata: { httpStatusCode: 404 } }, "bucket_not_found", 502],
    [{ name: "SignatureDoesNotMatch", $metadata: { httpStatusCode: 403 } }, "authentication_failed", 502],
    [{ name: "Unauthorized" }, "authentication_failed", 502],
    [{ name: "AccessDenied" }, "access_denied", 502],
    [{ name: "NotEntitled" }, "account_not_entitled", 502],
    [{ code: "ENOTFOUND" }, "connection_failed", 502],
    [{ name: "TimeoutError" }, "connection_timeout", 504],
    [{ name: "SlowDown" }, "service_unavailable", 503],
    [{ code: "ERR_INVALID_URL" }, "configuration_invalid", 502],
    [{ name: "InvalidArgument" }, "request_invalid", 502],
    [{ name: "InvalidArgument", message: "Invalid Argument: Credential access key has length 53, should be 32" }, "access_key_id_length_invalid", 502],
    [{ name: "InvalidArgument", message: "Credential service should be s3, not private-value" }, "credential_service_invalid", 502],
    [{ name: "InvalidArgument", message: "Invalid Argument: Authorization private-value" }, "authorization_invalid", 502],
    [new Error("Checksum mismatch: expected secret-checksum"), "integrity_check_failed", 502],
    [new Error("Missing required environment variable: R2_SECRET_ACCESS_KEY"), "configuration_missing", 503],
    [{ $metadata: { httpStatusCode: 404 } }, "request_failed", 502],
    [null, "request_failed", 502],
  ];
  for (const [error, code, status] of cases) assert.deepEqual(classifyR2LogoError(error), { code, status });
});

test("R2 format diagnostics identify malformed deployment fields without returning their values", () => {
  const config = { accountId: "a".repeat(32), accessKeyId: "b".repeat(32), secretAccessKey: "c".repeat(64), bucket: "creatorimages", endpoint: `https://${"a".repeat(32)}.r2.cloudflarestorage.com` };
  assert.deepEqual(r2ConfigurationIssues(config), []);
  assert.deepEqual(r2ConfigurationIssues({ ...config, endpoint: `https://${config.accountId}.eu.r2.cloudflarestorage.com` }), []);
  assert.deepEqual(r2ConfigurationIssues({ ...config, accessKeyId: "private-value".repeat(5), secretAccessKey: "secret-value", bucket: "creatorimages\n" }), ["access_key_id_format", "secret_access_key_format", "bucket_whitespace"]);
  assert.deepEqual(r2ConfigurationIssues({ ...config, endpoint: "https://private-host.example/bucket" }), ["endpoint_account_mismatch", "endpoint_contains_path"]);
});

test("R2 failure responses and logs contain only fixed categories, never provider secrets or URLs", async () => {
  const logs = [];
  const original = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const response = r2LogoFailureResponse({
      name: "untrusted-secret-value", code: "untrusted-secret-value",
      message: "https://account.example/bucket/private-file?X-Amz-Credential=untrusted-secret-value",
      $metadata: { httpStatusCode: 500, requestId: "untrusted-secret-value" },
    });
    assert.equal(response.status, 502);
    assert.equal(await response.text(), "Logo unavailable");
    assert.equal(response.headers.get("x-storyloop-asset-error"), "request_failed");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-storyloop-asset-stage"), "request");
    assert.equal(response.headers.get("x-storyloop-asset-error-type"), "unclassified");
    assert.equal(response.headers.get("x-storyloop-asset-upstream-status"), "500");
    assert.deepEqual(logs, [["R2 logo read failed", { code: "request_failed", status: 502, stage: "request", errorType: "unclassified", upstreamStatus: 500 }]]);
    assert.ok(!JSON.stringify([...response.headers]).includes("untrusted-secret-value"));
  } finally { console.error = original; }
});
