# Build Stage
FROM node:20-alpine AS build

WORKDIR /workspace

# Copy dependencies manifest
COPY app/package*.json ./app/

# Install dependencies
RUN cd app && npm ci

# Copy full application code
COPY app/ ./app/

# Build production static bundle
RUN cd app && npm run build

# Production Server Stage
FROM nginx:alpine

# Copy built static assets to Nginx default folder
COPY --from=build /workspace/app/dist /usr/share/nginx/html

# Expose standard Cloud Run port
EXPOSE 8080

# Configure Nginx for PWA single-page app routing on port 8080
RUN sed -i 's/listen\(.*\)80;/listen 8080;/' /etc/nginx/conf.d/default.conf && \
    sed -i 's/location \/ {/location \/ { try_files $uri $uri\/ \/index.html;/' /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
