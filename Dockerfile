FROM node:22-alpine
WORKDIR /app

# Install dependencies first so this layer is cached between code changes.
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Run as the unprivileged user that ships with the node image — not root.
# (DevDeploy's auto-generated Dockerfiles skip this, and Semgrep flags it.)
USER node

EXPOSE 3000
CMD ["node", "index.js"]
