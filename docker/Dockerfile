# Generated {{ now }}
FROM node:20.11.0-slim
WORKDIR /app

# Preinstalacion


# Dependencias
RUN npm i jsonwebtoken@9.0.2
RUN npm i pg@8.13.0
RUN npm i pg-hstore@2.3.4

RUN npm i tsx -g

COPY env.base /app/.env
COPY _flows /app/_flows
COPY horizonShare /app/horizonShare
COPY horizonWorker /app/horizonWorker

EXPOSE 3000
CMD [ "tsx","horizonWorker/worker","flow","_flows/15.test.testworkers",3000]
