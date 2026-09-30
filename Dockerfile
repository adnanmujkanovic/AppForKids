FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm test

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3001 SPARKFORGE_DB=/app/data/sparkforge.db SPARKFORGE_KEY_FILE=/app/data/secret.key
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME /app/data
EXPOSE 3001
USER node
CMD ["node", "--no-warnings=ExperimentalWarning", "--import", "tsx", "server/index.ts"]
