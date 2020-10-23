/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Nested maps and lists', () => {
  it('SimpleStruct with 3 different field kinds', () => {
    const validator = SchemaValidate.create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int' },
            bar: { type: 'Bool' },
            baz: { type: 'String' }
          },
          representation: { map: {} }
        }
      }
    }, 'SimpleStruct')
    assert.isTrue(validator({ foo: 100, bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ foo: 100, bar: true }))
    assert.isFalse(validator({ foo: 100, baz: 'this is baz' }))
    assert.isFalse(validator({ bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({ foo: 100, bar: true, baz: 'this is baz', nope: 1 }))
    assert.isFalse(validator([100, true, 'nope']))
  })

  it('Struct within a struct', () => {
    const validator = SchemaValidate.create({
      types: {
        $struct2: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int' },
            bar: { type: 'Bool' },
            baz: { type: 'String' }
          },
          representation: { map: {} }
        },
        $struct1: {
          kind: 'struct',
          fields: {
            one: { type: 'Int' },
            two: { type: '$struct2' },
            three: { type: 'Link' }
          },
          representation: { map: {} }
        }
      }
    }, '$struct1')
    assert.isTrue(validator({ one: -1, two: { foo: 100, bar: true, baz: 'this is baz' }, three: fauxCid }))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ one: -1, two: {}, three: fauxCid }))
    assert.isFalse(validator({ one: -1, two: [], three: fauxCid }))
  })

  it('Struct with maps and lists and structs', () => {
    const validator = SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'Link'
        },
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: '$list'
        },
        $struct2: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int' },
            bar: { type: 'Bool' },
            baz: { type: '$list' }
          },
          representation: { map: {} }
        },
        $struct1: {
          kind: 'struct',
          fields: {
            one: { type: '$map' },
            two: { type: '$struct2' },
            three: { type: 'Link' }
          },
          representation: { map: {} }
        }
      }
    }, '$struct1')
    assert.isTrue(validator({
      one: { o: [fauxCid], t: [], th: [fauxCid, fauxCid, fauxCid] },
      two: { foo: 100, bar: true, baz: [fauxCid, fauxCid, fauxCid] },
      three: fauxCid
    }))
    assert.isTrue(validator({
      one: {},
      two: { foo: 100, bar: true, baz: [] },
      three: fauxCid
    }))
    assert.isTrue(validator({
      one: {},
      two: { foo: 100, bar: true, baz: [] },
      three: fauxCid,
      four: 'nope'
    }))
    assert.isFalse(validator({}))
  })
})
