/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'
import { lint } from './lint.js'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Nested maps and lists', () => {
  it('{String:[&Any]}', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: { link: {} }
          }
        },
        $map: {
          map: {
            keyType: 'String',
            valueType: '$list'
          }
        }
      }
    }, '$map')

    await lint(validator)

    assert.isFalse(validator({ num: 1, str: 'obj' }))
    assert.isFalse(validator({ o: fauxCid }))
    assert.isFalse(validator({ o: fauxCid, t: fauxCid, th: fauxCid }))
    assert.isFalse(validator({ o: 1 }))
    assert.isFalse(validator({ o: 1, t: 2, th: 3 }))
    assert.isFalse(validator({ o: 'one' }))
    assert.isFalse(validator({ o: 'one', t: 'two', th: 'three' }))
    assert.isTrue(validator({ o: [fauxCid], t: [], th: [fauxCid, fauxCid, fauxCid] }))
    assert.isFalse(validator({ o: [fauxCid], t: fauxCid }))
    assert.isFalse(validator({ o: [fauxCid], t: 'obj' }))
    assert.isFalse(validator({ o: [fauxCid], t: true }))
    assert.isTrue(validator({ o: [] }))
    assert.isTrue(validator({ o: [], t: [] }))
    assert.isFalse(validator([{ o: [] }]))
  })

  it('[{String:Int}]', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: 'Int'
          }
        },
        $list: {
          list: {
            valueType: '$map'
          }
        }
      }
    }, '$list')

    await lint(validator)

    assert.isFalse(validator([{ num: 1, str: 'obj' }]))
    assert.isFalse(validator([{ str: 'one' }]))
    assert.isFalse(validator([{}, { str: 'one' }]))
    assert.isTrue(validator([{}]))
    assert.isTrue(validator([{ o: 1 }]))
    assert.isFalse(validator([{ o: 1 }, { str: 'str' }]))
    assert.isTrue(validator([{ o: 1, tw: 2, th: 3 }]))
  })
})
