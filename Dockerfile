from node:17.9.0-alpine

WORKDIR ./

COPY . .
RUN npm install
RUN npm run postinstall

env PORT 3000

EXPOSE 3000

CMD ["npm","start"]