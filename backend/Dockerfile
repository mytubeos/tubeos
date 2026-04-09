FROM node:18-alpine

WORKDIR /app

# 🔥 Step 1: copy package files
COPY package*.json ./

# 🔥 Step 2: install ALL deps properly
RUN npm install

# 🔥 Step 3: copy rest code
COPY . .

# 🔥 Cloud Run port
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
