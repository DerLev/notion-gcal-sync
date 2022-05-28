import dotenv from 'dotenv'
import { google } from 'googleapis'
import figlet from 'figlet'
import chalk from 'chalk'
import { createSpinner } from 'nanospinner'
import { Client } from '@notionhq/client'
import Joi from 'joi'

import dbs from '../config/dbs.js'
import gcals from '../config/gcal-sync.js'

dotenv.config()

const { OAuth2 } = google.auth

const oAuth2Client = new OAuth2( process.env.GOOGLE_CID, process.env.GOOGLE_CS )

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ACCOUNT_REFRESH_TOKEN
})

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

const notion = new Client({ auth: process.env.NOTION_TOKEN })

console.log(
  chalk.blue(
    figlet.textSync(
      'Notion GCal Sync',
      {
        horizontalLayout: "controlled smushing"
      }
    )
  )
)

const log = (level, text) => {
  let logLevel

  switch (level) {
    case 2:
      logLevel = chalk.bgBlue('   INFO   ')
      break
    case 1:
      logLevel = chalk.bgYellow('   WARN   ')
      break
    case 0:
      logLevel = chalk.bgRed(' CRITICAL ')
      break
    case 3:
      logLevel = chalk.bgWhite('  OUTPUT  ')
      break
    default:
      break
  }

  const time = new Date()

  console.log(logLevel, chalk.gray(time.toLocaleString()), text)
}

// check dbs.js file for correct formatting
const dbsSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  date: Joi.string().required(),
  location: Joi.string().allow(null).required(),
  meetingURL: Joi.string().allow(null).required(),
  additional: Joi.object().required()
})

const dbKeys = Object.keys(dbs)
dbKeys.forEach((key) => {
  const { error } = dbsSchema.validate(dbs[key])
  if(error) {
    log(0, chalk.bgGreen('dbs.json') + ' > ' + chalk.bgBlue(key) + ' > ' + chalk.bgRedBright(error.details[0].message))
    process.exit(1)
  }
})

// check gcal-sync.js file for correct formatting
const gcalsSchema = Joi.object({
  id: Joi.string().required(),
  notionDB: Joi.string().required(),
  additional: Joi.object().required()
})

const gcalKeys = Object.keys(gcals)
gcalKeys.forEach((key) => {
  const { error } = gcalsSchema.validate(gcals[key])
  if(error) {
    log(0, chalk.bgGreen('gcal-sync.json') + ' > ' + chalk.bgBlue('Index: ' + key) + ' > ' + chalk.bgRedBright(error.details[0].message))
    process.exit(1)
  }
})

// FUNCTIONS

const notionFindPageByTitle = async (db, title) => {
  if(!dbs[db]) throw 'Database not defined'

  return await notion.databases.query({
    database_id: db,
    filter: {
      property: dbs[db].title,
      title: {
        equals: title
      }
    }
  })
}

const notionEvent = async (db, title, description, startDate, endDate, location, meetingURL, additionalProps) => {
  if(!dbs[db]) throw 'Database not defined'
  if(!title) throw 'There has to be a title set'

  let properties = {
    [dbs[db].title]: {
      title: [
        { type: 'text', text: { content: title } }
      ]
    }
  }
  const keys = Object.keys(dbs[db].additional)
  keys.forEach((key) => {
    properties[key] = dbs[db].additional[key]
  })

  // TODO: convert rich-text from gcal to rich-text for notion
  if(dbs[db].description != null) {
    if(description) properties[dbs[db].description] = {
      rich_text: [
        { type: 'text', text: { content: description } }
      ]
    }
    else properties[dbs[db].description] = {
      rich_text: [
        { type: 'text', text: { content: '' } }
      ]
    }
  }

  if(startDate) {
    properties[dbs[db].date] = {
      date: {
        start: startDate
      }
    }

    if(endDate) properties.Date.date.end = endDate
  }

  if(dbs[db].location != null) {
    if(location) properties[dbs[db].location] = {
      rich_text: [
        { type: 'text', text: { content: location } }
      ]
    }
    else properties[dbs[db].location] = {
      rich_text: [
        { type: 'text', text: { content: '' } }
      ]
    }
  }

  if(dbs[db].meetingURL != null) {
    if(meetingURL) properties[dbs[db].meetingURL] = {
      url: meetingURL
    }
    else properties[dbs[db].meetingURL] = {
      url: null
    }
  }

  if(additionalProps) {
    const keys = Object.keys(additionalProps)
    keys.forEach((key) => {
      properties[key] = additionalProps[key]
    })
  }

  return properties
}

const notionCreateEvent = async (db, title, description, startDate, endDate, location, meetingURL, additionalProps) => {
  const properties = await notionEvent(db, title, description, startDate, endDate, location, meetingURL, additionalProps)

  return await notion.pages.create({
    parent: {
      database_id: db
    },
    properties: properties
  })
}

const notionUpdateEvent = async (db, pid, title, description, startDate, endDate, location, meetingURL, additionalProps) => {
  const properties = await notionEvent(db, title, description, startDate, endDate, location, meetingURL, additionalProps)

  return await notion.pages.update({
    page_id: pid,
    properties: properties
  })
}

const shutdown = () => {
  log(2, 'Shutting down Notion GCal Sync...')
  process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export { google, oAuth2Client, calendar, figlet, chalk, createSpinner, notion, notionCreateEvent, notionFindPageByTitle, log, notionUpdateEvent, gcals }