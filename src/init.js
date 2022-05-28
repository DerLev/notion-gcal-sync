import dotenv from 'dotenv'
import { google } from 'googleapis'
import figlet from 'figlet'
import chalk from 'chalk'
import { createSpinner } from 'nanospinner'

dotenv.config()

const { OAuth2 } = google.auth

const oAuth2Client = new OAuth2( process.env.GOOGLE_CID, process.env.GOOGLE_CS )

oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ACCOUNT_REFRESH_TOKEN
})

const calendar = google.calendar({ version: 'v3', auth: oAuth2Client })

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

export { google, oAuth2Client, calendar, figlet, chalk, createSpinner }