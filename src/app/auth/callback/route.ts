import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = await createClient();

    // Exchange code for session
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect to the 'next' URL or home
  return NextResponse.redirect(new URL(next, request.url));
}
