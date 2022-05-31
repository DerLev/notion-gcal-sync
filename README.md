# notion-gcal-sync

[**Wiki**](https://github.com/DerLev/notion-gcal-sync/wiki)<br />
[**To-Do list / Roadmap**](https://derlev.notion.site/9f2b23bd9bac4151a86ba89a86fade8a?v=30ff4ab2347343f5a60d25d53b22c278)

### Running the app

#### Prerequisites

- Google Calnedar API [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Google-Calendar-API)
- Notion Application [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Notion-Application)
- Docker with Docker Compose **OR** nodejs v16 with `yarn`

#### Docker Compose

1. copy the `docker-compose.example.yml` as `docker-compose.yml` to your directory
2. add `.env`, `dbs.js` and `gcal-sync.js` to the same directory where your `docker-compose.yml` is located
3. fill `.env`, `dbs.js` and `gcal-sync.js` with your configuration and tokens *([read here](https://github.com/DerLev/notion-gcal-sync/wiki/Configuration))*
4. execute `docker-compose up -d` or `docker compose up -d` to start the container

DONE!

---

#### NodeJS with Yarn

1. clone the repositiory
2. add `.env` from `.env.example` and fill with your config and tokens
3. add `dbs.js` and `gcal-sync.js` to the `/config` directory and fill in your config *([read here](https://github.com/DerLev/notion-gcal-sync/wiki/Configuration))*
4. run `yarn` to install the packages
5. run `yarn start` to start the app

DONE!

---

### Development

#### Prerequisites

- Google Calnedar API [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Google-Calendar-API)
- Notion Application [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Notion-Application)
- NodeJS v16 with `yarn`

#### Running dev environment

1. clone repo
2. add `.env` from `.env.example` and fill with your config and tokens
3. add `dbs.js` and `gcal-sync.js` to the `/config` directory and fill in your config *([read here](https://github.com/DerLev/notion-gcal-sync/wiki/Configuration))*
4. run `yarn` to install all packages
5. run `yarn dev`
