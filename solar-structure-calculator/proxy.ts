import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  // Create an initial response
  let response = NextResponse.next({ request: { headers: request.headers } });

  // Supabase SSR client (cookie-based)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          // Re-create response and set cookies on it
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // IMPORTANT: this refreshes/reads the user from cookies
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Only allow the login page + Next static assets
  const isPublic =
    path === "/login" ||
    path.startsWith("/_next") ||
    path === "/favicon.ico" ||
    path.match(/\.(?:svg|png|jpg|jpeg|gif|webp)$/);

  // If not logged in, block EVERYTHING (including "/")
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

// Run middleware on all routes except Next internals/static assets
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

