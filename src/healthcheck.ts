import dotenv from 'dotenv'
import { google } from 'googleapis'
import { Client } from '@notionhq/client'

interface dbsConfig {
  [key: string]: {
    title: string
    description: string | null
    date: string
    location: string | null
    meetingURL: string | null
    gcalID: string | null
    eventEnded: string | null
    isGCal: string | null
    additional: {
      [key: string]: any
    }
    config: {
      createEvents: {
        enabled: boolean
        targetGCalId: string | null
      }
      excludeNonGCal: {
        enabled: boolean
        polarity: boolean | null
      }
    }
  }
}

/* eslint-disable @typescript-eslint/no-var-requires */
const dbs: dbsConfig = require('../config/dbs.js')
/* eslint-enable */

dotenv.config()

const main = async () => {
  try {
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
  
    // checking google calendar for output
    const currentTime = new Date()

    const oneYearsTime = new Date()
    oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
    oneYearsTime.setDate(oneYearsTime.getDate() - 1)

    const gcalResponse = await calendar.events.list(
      {
        // @ts-ignore
        calendarId: 'primary',
        timeMin: currentTime,
        timeMax: oneYearsTime,
        timeZone: process.env.TZ,
        orderBy: 'updated',
        singleEvents: true
      }
    )
    if(!gcalResponse) throw 'No response from google apis'

    // checking notion for output
    const dbIds = Object.keys(dbs)

    const notionResponse = await notion.databases.query({
      database_id: dbIds[0],
      filter: {
        timestamp: 'last_edited_time',
        last_edited_time: {
          after: currentTime.toISOString()
        }
      }
    })
    if(!notionResponse) throw 'No response from notion api'
  
    console.log('Everthing working')
    process.exit(0) // healthy container
  } catch(err) {
    console.error(err)
    process.exit(1) // unhealthy container
  }
}
main()
