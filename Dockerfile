FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY work ./work
COPY src ./src

RUN npm run build && npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
