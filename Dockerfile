# Stage 1: Build the React Client
FROM node:20-alpine as client-builder
WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN npm install

# Copy client source code
COPY client/ .
RUN npm run build


# Stage 2: Setup the Server
FROM node:20-alpine
WORKDIR /app/server

# Instalar dependencias del sistema (FFmpeg para audio, git para npm deps como baileys)
RUN apk add --no-cache ffmpeg git

# Copy server package files
COPY server/package*.json ./
RUN npm install

# Copy server source code
COPY server/ .

# Copy built frontend assets from Stage 1
COPY --from=client-builder /app/client/build /app/client/build

# Production environment
ENV NODE_ENV=production
ENV ALLOW_MOCK_AUTH=false

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "index.js"]
