# notion-gcal-sync

[![CI](https://github.com/DerLev/notion-gcal-sync/actions/workflows/integration.yml/badge.svg?branch=main&event=push)](https://github.com/DerLev/notion-gcal-sync/actions/workflows/integration.yml)

[![header image](https://am3pap006files.storage.live.com/y4mYi1FOnfOUa4DCZwKZLB2RAcp24_-J5bC8Nb9R1DB0iwxMsKmSL3CGAV2u7cMkZqq-yrd6Xi15QMnj6nF0CjiafoWPBq9mDo7p4fWG1hH3jT2p7aMr5ZGF1mM-FoOX-Pa6-vKdfj4XSbII62L4Rzm-JsfNkQ2WGhpvU7i-uR4oN8Vx0ssJ6o81GyV_gSkVSIX?width=1244&height=256&cropmode=none)](https://github.com/DerLev/notion-gcal-sync/)

[![wiki](https://derlev.github.io/svg-tags/derlev%20wiki.svg)](https://github.com/DerLev/notion-gcal-sync/wiki)<br />
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
