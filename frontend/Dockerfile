FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files
COPY index.html reservations.html profile.html app.css core.js salles.js compte.js posthog.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]