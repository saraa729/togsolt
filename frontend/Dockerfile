FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# API-гийн хаяг build үед клиентийн багц дотор шингэдэг тул энд өгнө.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/next.config.ts ./

EXPOSE 3000
CMD ["npm", "run", "start"]
