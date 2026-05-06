import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthPage = createRouteMatcher(["/signin", "/signup"]);
const isAccountRoute = createRouteMatcher(["/account(.*)"]);
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

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
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
