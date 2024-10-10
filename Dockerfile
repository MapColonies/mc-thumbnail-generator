FROM node:18.18.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    xorg \
    xserver-xorg \
    xvfb \
    libx11-dev \
    libxext-dev \
    && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

ENV HOME=/home/node

RUN mkdir -p $HOME/app && \
    chown -R node:node $HOME && \
    chmod -R 755 $HOME

RUN mkdir -p $HOME/.local/share/applications && \
    chown -R node:node $HOME/.local && \
    chmod -R 755 $HOME/.local

WORKDIR $HOME/app

COPY package.json ./
RUN npm install copyfiles -g
RUN npm install

COPY . .

RUN mkdir -p $HOME/app/dist && \
    chown -R node:node $HOME/app/dist && \
    chmod -R 755 $HOME/app/dist

RUN npm run build

USER node

CMD ["npm", "run", "start-prod"]
