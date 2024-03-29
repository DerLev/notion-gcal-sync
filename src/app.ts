import {
  chalk,
  gcals,
  dbs,
  dbSettings,
  log,
  sleep,
  calendar,
  notion,
  notionCreateEvent,
  notionUpdateEvent,
  notionUpdateEventEnded,
  notionDeleteEvent,
  notionFindPageByTitle
} from './init'

let omittedNotionItems: string[] = []
let omittedGCalItems: string[] = []

/**
 * Execute a full-sync from Google Calendars to Notion
 * @param {string} gcal The id of the Google Calendar to sync from
 * @param {string} db The id of the Notion database to sync to
 * @param {any} additional Additional fields following https://developers.notion.com/reference/property-value-object
 * @param {string[]} omittedItems Google Calendar event ids omitted from syncing - to prevent infinite sync loops
 * @param {boolean} firstSync Whether the full sync should start the sync loop after finish
 * @returns {Promise<void>}
 */
const fullSync = async (gcal: string, db: string, additional: any, omittedItems: string[], firstSync: boolean) => {
  const currentTime = new Date()

  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)

  const eventsResponse = await calendar.events.list(
    {
      // @ts-ignore
      calendarId: gcal,
      timeMin: currentTime,
      timeMax: oneYearsTime,
      timeZone: process.env.TZ,
      orderBy: 'updated',
      singleEvents: true
    }
  )
  // @ts-ignore
  const events = eventsResponse.data.items
  const eventsMap = await events.map(async (event: any) => {
    let start = event.start.dateTime
    let end = event.end.dateTime
    if(event.start.date) {
      start = event.start.date
      end = undefined
    }

    const checkForOmitted = omittedItems.find(item => item == event.id)
    if(checkForOmitted) return

    const findResponse = await notionFindPageByTitle(db, event.summary, gcal, event.id)
    if(findResponse.results.length) {
      const response = await notionUpdateEvent(
        db,
        findResponse.results[0].id,
        event.summary,
        event.description,
        start,
        end,
        event.location,
        event.hangoutLink,
        gcal,
        event.id,
        additional
      )
      omittedNotionItems.push(response.id)
      await sleep(666)
      return
    }

    const response = await notionCreateEvent(
      db,
      event.summary,
      event.description,
      start,
      end,
      event.location,
      event.hangoutLink,
      gcal,
      event.id,
      additional
    )
    omittedNotionItems.push(response.id)
    await sleep(666)
  })

  Promise.all(eventsMap).then(async () => {
    const notionCurrentTime = currentTime
    notionCurrentTime.setSeconds(0)
    notionCurrentTime.setMilliseconds(0)

    const filters = [
      {
        timestamp: 'last_edited_time',
        last_edited_time: {
          before: notionCurrentTime.toISOString()
        }
      },
      {
        property: dbs[db].date,
        date: {
          after: currentTime.toISOString()
        }
      },
    ]

    if(dbSettings[db].excludeNonGCal == true) filters.push({
      // @ts-ignore see condition above
      property: dbs[db].isGCal,
      checkbox: {
        equals: dbSettings[db].excludePolarity
      }
    })

    const notionResponse = await notion.databases.query({
      database_id: db,
      filter: {
        // @ts-ignore non-sense
        and: filters
      }
    })

    notionResponse.results.map(async (page) => {
      await notionDeleteEvent(page.id)
      await sleep(333)
      return
    })
    if(firstSync == true) {
      startLoop()
    }
  })
}

/**
 * Execute an updating partial sync from Google Calendars to Notion
 * @param {string} gcal The id of the Google Calendar to sync from
 * @param {string} db The id of the Notion databse to sync to
 * @param {any} additional Additional fields following https://developers.notion.com/reference/property-value-object
 * @param {Date} lastUpdateTime The last time there was a sync
 * @param {string[]} omittedItems The Google Calendars event ids ommited from syncing - to prevent infinite sync loops
 * @returns {Promise<void>}
 */
