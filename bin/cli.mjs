#!/usr/bin/env node

import { toJS } from './to-js.mjs'
import Yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const yargs = Yargs(hideBin(process.argv))
  .scriptName('ipld-schema-validator')
  .usage('$0 <cmd> [args]')
  .command('to-js',
    'Accepts .ipldsch files (from file or stdin) and prints a JavaScript module exporting validators for the types',
    (yargs) => {
      return yargs.option('type', {
        default: 'script',
        choices: ['script', 'module'],
        type: 'string',
        describe: '"script" or "module" module type'
      })
    })
  .showHelpOnFail(true)
  .demandCommand(1, 'must provide a valid command')
  .help()

/**
 * @param {(files: string[], options: {})=>Promise<void>} fn
 */
function runCommand (fn) {
  // @ts-ignore
  const args = yargs.argv._.slice(1)
  fn(args, yargs.argv).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}

// @ts-ignore
switch (yargs.argv._[0]) {
  case 'to-js':
    runCommand(toJS)
    break
  default:
    yargs.showHelp()
}
