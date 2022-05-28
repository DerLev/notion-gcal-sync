FROM node:16-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .

FROM node:16-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=deps /app .

LABEL org.opencontainers.image.source https://github.com/DerLev/notion-gcal-sync

CMD ["node", "src/app.js"]