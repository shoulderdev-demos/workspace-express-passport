FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
