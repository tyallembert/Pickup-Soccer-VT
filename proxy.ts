import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthPage = createRouteMatcher(["/signin", "/signup"]);
const isAccountRoute = createRouteMatcher(["/account(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

// Without this, Convex Auth writes its token cookies with no `maxAge`, which
// makes them *session* cookies — the browser drops them when the tab/app is
// closed, so you get signed out even though the Convex session itself is still
// valid. Matching Convex Auth's own 30-day session default (both
// `totalDurationMs` and `inactiveDurationMs`) means the cookie and the session
// expire together instead of the cookie cutting the login short. The window
// rolls forward every time the middleware refreshes the tokens.
const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isAuthPage(request) && authed) {
      return nextjsMiddlewareRedirect(request, "/account");
    }
    if ((isAccountRoute(request) || isAdminRoute(request)) && !authed) {
      const url = new URL(request.url);
      const redirect = url.pathname + url.search;
      return nextjsMiddlewareRedirect(
        request,
        `/signin?redirect=${encodeURIComponent(redirect)}`,
      );
    }
  },
  { cookieConfig: { maxAge: THIRTY_DAYS_IN_SECONDS } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
