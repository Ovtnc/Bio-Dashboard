import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { DefaultSession, NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "@/lib/prisma";
import { loginRequestSchema } from "@/lib/schemas/api";

type ExtendedUser = DefaultSession["user"] & {
  id: string;
  role: string;
};

function requireEnv(name: "AUTH_SECRET" | "JWT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} zorunludur. Lütfen ortam değişkeni olarak tanımlayın.`);
  }
  return value;
}

const authSecret = requireEnv("AUTH_SECRET");
const backendJwtSecret = requireEnv("JWT_SECRET");

function readBackendAccessTokenTtlSeconds() {
  const raw = process.env.BACKEND_ACCESS_TOKEN_TTL_SECONDS?.trim();
  if (!raw) {
    return 60 * 60 * 24;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 300) {
    return 60 * 60 * 24;
  }

  return Math.floor(parsed);
}

const backendAccessTokenTtlSeconds = readBackendAccessTokenTtlSeconds();

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function signBackendAccessToken(payload: {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const claims = {
    ...payload,
    iat: now,
    exp: now + backendAccessTokenTtlSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(claims));
  const tokenData = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", backendJwtSecret)
    .update(tokenData)
    .digest("base64url");

  return `${tokenData}.${signature}`;
}

const googleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
);
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
const useSecureCookies =
  process.env.NODE_ENV === "production" && nextAuthUrl.startsWith("https://");

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  useSecureCookies,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.AUTH_GOOGLE_ID as string,
            clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "E-posta",
          type: "email",
        },
        password: {
          label: "Şifre",
          type: "password",
        },
      },
      async authorize(credentials) {
        const parsedCredentials = loginRequestSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsedCredentials.success) {
          return null;
        }
        const { email, password } = parsedCredentials.data;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        } as ExtendedUser;
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = profile?.email?.toLowerCase();
      if (!email) {
        return false;
      }

      await prisma.user.upsert({
        where: { email },
        update: {
          name: profile?.name ?? undefined,
          image: typeof profile?.image === "string" ? profile.image : undefined,
        },
        create: {
          email,
          name: profile?.name ?? "Google User",
          image: typeof profile?.image === "string" ? profile.image : null,
          role: "Researcher",
        },
      });

      return true;
    },
    async jwt({ token, user }) {
      if (token.email) {
        const dbUser = await prisma.user.findUnique({
          where: {
            email: token.email.toLowerCase(),
          },
          select: {
            id: true,
            name: true,
            role: true,
            image: true,
          },
        });

        if (dbUser) {
          token.id = String(dbUser.id);
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.picture = dbUser.image ?? token.picture;
        }
      }

      if (user) {
        const authUser = user as Partial<ExtendedUser>;
        token.id = authUser.id ?? token.id;
        token.role = authUser.role ?? token.role ?? "Researcher";
      }

      const subject = typeof token.id === "string" ? token.id : token.sub;
      if (typeof subject === "string" && subject) {
        token.backendAccessToken = signBackendAccessToken({
          sub: subject,
          email: typeof token.email === "string" ? token.email : undefined,
          name: typeof token.name === "string" ? token.name : undefined,
          role: typeof token.role === "string" ? token.role : "Researcher",
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = typeof token.role === "string" ? token.role : "Researcher";
        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
      }
      if (typeof token.backendAccessToken === "string") {
        session.accessToken = token.backendAccessToken;
      }

      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}
