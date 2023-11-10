FROM node:20-slim

# WorkDir
WORKDIR /usr/src/app

# Copy Package.json
COPY package*.json ./

# Install Packages
RUN npm install

# COPY SOURCE FILES
COPY . .

# BUILD Commands

# Expose ports
EXPOSE 3000

CMD ["node", "server.js"]