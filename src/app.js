import { calendar, notionCreateEvent, notionFindPageByTitle, log, notionUpdateEvent, gcals, notionDeleteEvent } from './init.js'

const fullSync = async (gcal, db, additional) => {
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

    const response = await notionFindPageByTitle(db, e.summary)
    if(response.results.length) {
      await notionUpdateEvent(db, response.results[0].id, e.summary, e.description, start, end, e.location, e.hangoutLink, additional)
      return
    }

    await notionCreateEvent(db, e.summary, e.description, start, end, e.location, e.hangoutLink, additional)
  })
}

const syncOnGCalUpdate = async (gcal, db, additional, lastUpdateTime) => {
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

    const response = await notionFindPageByTitle(db, e.summary)
    if(response.results.length) {
      if(e.status != 'cancelled') await notionUpdateEvent(db, response.results[0].id, e.summary, e.description, start, end, e.location, e.hangoutLink, additional)
      else await notionDeleteEvent(response.results[0].id)
      return
    }

    if(e.status != 'cancelled') await notionCreateEvent(db, e.summary, e.description, start, end, e.location, e.hangoutLink, additional)
  })
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
  let firstSync = true

  while(true) {
    let newUpdateTime = new Date()
    // perform a full sync every 24h
    if(i < fullDay) gcals.map(async c => await syncOnGCalUpdate(c.id, c.notionDB, c.additional, lastUpdateTime))
    else gcals.map(async c => await fullSync(c.id, c.notionDB, c.additional))
    if(firstSync == true) firstSync = false
    else lastUpdateTime = newUpdateTime
    i++
    await sleep(process.env.SYNC_INTERVAL * 60 * 1000)
  }
}

console.log()
log(2, 'Executing full sync on all Google Calendars...')
const fullSyncResponse = gcals.map(async c => await fullSync(c.id, c.notionDB, c.additional))
Promise.all(fullSyncResponse).then(async () => {
  log(2, 'Done!')
  await sleep(5000)
  log(2, 'Entering update loop')
  await updateLoop()
})
