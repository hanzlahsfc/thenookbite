import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Refreshes the Supabase auth session on every request. The access token
// expires after about an hour; a Server Component can read a refreshed token
// but can't persist the new cookie (cookies() is read-only there), so without
// this the next request replays an already-rotated-out refresh token and the
// user is bounced to /pos/login on their own — not because they clicked Sign
// Out. Middleware is the one place that can reliably write the refreshed
// cookies back before the page loads.
export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const path = request.nextUrl.pathname;

  const rewriteUrl =
    host.startsWith('kitchen.') && !path.startsWith('/kitchen')
      ? new URL(`/kitchen${path === '/' ? '' : path}`, request.url)
      : host.startsWith('admin.') && !path.startsWith('/admin')
      ? new URL(`/admin${path === '/' ? '' : path}`, request.url)
      : null;

  let response = rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = rewriteUrl ? NextResponse.rewrite(rewriteUrl) : NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
