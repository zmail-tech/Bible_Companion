# Multi-stage: build nothing (static app), just serve with nginx
FROM nginx:alpine AS runtime

# Copy all static files into nginx's web root
COPY . /usr/share/nginx/html

# Nginx default config already works fine for static files

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/index.html | grep -q "Bible" || exit 1

CMD ["nginx", "-g", "daemon off;"]
