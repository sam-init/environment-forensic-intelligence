# ================================================================
# Frontend Dockerfile
# Node 22 Alpine + Vite dev server
# ================================================================
FROM node:22-alpine

LABEL maintainer="Environmental Forensic Intelligence"
LABEL description="EFI Frontend — React + Vite"

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
