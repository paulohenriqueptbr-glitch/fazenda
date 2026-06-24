# Dockerfile for Terrasyn (Node/Express PWA)
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install app dependencies (including production deps only)
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose the port the app runs on (default 5175)
EXPOSE 5175

# Start the server
CMD ["npm","start"]
