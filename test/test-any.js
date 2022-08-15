/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'
import { lint } from './lint.js'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Any', () => {
  it('AnyScalar', async () => {
    const validator = create({ types: {} }, 'AnyScalar')

    await lint(validator)

    for (const obj of [1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3])]) {
      assert.isTrue(validator(obj), `obj: ${obj} == 'AnyScalar'`)
    }

    assert.isFalse(validator({}))
    assert.isFalse(validator([]))
    assert.isFalse(validator({ a: 'str' }))
    assert.isFalse(validator(['str']))
  })

  it('{String:AnyScalar}', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: 'AnyScalar'
          }
        }
      }
    }, '$map')

    await lint(validator)

    for (const obj of [1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3])]) {
      assert.isTrue(validator({ a: obj }), `{a:obj}: ${obj} == 'AnyScalar'`)
      assert.isTrue(validator({ a: obj, b: obj }), `{a:obj, b:obj}: ${obj} == 'AnyScalar'`)
      assert.isTrue(validator({ a: obj, b: 100 }), `{a:obj, b:100}: ${obj} == 'AnyScalar'`)
    }

    assert.isTrue(validator({}))
    assert.isFalse(validator([]))
    assert.isFalse(validator(['str']))
    assert.isFalse(validator({ a: {} }))
    assert.isFalse(validator({ a: [] }))
  })

  it('[AnyScalar]', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: 'AnyScalar'
          }
        }
      }
    }, '$list')

    await lint(validator)

    for (const obj of [1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3])]) {
      assert.isTrue(validator([obj]), `[obj]: ${obj} == 'AnyScalar'`)
      assert.isTrue(validator([obj, obj]), `[obj,obj]: ${obj} == 'AnyScalar'`)
      assert.isTrue(validator([obj, 100]), `[obj,100]: ${obj} == 'AnyScalar'`)
    }

    assert.isTrue(validator([]))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ a: 'str' }))
    assert.isFalse(validator([{}]))
    assert.isFalse(validator([[]]))
  })

  it('Any', async () => {
    const validator = create({ types: {} }, 'Any')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), {}, { a: 1 }, { a: 'str', b: 2 }, { a: 'str' }, [], [1], ['str', 2], ['str']]) {
      assert.isTrue(validator(obj), `obj: ${obj} == 'Any'`)
    }

    assert.isTrue(validator({ a: { b: [1] } }))
    assert.isTrue(validator([[[[[{}]]]]]))
    assert.isFalse(validator(undefined))
    assert.isFalse(validator([undefined, undefined]))
    assert.isFalse(validator({ a: undefined }))
  })
})
