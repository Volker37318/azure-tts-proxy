FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["node", "server.js"]
