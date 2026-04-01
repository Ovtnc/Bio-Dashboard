import { withAuth } from "next-auth/middleware";

export default withAuth({
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/analysis/:path*",
    "/analysis-status/:path*",
    "/differential-expression/:path*",
    "/genome-browser/:path*",
    "/files/:path*",
    "/reports/:path*",
  ],
};
