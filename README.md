# notion-gcal-sync

[**Notion Roadmap**](https://derlev.notion.site/9f2b23bd9bac4151a86ba89a86fade8a?v=30ff4ab2347343f5a60d25d53b22c278)

### Running the app

#### Prerequisites

- Docker with Docker-Compose

OR

- nodejs v16 with `yarn`

#### Docker Compose

1. copy the `docker-compose.example.yml` as `docker-compose.yml` to your directory
2. add `.env`, `dbs.js` and `gcal-sync.js` to the same directory where your `docker-compose.yml` is located
3. fill `.env`, `dbs.js` and `gcal-sync.js` with your configuration and tokens *(read below)*
4. execute `docker-compose up -d` or `docker compose up -d` to start the container

DONE!

#### NodeJS with Yarn

1. clone the repositiory
2. add `.env` from `.env.example` and fill with your config and tokens
3. add `dbs.js` and `gcal-sync.js` to the `/config` directory and fill in your config *(read below)*
4. run `yarn` to install the packages
5. run `yarn start` to start the app

DONE!

#### Configuration

`.env`
```
copy from .env.example and fill in your config and tokens
```

`dbs.js`
```javascript
const dbs = {
  // start db schema
  'notion db id': {
    title: 'Title field name from notion',
    description: 'Description field name from notion', // <-- can be null to disable
    date: 'Date field name from notion',
    location: 'Location field name from notion',       // <-- can be null to disable
    meetingURL: 'Meeting URL field name from notion',  // <-- can be null to disable
    additional: {} // <-- add aditional fields for this DB | see https://developers.notion.com/reference/property-value-object
  },
  // end db schema
  // add more dbs here if you need | follow the same schema as above
}

export default dbs
```

`gcal-sync.js`
```javascript
const gcals = [
  // start gcal schema
  {
    id: 'gcal id',
    notionDB: 'notion db id',
    additional: {} // <-- add aditional fields for this GCal | see https://developers.notion.com/reference/property-value-object
  },
  // end gcal schema
  // add more gcals here if you need | follow the same schema as above
]

export default gcals
```

---

### Development

#### Prerequisites

- yarn

#### Running dev environment

1. clone repo
2. add `.env` from `.env.example` and fill with your config and tokens
3. add `dbs.js` and `gcal-sync.js` to the `/config` directory and fill in your config *(read above)*
4. run `yarn`
5. run `yarn dev`
