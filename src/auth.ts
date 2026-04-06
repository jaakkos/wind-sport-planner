import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import prisma from "@/lib/prisma";

/** Render sets RENDER_EXTERNAL_URL; avoids a manual AUTH_URL in render.yaml for the default hostname. */
if (!process.env.AUTH_URL?.trim() && process.env.RENDER_EXTERNAL_URL?.trim()) {
  process.env.AUTH_URL = process.env.RENDER_EXTERNAL_URL.trim();
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST ?? "localhost",
        port: Number(process.env.EMAIL_SERVER_PORT ?? "1025"),
        secure: false,
        auth:
          process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD
            ? {
                user: process.env.EMAIL_SERVER_USER,
                pass: process.env.EMAIL_SERVER_PASSWORD,
              }
            : undefined,
      },
      from: process.env.EMAIL_FROM ?? "Fjell Lift <noreply@localhost>",
    }),
  ],
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  trustHost: process.env.AUTH_TRUST_HOST === "true",
});
