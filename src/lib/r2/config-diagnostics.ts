type Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

// Return field names only. No values, lengths, hashes or credential fragments
// may be included in the public logo diagnostic.
export function r2ConfigurationIssues(config: Config): string[] {
  const issues: string[] = [];
  if (!/^[a-f0-9]{32}$/i.test(config.accountId)) issues.push("account_id_format");
  if (!/^[a-f0-9]{32}$/i.test(config.accessKeyId)) issues.push("access_key_id_format");
  if (!/^[a-f0-9]{64}$/i.test(config.secretAccessKey)) issues.push("secret_access_key_format");
  if (config.bucket !== config.bucket.trim()) issues.push("bucket_whitespace");
  try {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) issues.push("endpoint_format");
    const account = config.accountId.toLowerCase();
    const hosts = ["", ".eu", ".us", ".fedramp"].map(jurisdiction => `${account}${jurisdiction}.r2.cloudflarestorage.com`);
    if (!hosts.includes(endpoint.hostname)) issues.push("endpoint_account_mismatch");
    if (endpoint.pathname !== "/" && endpoint.pathname !== "") issues.push("endpoint_contains_path");
  } catch { issues.push("endpoint_format"); }
  return issues;
}
