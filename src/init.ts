import dotenv from 'dotenv'
import { google } from 'googleapis'
import figlet from 'figlet'
import chalk from 'chalk'
import { createSpinner } from 'nanospinner'
import { Client } from '@notionhq/client'
import Joi from 'joi'

interface dbsConfig {
  [key: string]: {
    title: string
    description: string
    date: string
    location: string
    meetingURL: string
    lastEdited: string
    gcalID: string
    eventEnded: string
    additional: {
      [key: string]: any
    }
  }
}

interface gcalConfig {
  id: string,
  notionDB: string,
  additional: {
    [key: string]: any
  }
}

/* eslint-disable @typescript-eslint/no-var-requires */
const dbs: dbsConfig = require('../config/dbs.js')
const gcals: gcalConfig[] = require('../config/gcal-sync.js')
/* eslint-enable */

dotenv.config()

// Initializing OAuth2 and creating access token
const { OAuth2 } = google.auth
const oAuth2Client = new OAuth2( process.env.GOOGLE_CID, process.env.GOOGLE_CS )
oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ACCOUNT_REFRESH_TOKEN
})

// Initializing calendar object with OAuth2 client
const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

// Initializing Notion application with set token
const notion = new Client({ auth: process.env.NOTION_TOKEN })

// Printing title
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

/**
 * Prints out a log message with date, time and log-level
 * @param {number} level The log-level - 0: critical; 1: warning; 2: info; 3: output/debug
 * @param {any} text The message test
 * @param  {...any} moreText More text for the log message
 */
const log = (level: number, text: any, ...moreText: any) => {
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

  console.log(logLevel, chalk.gray(time.toLocaleString()), text, ...moreText)
}

// check dbs.js file for correct formatting
const dbsSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().allow(null).required(),
  date: Joi.string().required(),
  location: Joi.string().allow(null).required(),
  meetingURL: Joi.string().allow(null).required(),
  lastEdited: Joi.string().allow(null).required(),
  gcalID: Joi.when('lastEdited', {
    is: Joi.string(),
    then: Joi.string().required(),
    otherwise: Joi.valid(null).required()
  }),
  eventEnded: Joi.string().allow(null).required(),
  additional: Joi.object().required()
})

interface dbSettings {
  [key: string]: {
    syncToGCal: boolean
  }
}

const dbKeys = Object.keys(dbs)
const dbSettings: dbSettings = {}
dbKeys.forEach((key) => {
  const { error } = dbsSchema.validate(dbs[key])
  if(error) {
    log(0, chalk.bgGreen('dbs.json') + ' > ' + chalk.bgBlue(key) + ' > ' + chalk.bgRedBright(error.details[0].message))
    process.exit(1)
  }
  dbSettings[key] = {
    syncToGCal: dbs[key].lastEdited != null ? true : false
  }
})

// check gcal-sync.js file for correct formatting
const gcalsSchema = Joi.object({
  id: Joi.string().required(),
  notionDB: Joi.string().required(),
  additional: Joi.object().required()
})

gcals.map((_, index) => {
  const { error } = gcalsSchema.validate(gcals[index])
  if(error) {
    log(0, chalk.bgGreen('gcal-sync.json') + ' > ' + chalk.bgBlue('Index: ' + index) + ' > ' + chalk.bgRedBright(error.details[0].message))
    process.exit(1)
  }
})

/**
 * A sleeper function
 * @param {number} ms The millisceonds to wait
 * @returns {Promise<any>}
 */
const sleep = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

/**
 * This function tries to find a page in a Notion database by it's title OR when configured it's event ids
 * @param {string} db The id of the Notion database
 * @param {string} title The title of the page to be found
 * @param {string} gcalId The Google Calendars calendar id
 * @param {string} eventId The id of the Google Calendar Event
 * @returns {Promise<QueryDatabaseResponse>}
 */
