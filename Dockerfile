# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
WORKDIR /app/client
RUN npm install
WORKDIR /app/server
RUN npm install
WORKDIR /app

# Copy source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built client and server
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/build ./server/build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000
ENV SOCKET_PORT=8080
ENV CLIENT_URL=http://localhost:3000

WORKDIR /app/server

EXPOSE $PORT
EXPOSE $SOCKET_PORT

CMD ["npm", "run", "start"]
