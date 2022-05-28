import { calendar, createSpinner } from './init.js'

// testing code => creating an event

const eventStartTime = new Date()
eventStartTime.setDate(eventStartTime.getDate() + 2)

const eventEndTime = new Date()
eventEndTime.setDate(eventEndTime.getDate() + 2)
eventEndTime.setMinutes(eventEndTime.getMinutes() + 45)

const event = {
  summary: 'Test event from code',
  start: {
    dateTime: eventStartTime,
    timeZone: process.env.TIMEZONE
  },
  end: {
    dateTime: eventEndTime,
    timeZone: process.env.TIMEZONE
  }
}

console.log()
const spinner = createSpinner('Checking for availability').start({ color: 'green' })

calendar.freebusy.query(
  {
    resource: {
      timeMin: eventStartTime,
      timeMax: eventEndTime,
      timeZone: process.env.TIMEZONE,
      items: [{ id: 'primary' }],
    },
  },
  (err, res) => {
    // Check for errors in our query and log them if they exist.
    if (err) {
      spinner.error({ text: 'Free Busy Query Error' })
      return console.error(err)
    }

    // Create an array of all events on our calendar during that time.
    const eventArr = res.data.calendars['primary'].busy

    // Check if event array is empty which means we are not busy
    if (eventArr.length === 0) {
      spinner.start({ text: 'Adding Event', color: 'green' })
      // If we are not busy create a new calendar event.
      return calendar.events.insert(
        { calendarId: 'primary', resource: event },
        err => {
          // Check for errors and log them if they exist.
          if (err) {
            spinner.error({ text: 'Error Creating Calender Event' })
            return console.error(err)
          }
          // Else log that the event was created.
          return spinner.success({ text: 'Calendar event successfully created' })
        }
      )
    }
    // If event array is not empty log that we are busy.
    return spinner.warn({ text: 'Busy at that time' })
  }
)