const notionFindPageByTitle = async (db: string, title: string, gcalId: string, eventId: string) => {
  if(!dbs[db]) throw 'Database not defined'

  if(dbs[db].gcalID != null) {
    return await notion.databases.query({
      database_id: db,
      filter: {
        property: dbs[db].gcalID,
        rich_text: {
          equals: gcalId + '$' + eventId
        }
      }
    })
  } else {
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
}

interface eventProperties {
  [key: string]: any
}

/**
 * Helper function for generating page properties for notion
 * @param {string} db
 * @param {string} title
 * @param {string} description
 * @param {(string | Date)} startDate
 * @param {(string | Date)} endDate
 * @param {string} location
 * @param {string} meetingURL
 * @param {string} gcalID
 * @param {string} evntID
 * @param {any} additionalProps
 * @yields {*}
 */
const notionEvent = (
  db: string,
  title: string,
  description: string,
  startDate: string | Date,
  endDate: string | Date,
  location: string,
  meetingURL: string,
  gcalID: string,
  evntID: string,
  additionalProps: any
) => {
  if(!dbs[db]) throw 'Database not defined'
  if(!title) throw 'There has to be a title set'

  const properties: eventProperties = {
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

  if(dbs[db].gcalID != null) {
    if(gcalID && evntID) properties[dbs[db].gcalID] = {
      rich_text: [
        { type: 'text', text: { content: gcalID + '$' + evntID } }
      ]
    }
    else properties[dbs[db].gcalID] = {
      rich_text: [
        { type: 'text', text: { content: '' } }
      ]
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

/**
 * This function creates an event in Notion originating from Google Calendars
 * @param {string} db The database id from Notion
 * @param {string} title Title of the event
 * @param {string} description Description of the event
 * @param {(string | Date)} startDate The starting date - either Date object or string with 'yyyy-mm-dd' template
 * @param {(string | Date)} endDate The ending date of the event - either Date object or string with 'yyyy-mm-dd' template
 * @param {string} location The location field
 * @param {string} meetingURL The URL for an attached meeting
 * @param {string} gcalID The id of the Google Calendar
 * @param {string} eventID The id of the Google Calendar event
 * @param {any} additionalProps Additional props following https://developers.notion.com/reference/property-value-object
 * @returns {Promise<CreatePageResponse>}
 */
const notionCreateEvent = async (
  db: string,
  title: string,
  description: string,
  startDate: string | Date,
  endDate: string | Date,
  location: string,
  meetingURL: string,
  gcalID: string,
  eventID: string,
  additionalProps: any
) => {
  const properties = notionEvent(db, title, description, startDate, endDate, location, meetingURL, gcalID, eventID, additionalProps)

  return await notion.pages.create({
    parent: {
      database_id: db
    },
    properties: properties
  })
}

/**
 * This function updates an event in Notion originating from Google Calendars
 * @param {string} db The database id from Notion
 * @param {string} title Title of the event
 * @param {string} description Description of the event
 * @param {(string | Date)} startDate The starting date - either Date object or string with 'yyyy-mm-dd' template
 * @param {(string | Date)} endDate The ending date of the event - either Date object or string with 'yyyy-mm-dd' template
 * @param {string} location The location field
 * @param {string} meetingURL The URL for an attached meeting
 * @param {string} gcalID The id of the Google Calendar
 * @param {string} eventID The id of the Google Calendar event
 * @param {any} additionalProps Additional props following https://developers.notion.com/reference/property-value-object
 * @returns {Promise<UpdatePageResponse>}
 */
const notionUpdateEvent = async (
  db: string,
  pid: string,
  title: string,
  description: string,
  startDate: string | Date,
  endDate: string | Date,
  location: string,
  meetingURL: string,
  gcalID: string,
  eventID: string,
  additionalProps: any
) => {
  const properties = notionEvent(db, title, description, startDate, endDate, location, meetingURL, gcalID, eventID, additionalProps)

  return await notion.pages.update({
    page_id: pid,
    properties: properties
  })
}

/**
 * This function updates an event's "Done" checkbox in a Notion database
 * @param {string} db The id of the Notion database
 * @param {string} pid The id of the page to be updated
 * @param {boolean} ended The value of the cehckbox to be set
 * @returns {(Promise<UpdatePageResponse> | void)}
 */
const notionUpdateEventEnded = async (db: string, pid: string, ended: boolean) => {
  const properties: eventProperties = {}

  if(dbs[db].eventEnded != null) {
    properties[dbs[db].eventEnded] = {
      checkbox: ended
    }

    return await notion.pages.update({
      page_id: pid,
      properties: properties
    })
  }
}

/**
 * This function deletes a page / event in Notion
 * @param {string} pid The id of the page in Notion to be deleted
 * @returns {Promise<UpdatePageResponse>}
 */
const notionDeleteEvent = async (pid: string) => {
  return await notion.pages.update({
    page_id: pid,
    archived: true
  })
}

const shutdown = () => {
  log(2, 'Shutting down Notion GCal Sync...')
  process.exit()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

export {
  figlet,
  createSpinner,
  chalk,
  gcals,
  dbs,
  dbSettings,
  google,
  oAuth2Client,
  calendar,
  notion,
  log,
  sleep,
  notionCreateEvent,
  notionUpdateEvent,
  notionUpdateEventEnded,
  notionDeleteEvent,
  notionFindPageByTitle
}
