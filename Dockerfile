FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_CONVEX_URL=""
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV CODEX_HOME=/codex-home

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/server ./server

EXPOSE 3000
CMD ["npm", "run", "start"]
