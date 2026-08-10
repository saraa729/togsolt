FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate && npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV EXPOCRAFT_DATA_DIR=/usr/src/app/data
ENV EXPOCRAFT_UPLOAD_DIR=/usr/src/app/data/uploads
EXPOSE 4000
VOLUME ["/usr/src/app/data"]
CMD ["node", "dist/app.js"]
