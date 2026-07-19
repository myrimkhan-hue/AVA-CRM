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
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
