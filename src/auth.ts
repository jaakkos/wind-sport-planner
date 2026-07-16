import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import prisma from "@/lib/prisma";

/**
 * Magic links and OAuth callbacks use AUTH_URL as the site origin.
 * Production (Coolify): set AUTH_URL to https://fjelllift.com (no trailing slash).
 */

const resendKey = process.env.RESEND_API_KEY?.trim();
const emailFrom =
  process.env.RESEND_FROM?.trim() ||
  process.env.EMAIL_FROM?.trim() ||
  "Fjell Lift <noreply@fjelllift.com>";

const emailProvider = resendKey
  ? Resend({
      apiKey: resendKey,
      from: emailFrom,
    })
  : Nodemailer({
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
      from: emailFrom,
    });

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [emailProvider],
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
