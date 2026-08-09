FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --production

COPY . .

ENV NODE_ENV=production
EXPOSE 4000
VOLUME ["/usr/src/app/data"]
CMD ["node", "app.js"]
