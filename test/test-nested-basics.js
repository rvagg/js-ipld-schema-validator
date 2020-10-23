/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Nested maps and lists', () => {
  it('{String:[&Any]}', () => {
    const validator = SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: { kind: 'link' }
        },
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: '$list'
        }
      }
    }, '$map')

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

  it('[{String:Int}]', () => {
    const validator = SchemaValidate.create({
      types: {
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: 'Int'
        },
        $list: {
          kind: 'list',
          valueType: '$map'
        }
      }
    }, '$list')

    assert.isFalse(validator([{ num: 1, str: 'obj' }]))
    assert.isFalse(validator([{ str: 'one' }]))
    assert.isFalse(validator([{}, { str: 'one' }]))
    assert.isTrue(validator([{}]))
    assert.isTrue(validator([{ o: 1 }]))
    assert.isFalse(validator([{ o: 1 }, { str: 'str' }]))
    assert.isTrue(validator([{ o: 1, tw: 2, th: 3 }]))
  })
})
