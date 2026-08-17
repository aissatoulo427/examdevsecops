# syntax=docker/dockerfile:1

# Images epinglees par digest et non par tag : un tag peut etre redirige vers
# un autre contenu, un digest est une empreinte cryptographique immuable.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime

# Applique les correctifs Alpine publies depuis la construction de l'image de
# base. Celle-ci n'est reconstruite qu'a intervalles espaces : sans cette
# etape, elle embarque des paquets systeme (openssl, curl, expat...) dont les
# correctifs existent deja en amont, et le scan Trivy bloque la publication.
#
# Compromis assume : la version exacte des paquets depend de la date de build,
# ce qui affaiblit la reproductibilite bit a bit au profit de la securite.
RUN apk --no-cache upgrade

COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx doit pouvoir ecrire ses fichiers temporaires et son pid alors que la
# racine du conteneur est montee en lecture seule.
RUN mkdir -p /tmp/nginx && chown -R nginx:nginx /tmp/nginx /usr/share/nginx/html

USER nginx

# Port 8080 et non 80 : un processus non-root ne peut pas se lier a un port
# inferieur a 1024.
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
