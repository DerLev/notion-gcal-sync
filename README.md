# notion-gcal-sync

[![wiki](https://drive.google.com/uc?export=view&id=14APbG2vXF1r1zAwPLYOyQDjoSeE5cdYs)](https://github.com/DerLev/notion-gcal-sync/wiki)<br />
[**To-Do list / Roadmap**](https://derlev.notion.site/9f2b23bd9bac4151a86ba89a86fade8a?v=30ff4ab2347343f5a60d25d53b22c278)

### Running the app

*Read in the [wiki](https://github.com/DerLev/notion-gcal-sync/wiki/Running-the-app)*

### Development

#### Prerequisites

- Google Calendar API [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Google-Calendar-API)
- Notion Application [*read here*](https://github.com/DerLev/notion-gcal-sync/wiki/Setting-up-Notion-Application)
- NodeJS v16 with `yarn`

#### Running dev environment

1. clone repo
2. add `.env` from `.env.example` and fill with your config and tokens
3. add `dbs.js` and `gcal-sync.js` to the `/config` directory and fill in your config *([read here](https://github.com/DerLev/notion-gcal-sync/wiki/Configuration))*
4. run `yarn` to install all packages
5. run `yarn dev`
