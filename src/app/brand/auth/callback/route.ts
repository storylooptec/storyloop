import { NextResponse,type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
export async function GET(request:NextRequest) {
  const code=request.nextUrl.searchParams.get("code");
  if(code){const db=await createServerSupabaseClient();const {error}=await db.auth.exchangeCodeForSession(code);
    if(!error)return NextResponse.redirect(new URL('/brand/setup',request.url));}
  return NextResponse.redirect(new URL('/brand?error=code',request.url));
}
