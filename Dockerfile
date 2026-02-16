FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY . /app
WORKDIR /app

RUN npm install

EXPOSE 3000
ENV TZ="Europe/Berlin"

CMD node ./bin/www
