"use server";

import { requireBrandContext } from "@/brand/context";
import { testSearchApi, type SearchApiTestResult } from "@/lib/providers/searchapi-test";

export async function testSearchApiAction(): Promise<SearchApiTestResult> {
  // Keep the paid test inside the signed-in Brand workspace. No research RPCs or service key.
  await requireBrandContext();
  return testSearchApi();
}
