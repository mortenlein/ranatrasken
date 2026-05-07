import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Ranatrasken Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "test@example.com" },
        name: { label: "Name", type: "text", placeholder: "Your Name" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        // Simplified for local demo: auto-create user if they don't exist
        let user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email as string,
              name: credentials.name as string || "Hiker",
            },
          });
        }

        return user;
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
