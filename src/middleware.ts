import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const MAX_SESSION_MS = 2 * 60 * 1000; // 6 ชั่วโมง

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  let { data: { user } } = await supabase.auth.getUser();

  if (user?.last_sign_in_at) {
    const age = Date.now() - new Date(user.last_sign_in_at).getTime();
    if (age > MAX_SESSION_MS) {
      await supabase.auth.signOut(); // ล้าง cookie
      user = null;
    }
  }

  const path = request.nextUrl.pathname;

  function redirectTo(target: string) {
    const res = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach(c => res.cookies.set(c)); // ส่ง cookie ที่ล้างแล้วไปด้วย
    return res;
  }

  if (!user && (path.startsWith("/calendar") || path.startsWith("/admin"))) {
    return redirectTo("/login");
  }
  if (user && path === "/login") return redirectTo("/calendar");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
