# Use Ubuntu 22.04 LTS as the base image
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies (Java 17, Nginx, Supervisor, Node.js, curl, etc.)
RUN apt-get update && apt-get install -y \
    openjdk-11-jre-headless \
    nginx \
    supervisor \
    curl \
    gnupg \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app/mc

# Copy the entire build context (containing spigot files and prismarine-web-client)
COPY . /app/mc/

# Clean up local node_modules to avoid platform-dependent binary conflicts
RUN rm -rf /app/mc/prismarine-web-client/node_modules

# Configure Nginx
RUN rm -f /etc/nginx/sites-enabled/default
COPY prismarine-web-client/nginx.conf /etc/nginx/sites-enabled/default

# Configure Supervisord
COPY prismarine-web-client/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install dependencies for the Prismarine Web Client
RUN cd /app/mc/prismarine-web-client && npm install

# Expose ports:
# - 80: Nginx (Proxying the Web Client on 8080 and Blockly on 10273)
# - 25565: Minecraft server port
EXPOSE 80 25565

# Start Supervisord in the foreground
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
