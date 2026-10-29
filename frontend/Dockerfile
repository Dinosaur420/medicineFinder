
# Stage 1: Install frontend dependencies
FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


# Stage 2: Development runtime
FROM node:22-alpine AS development

WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
