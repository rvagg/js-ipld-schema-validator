/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Enums', () => {
  it('string', () => {
    const validator = create({
      types: {
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: { string: {} }
        }
      }
    }, 'SimpleEnum')

    assert.isTrue(validator('Foo'))
    assert.isTrue(validator('Bar'))
    assert.isTrue(validator('Baz'))
    assert.isFalse(validator('Blip'))
    assert.isFalse(validator(''))
    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), {}, { a: 1 }, { a: 'str', b: 2 }, { a: 'str' }, [], [1], ['str', 2], ['str']]) {
      assert.isFalse(validator(obj), `obj: ${obj} == 'SimpleEnum'`)
    }
  })

  it('string renames', () => {
    const validator = create({
      types: {
        SimpleEnumWithValues: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: {
            string: {
              Foo: 'f',
              Baz: 'b'
            }
          }
        }
      }
    }, 'SimpleEnumWithValues')

    assert.isTrue(validator('f'))
    assert.isFalse(validator('Foo'))
    assert.isTrue(validator('Bar'))
    assert.isTrue(validator('b'))
    assert.isFalse(validator('Baz'))
    assert.isFalse(validator('Blip'))
    assert.isFalse(validator(''))
    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), {}, { a: 1 }, { a: 'str', b: 2 }, { a: 'str' }, [], [1], ['str', 2], ['str']]) {
      assert.isFalse(validator(obj), `obj: ${obj} == 'SimpleEnum'`)
    }
  })

  it('int', () => {
    const validator = create({
      types: {
        SimpleEnum: {
          kind: 'enum',
          members: {
            Foo: null,
            Bar: null,
            Baz: null
          },
          representation: {
            int: {
              Foo: 0,
              Bar: 1,
              Baz: 100
            }
          }
        }
      }
    }, 'SimpleEnum')

    assert.isTrue(validator(0))
    assert.isTrue(validator(1))
    assert.isTrue(validator(100))
    assert.isFalse(validator(-1))
    assert.isFalse(validator(-100))
    assert.isFalse(validator(10))
    assert.isFalse(validator('Foo'))
    assert.isFalse(validator('Bar'))
    assert.isFalse(validator('Baz'))
    assert.isFalse(validator('Blip'))
    assert.isFalse(validator(''))
    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), {}, { a: 1 }, { a: 'str', b: 2 }, { a: 'str' }, [], [1], ['str', 2], ['str']]) {
      assert.isFalse(validator(obj), `obj: ${obj} == 'SimpleEnum'`)
    }
  })
})
