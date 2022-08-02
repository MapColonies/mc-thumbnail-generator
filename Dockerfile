
FROM node:16.10.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
RUN apt-get update && apt-get install curl gnupg -y \
  && curl --location --silent https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install google-chrome-stable -y --no-install-recommends \
  && apt-get install -y xorg xserver-xorg xvfb libx11-dev libxext-dev \
  && rm -rf /var/lib/apt/lists/*
  
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
RUN mkdir /home/node/app && chmod -R 777 /home/node/app
WORKDIR /home/node/app
COPY package.json .
RUN npm install copyfiles -g
RUN npm install
COPY . .
RUN mkdir -p /home/node/app/dist

RUN npm run build

RUN chown -R node /home/node/app/dist && chmod -R 777 /home/node/app/dist

CMD ["npm","run","start-prod"]