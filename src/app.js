import { calendar, notionCreateEvent, notionFindPageByTitle, log, notionUpdateEvent, gcals, notionDeleteEvent, dbSettings, dbs, notion } from './init.js'

let omittedNotionItems = []
let omittedGCalItems = []

const fullSync = async (gcal, db, additional, omittedItems) => {
  const currentTime = new Date()

  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)

  const events = await calendar.events.list(
    {
      calendarId: gcal,
      timeMin: currentTime,
      timeMax: oneYearsTime,
      timeZone: process.env.TZ,
      orderBy: 'updated',
      singleEvents: true
    }
  )
  events.data.items.map(async e => {
    let start = e.start.dateTime
    let end = e.end.dateTime
    if(e.start.date) {
      start = e.start.date
      end = undefined
    }

    const checkForOmitted = omittedItems.find(item => item == e.id)
    if(checkForOmitted) return

    const findResponse = await notionFindPageByTitle(db, e.summary, gcal, e.id)
    if(findResponse.results.length) {
      const response = await notionUpdateEvent(db, findResponse.results[0].id, e.summary, e.description, start, end, e.location, e.hangoutLink, gcal, e.id, additional)
      omittedNotionItems.push(response.id)
      return
    }

    const response = await notionCreateEvent(db, e.summary, e.description, start, end, e.location, e.hangoutLink, gcal, e.id, additional)
    omittedNotionItems.push(response.id)
  })
}

const syncOnGCalUpdate = async (gcal, db, additional, lastUpdateTime, omittedItems) => {
  const currentTime = new Date()
  
  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)
  
  const events = await calendar.events.list(
    {
      calendarId: gcal,
      timeMin: currentTime,
      timeMax: oneYearsTime,
      timeZone: process.env.TZ,
      orderBy: 'updated',
      singleEvents: true,
      updatedMin: lastUpdateTime,
      showDeleted: true
    }
  )

  events.data.items.map(async e => {
    let start = e.start.dateTime
    let end = e.end.dateTime
    if(e.start.date) {
      start = e.start.date
      end = undefined
    }

    const checkForOmitted = omittedItems.find(item => item == e.id)
    if(checkForOmitted) return

    const findResponse = await notionFindPageByTitle(db, e.summary, gcal, e.id)
    if(findResponse.results.length) {
      if(e.status != 'cancelled') {
        const response = await notionUpdateEvent(db, findResponse.results[0].id, e.summary, e.description, start, end, e.location, e.hangoutLink, gcal, e.id, additional)
        omittedNotionItems.push(response.id)
      }
      else await notionDeleteEvent(findResponse.results[0].id)
      return
    }

    if(e.status != 'cancelled') {
      const response = await notionCreateEvent(db, e.summary, e.description, start, end, e.location, e.hangoutLink, gcal, e.id, additional)
      omittedNotionItems.push(response.id)
    }
  })
}

const syncOnNotionUpdate = async (db, lastUpdateTime, omittedItems) => {
  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)
  
  const omitted = {}
  omittedItems.map(i => omitted[i] = true)

  const response = await notion.databases.query({
    database_id: db,
    filter: {
      property: dbs[db].lastEdited,
      last_edited_time: {
        after: lastUpdateTime.toISOString()
      }
    }
  })

  const arr = []
  response.results.map(i => {
    if(omitted[i.id] == true) return

    arr.push({
      id: i.id,
      ...i.properties
    })
  })
  if(arr.length) {
    arr.map(async i => {
      const gcalID = i[dbs[db].gcalID].rich_text[0].plain_text.split("$")

      let startDateFormat = new Date(i[dbs[db].date].date.start)
      // why is January defined as 0 in .getMonth() ??? WTF ECMAScript! took me a day to figure out
      startDateFormat = startDateFormat.getFullYear() + '-' + String(startDateFormat.getMonth() + 1).padStart(2, '0') + '-' + String(startDateFormat.getDate()).padStart(2, '0')
      const start = i[dbs[db].date].date.end ? i[dbs[db].date].date.start.match(/(\d){4}-(\d){2}-(\d){2}\W/) ? {
        date: i[dbs[db].date].date.start,
        timeZone: process.env.TZ
      } : {
        dateTime: i[dbs[db].date].date.start,
        timeZone: process.env.TZ
      } : {
        date: startDateFormat,
        timeZone: process.env.TZ
      }
      let startToEnd = new Date(i[dbs[db].date].date.start)
      startToEnd.setDate(startToEnd.getDate() + 1)
      startToEnd = startToEnd.getFullYear() + '-' + String(startToEnd.getMonth() + 1).padStart(2, '0') + '-' + String(startToEnd.getDate()).padStart(2, '0')
      const end = i[dbs[db].date].date.end ? i[dbs[db].date].date.end.match(/(\d){4}-(\d){2}-(\d){2}\W/) ? {
        date: i[dbs[db].date].date.end,
        timeZone: process.env.TZ
      } : {
        dateTime: i[dbs[db].date].date.end,
        timeZone: process.env.TZ
      } : {
        date: startToEnd,
        timeZone: process.env.TZ
      }

      // TODO: fix error with all-day events
      const res = await calendar.events.update({
        calendarId: gcalID[0],
        eventId: gcalID[1],
        requestBody: {
          start: start,
          end: end,
          summary: i[dbs[db].title].title[0].plain_text,
          location: i[dbs[db].location].rich_text[0].plain_text,
          description: i[dbs[db].description].rich_text[0].plain_text
        }
      })
      omittedGCalItems.push(gcalID[1])
    })
  }
}

const sleep = (ms = 1000) => new Promise((r) => setTimeout(r, ms))

const updateLoop = async () => {
  let i = 1
  const fullDay = 1440 / process.env.SYNC_INTERVAL
  let lastUpdateTime = new Date()
  let updateMins = process.env.SYNC_INTERVAL
  let updateHrs = 0
  if(updateMins > 60) {
    updateHrs = Math.floor(updateMins / 60)
    updateMins -= updateHrs * 60
  }
  lastUpdateTime.setHours(lastUpdateTime.getHours() - updateHrs, lastUpdateTime.getMinutes() - updateMins)

  while(true) {
    let newUpdateTime = new Date()
    let oldOmittedGCalItems = omittedGCalItems
    let oldOmittedNotionItems = omittedNotionItems

    omittedGCalItems = []
    omittedNotionItems = []
    // perform a full sync every 24h
    if(i < fullDay) {
      gcals.map(async c => await syncOnGCalUpdate(c.id, c.notionDB, c.additional, lastUpdateTime, oldOmittedGCalItems))

      const keys = Object.keys(dbs)
      keys.forEach(async (key) => {
        if(dbSettings[key].syncToGCal == true) await syncOnNotionUpdate(key, lastUpdateTime, oldOmittedNotionItems)
      })
    }
    else gcals.map(async c => await fullSync(c.id, c.notionDB, c.additional, oldOmittedGCalItems))

    lastUpdateTime = newUpdateTime
    i++
    await sleep(process.env.SYNC_INTERVAL * 60 * 1000)
  }
}

console.log()
log(2, 'Executing full sync on all Google Calendars...')
const fullSyncResponse = gcals.map(async c => await fullSync(c.id, c.notionDB, c.additional, []))
Promise.all(fullSyncResponse).then(async () => {
  log(2, 'Done!')
  let delay = new Date()
  delay = 59000 - ( delay.getSeconds() > 58 ? - delay.getMilliseconds() : delay.getSeconds() * 1000 + delay.getMilliseconds() )
  await sleep(delay)
  log(2, 'Entering update loop')
  await updateLoop()
})
