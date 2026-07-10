import { clerkMiddleware } from "@clerk/nextjs/server";

// Non-protecting by design: FindTao is local-first and fully usable signed-out,
// so no route is gated. clerkMiddleware() only makes the auth context available.
// (clerk init scaffolds an auth.protect() version — intentionally removed here.)
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless referenced in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes and Clerk's auto-proxy path.
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
