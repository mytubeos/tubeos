FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# 🔥 FIX: full install karo
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "server.js"]
