import dotenv from 'dotenv'
import { google } from 'googleapis'
import figlet from 'figlet'
import chalk from 'chalk'
import { createSpinner } from 'nanospinner'

dotenv.config()

// Initializing OAuth2 and creating access token
const { OAuth2 } = google.auth
const oAuth2Client = new OAuth2( process.env.GOOGLE_CID, process.env.GOOGLE_CS )
oAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_ACCOUNT_REFRESH_TOKEN
})

// Initializing calendar object with OAuth2 client
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

console.log(chalk.cyan(figlet.textSync('Calendars list', { font: 'Small', horizontalLayout: 'controlled smushing' })))
console.log('')
const spinner = createSpinner('Fetching data').start({ color: 'green' })

calendar.calendarList.list(
  {},
  (err, res) => {
    if (err) {
      spinner.error({ text: 'An Error occured' })
      console.log('')
      return console.error(err)
    }

    const cals = res.data.items
    const filteredCals = cals.filter(c => c.accessRole == "writer" || c.accessRole == "owner")

    spinner.success({ text: 'Done' })
    console.log('')

    for (let i = 0; i < filteredCals.length; i++) {
      console.log(
        chalk.bold(chalk.magentaBright(filteredCals[i].summary)), '\n',
        chalk.gray('id:'), chalk.cyanBright(filteredCals[i].primary ? 'primary' : filteredCals[i].id), '\n',
        chalk.gray('primary:'), filteredCals[i].primary ? chalk.green(true) : chalk.red(false), '\n'
      )
    }
  }
)
