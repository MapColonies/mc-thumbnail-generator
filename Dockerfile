# FROM node:16.10.0
# RUN adduser newuser --disabled-password
# RUN mkdir -p /application
# RUN chown -R newuser /application
# WORKDIR /application

# COPY . .
# RUN npm install
# RUN npm run build

# env PORT 3000

# EXPOSE 3000

# USER newuser
# CMD ["npm","start"]

FROM node:16.10.0
USER node
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
RUN mkdir /home/node/app && chmod -R 777 /home/node/app
WORKDIR /home/node/app
COPY package.json .
RUN npm install copyfiles -g
RUN npm install
COPY . .
RUN npm run build
CMD ["npm","run","start-prod"]