FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --workspace @ava-crm/backend
COPY backend/prisma ./backend/prisma
WORKDIR /app/backend
RUN npx prisma generate
COPY backend/nest-cli.json backend/tsconfig*.json ./
COPY backend/src ./src
COPY --chmod=755 backend/docker-entrypoint.dev.sh /usr/local/bin/backend-entrypoint
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/backend-entrypoint"]
CMD ["start"]
