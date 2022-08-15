#!/usr/bin/env node

import process from 'process'
import { readFile } from 'fs/promises'
import path from 'path'
import { parse } from 'ipld-schema'
// @ts-ignore
import collectInput from 'ipld-schema/bin/collect-input.js'
import { Builder, safeReference } from 'ipld-schema-validator'

/**
 * @typedef {import('ipld-schema/schema-schema').Schema} Schema
 */

async function version () {
  return JSON.parse(await readFile(path.resolve('package.json'), 'utf8')).version
}

/**
 * @param {string[]} files
 * @param {{ [k in 'type']: 'module'|'script'} | {}} [options]
 */
export async function toJS (files, options) {
  const input = /** @type {{ filename: string, contents: string }[]} */(await collectInput(files))

  /** @type {Schema|null} */
  let schema = null
  for (const { filename, contents } of input) {
    try {
      const parsed = parse(contents)
      if (schema == null) {
        schema = parsed
      } else {
        const copy = (/** @type {'types'} */ coll) => {
          if (schema == null) {
            throw new Error('Unexpected state')
          }
          if (parsed[coll] == null) {
            return
          }
          if (schema[coll] == null) {
            schema[coll] = {}
          }
          for (const [type, defn] of Object.entries(parsed[coll])) {
            if (schema[coll][type]) {
              console.error(`Error: duplicate ${coll} "${type}" found in schema(s)`)
              return process.exit(1)
            }
            schema[coll][type] = defn
          }
        }
        copy('types')
        // TODO: ignoring for now, is it even useful? copy('advanced')
      }
    } catch (err) {
      console.error(`Error parsing ${filename}: ${err}}`)
      process.exit(1)
    }
  }

  if (schema == null) {
    console.error('No input')
    process.exit(1)
  }

  const builder = new Builder(schema)
  const types = Object.keys(schema.types)
  for (const type of types) {
    builder.addType(type)
  }
  const schemaContent = input.map(({ contents }) => contents).join('\n').replace(/^/mg, ' * ').replace(/\s+$/mg, '')
  console.log(`/** Auto-generated with ipld-schema-validator@${await version()} at ${new Date().toDateString()} from IPLD Schema:\n *\n${schemaContent}\n */\n`)
  console.log(builder.dumpValidators())
  for (const type of types) {
    if (options == null || !('type' in options) || options.type === 'module') {
      // cross fingers and hope `type` will be export name compatible!
      console.log(`export const ${type} = Types${safeReference(type)}`)
    } else if (options.type === 'script') {
      console.log(`module.exports${safeReference(type)} = Types${safeReference(type)}`)
    } else {
      throw new Error('Unexpected "type"')
    }
  }
}
