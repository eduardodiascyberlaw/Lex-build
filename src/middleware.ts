import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/(app)/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/peca/:path*",
    "/admin/:path*",
  ],
};