const syncOnGCalUpdate = async (gcal: string, db: string, additional: any, lastUpdateTime: Date, omittedItems: string[]) => {
  const currentTime = new Date()
  
  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)
  
  const eventsResponse = await calendar.events.list(
    {
      // @ts-ignore
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
  // @ts-ignore
  const events = eventsResponse.data.items
  events.map(async (event: any) => {
    let start = event.start.dateTime
    let end = event.end.dateTime
    if(event.start.date) {
      start = event.start.date
      end = undefined
    }

    const checkForOmitted = omittedItems.find(item => item == event.id)
    if(checkForOmitted) return

    const findResponse = await notionFindPageByTitle(db, event.summary, gcal, event.id)
    if(findResponse.results.length) {
      if(event.status != 'cancelled') {
        const response = await notionUpdateEvent(
          db,
          findResponse.results[0].id,
          event.summary,
          event.description,
          start,
          end,
          event.location,
          event.hangoutLink,
          gcal,
          event.id,
          additional
        )
        omittedNotionItems.push(response.id)
      }
      else await notionDeleteEvent(findResponse.results[0].id)
      await sleep(666)
      return
    }

    if(event.status != 'cancelled') {
      const response = await notionCreateEvent(
        db,
        event.summary,
        event.description,
        start,
        end,
        event.location,
        event.hangoutLink,
        gcal,
        event.id,
        additional
      )
      omittedNotionItems.push(response.id)
      await sleep(666)
    }
  })
}

/**
 * Executing an updating partial sync from Notion to Google Calendars and check ended events as "Done" if configured
 * @param {string} db The databse id from Notion to pull data from
 * @param {Date} lastUpdateTime The datetime of the last update
 * @param {string[]} omittedItems Ids of items to be omitted from syncing - to prevent infinite sync loops
 * @returns {Promise<void>}
 */
const syncOnNotionUpdateAndMarkDone = async (db: string, lastUpdateTime: Date, omittedItems: string[]) => {
  if(!dbs[db].gcalID) return

  const oneYearsTime = new Date()
  oneYearsTime.setFullYear(oneYearsTime.getFullYear() + 1)
  oneYearsTime.setDate(oneYearsTime.getDate() - 1)

  const filters = [
    {
      timestamp: 'last_edited_time',
      last_edited_time: {
        after: lastUpdateTime.toISOString()
      }
    },
  ]

  if(dbSettings[db].excludeNonGCal == true) filters.push({
    // @ts-ignore see condition above
    property: dbs[db].isGCal,
    checkbox: {
      equals: dbSettings[db].excludePolarity
    }
  })

  const response = await notion.databases.query({
    database_id: db,
    filter: {
      // @ts-ignore non-sense
      and: filters
    }
  })

  const arr: any[] = []
  response.results.map(item => {
    if(omittedItems.find(oItem => oItem == item.id)) return

    arr.push({
      id: item.id,
      // @ts-ignore
      ...item.properties
    })
  })
  if(arr.length) {
    arr.map(async item => {
      if(!item[dbs[db].date].date.start) return

      let gcalID: string[] = ["", ""]
      let createEvent = true
      // @ts-ignore see condition at top of function
      if(item[dbs[db].gcalID].rich_text.length) {
        createEvent = false
        // @ts-ignore see condition at top of function
        gcalID = item[dbs[db].gcalID].rich_text[0].plain_text.split("$")
      }

      let startDateFormat: Date | string = new Date(item[dbs[db].date].date.start)
      // why is January defined as 0 in .getMonth() ??? WTF ECMAScript! took me a day to figure out
      startDateFormat = startDateFormat.getFullYear() + '-' + String(startDateFormat.getMonth() + 1).padStart(2, '0') + '-' + String(startDateFormat.getDate()).padStart(2, '0')
      const start = item[dbs[db].date].date.end ? item[dbs[db].date].date.start.match(/(\d){4}-(\d){2}-(\d){2}\W/) ? {
        date: item[dbs[db].date].date.start,
        timeZone: process.env.TZ
      } : {
        dateTime: item[dbs[db].date].date.start,
        timeZone: process.env.TZ
      } : {
        date: startDateFormat,
        timeZone: process.env.TZ
      }
      let endDateFormat: Date | string = new Date(item[dbs[db].date].date.start)
      endDateFormat.setDate(endDateFormat.getDate() + 1)
      endDateFormat = endDateFormat.getFullYear() + '-' + String(endDateFormat.getMonth() + 1).padStart(2, '0') + '-' + String(endDateFormat.getDate()).padStart(2, '0')
      const end = item[dbs[db].date].date.end ? item[dbs[db].date].date.end.match(/(\d){4}-(\d){2}-(\d){2}\W/) ? {
        date: item[dbs[db].date].date.end,
        timeZone: process.env.TZ
      } : {
        dateTime: item[dbs[db].date].date.end,
        timeZone: process.env.TZ
      } : {
        date: endDateFormat,
        timeZone: process.env.TZ
      }

      if(createEvent == true) {
        if(dbSettings[db].createOnGCal != true) return
        const targetGCalId = dbSettings[db].targetGCalId

        const additionalProps = gcals.find((cal) => cal.id == targetGCalId)

        const res = await calendar.events.insert({
          calendarId: targetGCalId,
          requestBody: {
            start: start,
            end: end,
            summary: item[dbs[db].title].title[0].plain_text,
            // @ts-ignore see condition below
            location: dbs[db].location ? item[dbs[db].location].rich_text[0] ? item[dbs[db].location].rich_text[0].plain_text : "" : "",
            // @ts-ignore see condition below
            description: dbs[db].description ? item[dbs[db].description].rich_text[0] ? item[dbs[db].description].rich_text[0].plain_text : "" : ""
          }
        })
        await notionUpdateEvent(
          db,
          item.id,
          item[dbs[db].title].title[0].plain_text,
          // @ts-ignore see condition below
          dbs[db].description ? item[dbs[db].description].rich_text[0] ? item[dbs[db].description].rich_text[0].plain_text : "" : "",
          item[dbs[db].date].date.start,
          item[dbs[db].date].date.end,
          // @ts-ignore see condition below
          dbs[db].location ? item[dbs[db].location].rich_text[0] ? item[dbs[db].location].rich_text[0].plain_text : "" : "",
          "",
          targetGCalId,
          res.data.id || "",
          additionalProps?.additional
        )
        omittedGCalItems.push(res.data.id || "")
      } else {
        await calendar.events.update({
          calendarId: gcalID[0],
          eventId: gcalID[1],
          requestBody: {
            start: start,
            end: end,
            summary: item[dbs[db].title].title[0].plain_text,
            // @ts-ignore see condition below
            location: dbs[db].location ? item[dbs[db].location].rich_text[0] ? item[dbs[db].location].rich_text[0].plain_text : "" : "",
            // @ts-ignore see condition below
            description: dbs[db].description ? item[dbs[db].description].rich_text[0] ? item[dbs[db].description].rich_text[0].plain_text : "" : ""
          }
        })
        omittedGCalItems.push(gcalID[1])
      }
    })
  }

  // mark all events that lie in the past as done
  if(dbs[db].eventEnded != null) {
    const responseMark = await notion.databases.query({
      database_id: db,
      filter: {
        and: [
          {
            property: dbs[db].date,
            date: {
              on_or_before: lastUpdateTime.toISOString()
            }
          },
          {
            // @ts-ignore see condition above
            property: dbs[db].eventEnded,
            checkbox: {
              does_not_equal: true
            }
          }
        ]
      }
    })
  
    responseMark.results.map(async event => await notionUpdateEventEnded(db, event.id, true))
  }
}

/**
 * The update-loop
 * @returns {Promise<never>}
 */
const updateLoop = async () => {
  let i = 1
  let j = Number(process.env.SYNC_INTERVAL)
  const fullDay = 1440 / Number(process.env.SYNC_INTERVAL)
  const updateTime = new Date()
  let updateMins = Number(process.env.SYNC_INTERVAL)
  let updateHrs = 0
  if(updateMins > 60) {
    updateHrs = Math.floor(updateMins / 60)
    updateMins -= updateHrs * 60
  }
  updateTime.setHours(updateTime.getHours() - updateHrs, updateTime.getMinutes() - updateMins)

  let gcalUpdateTime = updateTime
  let notionUpdateTime = updateTime

  let oldOmittedGCalItems = omittedGCalItems
  let oldOmittedNotionItems = omittedNotionItems

  // eslint-disable-next-line no-constant-condition
  while(true) {
    const currentTime = new Date()

    if(j == Number(process.env.SYNC_INTERVAL)) {
      // check for full day to execute full-day-sync
      if(i < fullDay) {
        if(currentTime.getSeconds() == 30) {
          oldOmittedGCalItems = omittedGCalItems
          omittedGCalItems = []
          // gcal update
          gcals.map(calendar => syncOnGCalUpdate(calendar.id, calendar.notionDB, calendar.additional, gcalUpdateTime, oldOmittedGCalItems))
          gcalUpdateTime = currentTime
        }
    
        if(currentTime.getSeconds() == 59) {
          oldOmittedNotionItems = omittedNotionItems
          omittedNotionItems = []
          // notion update
          const keys = Object.keys(dbs)
          keys.forEach(async (key) => {
            if(dbSettings[key].syncToGCal == true) syncOnNotionUpdateAndMarkDone(key, notionUpdateTime, oldOmittedNotionItems)
            notionUpdateTime = currentTime
          })
  
          j = 1
          i++
        }
      } else if(currentTime.getSeconds() == 30) {
        oldOmittedGCalItems = omittedGCalItems
        omittedGCalItems = []
        oldOmittedNotionItems = omittedNotionItems
        omittedNotionItems = []
        // full-sync from gcal to notion
        gcals.map(calendar => fullSync(calendar.id, calendar.notionDB, calendar.additional, oldOmittedGCalItems, false))
        gcalUpdateTime = currentTime
        notionUpdateTime = currentTime

        j = 1
        i = 1
      }
    } else if(currentTime.getSeconds() == 59) {
      j++
    }

    await sleep(1000)
  }
}

let doneSyncs = 0
const startLoop = async () => {
  if(doneSyncs < (gcals.length - 1)) doneSyncs++
  else {
    log(2, 'Done!')
    let delay: Date | number = new Date()
    delay = 60000 - delay.getSeconds() * 1000 + delay.getMilliseconds()
    await sleep(delay)
    log(2, 'Entering update loop')
    await updateLoop()
  }
}

const checkDatabaseConfig = async () => {
  const startDate = new Date()
  startDate.setHours(startDate.getHours() - 1)
  const endDate = startDate
  endDate.setMinutes(endDate.getMinutes() + 1)

  const dbsArr = Object.keys(dbs)
  const dbsMap = dbsArr.map(async (db) => {
    try {
      const createRes = await notionCreateEvent(
        db,
        'TESTING DB FIELDS',
        'This is a testing entity. If it still exists after the db check you can delete it.',
        startDate.toISOString(),
        endDate.toISOString(),
        'Your installation of notion-gcal-sync',
        'https://github.com/DerLev/notion-gcal-sync/',
        'test',
        'thisIsATestEvent',
        {}
      )
      await sleep(1000)
      await notionUpdateEventEnded(db, createRes.id, true)
      await sleep(1000)
      await notionDeleteEvent(createRes.id)
    } catch(err: any) {
      log(0, 'The database field check failed. Take a look at the error above ↑↑↑ Erroring id:', chalk.bgBlue(db))
      log(2, 'You now need to look through your configured databases and delete the testing entities 🙄')
      process.exit(1)
    }
    return { db: true }
  })

  return Promise.all(dbsMap)
}

const main = async () => {
  console.log()
  log(2, 'Checking databse config...')
  await checkDatabaseConfig()
  log(2, 'Database config valid.')
  log(2, 'Executing full sync on all Google Calendars...')
  gcals.map(async (calendar) => await fullSync(calendar.id, calendar.notionDB, calendar.additional, [], true))
}
main()
