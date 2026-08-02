# Ranatrasken — production web image (Next.js 16 App Router + Prisma/SQLite).
# Mirrors the two-stage pattern used by the other Next.js apps on ash.

# ---- Build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time; compose
# passes the key from the server-local .env as a build arg.
ARG NEXT_PUBLIC_MAPTILER_KEY
ENV NEXT_PUBLIC_MAPTILER_KEY=$NEXT_PUBLIC_MAPTILER_KEY
# Build never talks to the real DB; a throwaway path keeps Prisma env checks happy.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npm run build

# ---- Run ----
FROM node:20-bookworm-slim AS run
WORKDIR /app
# openssl: Prisma's engine probes libssl at startup (warns and may misbehave
# without it on slim images).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.ts ./
COPY --from=build /app/prisma ./prisma
# Drop devDependencies, then regenerate the Prisma client: prune removes the
# generated node_modules/.prisma dir (it looks extraneous to npm).
RUN npm prune --omit=dev && npx prisma generate && npm cache clean --force
# Non-root: node is uid 1000 = host mole = owner of the bind-mounted ./data.
RUN chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Apply any pending migrations against the mounted SQLite file, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -H 0.0.0.0 -p 3000"]
