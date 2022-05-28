import { calendar, chalk, createSpinner, figlet } from './init.js'

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
