/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Any', () => {
  it('AnyScalar', () => {
    const validator = SchemaValidate.create({ types: {} }, 'AnyScalar')
    for (const obj of [1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3])]) {
      assert.isTrue(validator(obj), `obj: ${obj} == 'AnyScalar'`)
    }

    assert.isFalse(validator({}))
    assert.isFalse(validator([]))
    assert.isFalse(validator({ a: 'str' }))
    assert.isFalse(validator(['str']))
  })

  it('{String:AnyScalar}', () => {
    const validator = SchemaValidate.create({
      types: {
        $map: {
          kind: 'map',
          keyType: 'String',
          valueType: 'AnyScalar'
        }
      }
    }, '$map')
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

  it('[AnyScalar]', () => {
    const validator = SchemaValidate.create({
      types: {
        $list: {
          kind: 'list',
          valueType: 'AnyScalar'
        }
      }
    }, '$list')
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

  it('Any', () => {
    const validator = SchemaValidate.create({ types: {} }, 'Any')
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
