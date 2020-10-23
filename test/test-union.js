/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Unions', () => {
  it('keyed union', () => {
    const validator = SchemaValidate.create({
      types: {
        UnionKeyed: {
          kind: 'union',
          representation: {
            keyed: {
              bar: 'Bool',
              foo: 'Int',
              baz: 'String'
            }
          }
        }
      }
    }, 'UnionKeyed')

    assert.isTrue(validator({ foo: 100 }))
    assert.isTrue(validator({ bar: true }))
    assert.isTrue(validator({ baz: 'yep' }))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ foo: 'not an int' }))
    assert.isFalse(validator({ bar: 'not a bool' }))
    assert.isFalse(validator({ baz: true }))
  })

  it('kinded union', () => {
    const validator = SchemaValidate.create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionKinded: {
          kind: 'union',
          representation: {
            kinded: {
              int: 'Foo',
              bool: 'Bar',
              string: 'Baz'
            }
          }
        }
      }
    }, 'UnionKinded')

    assert.isTrue(validator(100))
    assert.isTrue(validator(-100))
    assert.isTrue(validator(true))
    assert.isTrue(validator(false))
    assert.isTrue(validator('yep'))
    assert.isTrue(validator(''))
    assert.isFalse(validator({}))
    assert.isFalse(validator([]))
    assert.isFalse(validator({ foo: 100 }))
    assert.isFalse(validator({ bar: true }))
    assert.isFalse(validator({ baz: 'yep' }))
  })

  it('kinded complex', () => {
    const validator = SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'String'
        },
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: 'Int'
        },
        $link: {
          kind: 'link'
        },
        UnionKinded: {
          kind: 'union',
          representation: {
            kinded: {
              list: '$list',
              map: '$map',
              link: '$link'
            }
          }
        }
      }
    }, 'UnionKinded')

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3]), undefined]) {
      assert.isFalse(validator(obj))
    }

    assert.isTrue(validator(fauxCid))
    assert.isTrue(validator([]))
    assert.isTrue(validator(['', 'a']))
    assert.isFalse(validator(['', 1]))
    assert.isFalse(validator([1, 2]))
    assert.isTrue(validator({}))
    assert.isTrue(validator({ a: 1, b: 2 }))
    assert.isFalse(validator({ a: 'a', b: 2 }))
  })
})
