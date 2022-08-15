/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'
import { lint } from './lint.js'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Base kinds', () => {
  it('null', async () => {
    const validator = create({ types: {} }, 'Null')

    await lint(validator)

    for (const obj of [101, 1.01, 'a string', false, true, fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'null'`)
    }
    assert.isTrue(validator(null))
  })

  it('int', async () => {
    const validator = create({ types: {} }, 'Int')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 'a string', false, true, fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'int'`)
    }
    assert.isTrue(validator(101))
    assert.isTrue(validator(-101))
    assert.isTrue(validator(0))
  })

  it('float', async () => {
    const validator = create({ types: {} }, 'Float')

    await lint(validator)

    for (const obj of [null, 'a string', false, true, fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'float'`)
    }
    assert.isTrue(validator(1.01))
    assert.isTrue(validator(-1.01))
    // sad, but unavoidable
    assert.isTrue(validator(0))
    assert.isTrue(validator(100))
    assert.isTrue(validator(-100))
  })

  it('string', async () => {
    const validator = create({ types: {} }, 'String')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, false, true, fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'string'`)
    }
    assert.isTrue(validator('a string'))
    assert.isTrue(validator(''))
  })

  it('bool', async () => {
    const validator = create({ types: {} }, 'Bool')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'bool'`)
    }
    assert.isTrue(validator(false))
    assert.isTrue(validator(true))
  })

  it('bytes', async () => {
    const validator = create({ types: {} }, 'Bytes')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'bytes'`)
    }
    assert.isTrue(validator(Uint8Array.from([1, 2, 3])))
    assert.isTrue(validator(new Uint8Array(0)))
  })

  it('link', async () => {
    const validator = create({ types: {} }, 'Link')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, new Uint8Array(0), Uint8Array.from([1, 2, 3]), [1, 2, 3], { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'link'`)
    }
    assert.isTrue(validator(fauxCid))
  })

  /* can't use recursive kind names
  it('list', async () => {
    const validator = create({ types: {} }, 'List')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'list'`)
    }
    assert.isTrue(validator([1, 2, 3]))
    assert.isTrue(validator([1, 'one', true, null]))
    assert.isTrue(validator([]))
  })

  it('map', async () => {
    const validator = create({ types: {} }, 'Map')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), [1, 2, 3], undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != 'map'`)
    }
    assert.isTrue(validator({ obj: 'yep' }))
    assert.isTrue(validator({}))
    assert.isTrue(validator(Object.create(null)))
  })
  */
})

describe('List types', () => {
  it('[String:String]', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: 'String'
          }
        }
      }
    }, '$list')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '[String:String]'`)
    }
    assert.isFalse(validator([1, 'one', true]))
    assert.isFalse(validator([0]))
    assert.isFalse(validator([1, 2, 3]))
    assert.isFalse(validator([fauxCid, fauxCid, fauxCid]))
    assert.isTrue(validator(['one']))
    assert.isTrue(validator(['one', 'two', 'three']))
    assert.isTrue(validator([]))
  })

  it('[String:Int]', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: 'Int'
          }
        }
      }
    }, '$list')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '[String:Int]'`)
    }
    assert.isFalse(validator([1, 'one', true]))
    assert.isFalse(validator(['one']))
    assert.isFalse(validator(['one', 'two', 'three']))
    assert.isFalse(validator([fauxCid, fauxCid, fauxCid]))
    assert.isTrue(validator([0]))
    assert.isTrue(validator([1, 2, 3]))
    assert.isTrue(validator([]))
  })

  it('[String:nullable String]', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: 'String',
            valueNullable: true
          }
        }
      }
    }, '$list')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '[String:String]'`)
    }
    assert.isFalse(validator([1, 'one', true]))
    assert.isFalse(validator([0]))
    assert.isFalse(validator([1, 2, 3]))
    assert.isFalse(validator([fauxCid, fauxCid, fauxCid]))
    assert.isTrue(validator(['one']))
    assert.isTrue(validator(['one', 'two', 'three']))
    assert.isTrue(validator(['one', null, 'three']))
    assert.isTrue(validator([null]))
    assert.isTrue(validator([null, null]))
    assert.isTrue(validator([]))
  })

  it('[String:&Any]', async () => {
    const validator = create({
      types: {
        $list: {
          list: {
            valueType: { link: {} }
          }
        }
      }
    }, '$list')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), { obj: 'nope' }, undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '[String:&Any]'`)
    }
    assert.isFalse(validator([1, 'one', true]))
    assert.isFalse(validator([0]))
    assert.isFalse(validator([1, 2, 3]))
    assert.isFalse(validator(['one']))
    assert.isFalse(validator(['one', 'two', 'three']))
    assert.isTrue(validator([fauxCid, fauxCid, fauxCid]))
    assert.isTrue(validator([]))
  })
})

describe('Map types', () => {
  it('{String:String}', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: 'String'
          }
        }
      }
    }, '$map')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), [1, 2, 3], [1, 'one', true], undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '{String:String}'`)
    }
    assert.isFalse(validator({ num: 1, str: 'obj' }))
    assert.isFalse(validator({ o: fauxCid }))
    assert.isFalse(validator({ o: fauxCid, t: fauxCid, th: fauxCid }))
    assert.isFalse(validator({ o: 1 }))
    assert.isFalse(validator({ o: 1, t: 2, th: 3 }))
    assert.isTrue(validator({ o: 'one' }))
    assert.isTrue(validator({ o: 'one', t: 'two', th: 'three' }))
    assert.isTrue(validator({}))
  })

  it('{String:Int}', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: 'Int'
          }
        }
      }
    }, '$map')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), ['one', 'two', 'three'], [1, 'one', true], undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '{String:Int}'`)
    }
    assert.isFalse(validator({ num: 1, str: 'obj' }))
    assert.isFalse(validator({ o: fauxCid }))
    assert.isFalse(validator({ o: fauxCid, t: fauxCid, th: fauxCid }))
    assert.isFalse(validator({ o: 'one' }))
    assert.isFalse(validator({ o: 'one', t: 'two', th: 'three' }))
    assert.isTrue(validator({ o: 1 }))
    assert.isTrue(validator({ o: 1, t: 2, th: 3 }))
    assert.isTrue(validator({}))
  })

  it('{String:&Any}', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: { link: {} }
          }
        }
      }
    }, '$map')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), ['one', 'two', 'three'], [1, 'one', true], undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '{String:&Any}'`)
    }
    assert.isFalse(validator({ num: 1, str: 'obj' }))
    assert.isFalse(validator({ o: 'one' }))
    assert.isFalse(validator({ o: 'one', t: 'two', th: 'three' }))
    assert.isFalse(validator({ o: 1 }))
    assert.isFalse(validator({ o: 1, t: 2, th: 3 }))
    assert.isTrue(validator({ o: fauxCid }))
    assert.isTrue(validator({ o: fauxCid, t: fauxCid, th: fauxCid }))
    assert.isTrue(validator({}))
  })

  it('{String:nullable Int}', async () => {
    const validator = create({
      types: {
        $map: {
          map: {
            keyType: 'String',
            valueType: 'Int',
            valueNullable: true
          }
        }
      }
    }, '$map')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), ['one', 'two', 'three'], [1, 'one', true], undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '{String:Int}'`)
    }
    assert.isFalse(validator({ num: 1, str: 'obj' }))
    assert.isFalse(validator({ o: fauxCid }))
    assert.isFalse(validator({ o: fauxCid, t: fauxCid, th: fauxCid }))
    assert.isFalse(validator({ o: 'one' }))
    assert.isFalse(validator({ o: 'one', t: 'two', th: 'three' }))
    assert.isTrue(validator({ o: 1 }))
    assert.isTrue(validator({ o: 1, t: 2, th: 3 }))
    assert.isTrue(validator({ o: null }))
    assert.isTrue(validator({ o: 1, t: null, th: 3 }))
    assert.isTrue(validator({}))
  })

  it('map listpairs', async () => {
    /*
      type MapAsListpairs {String:String} representation listpairs
    */
    const validator = create({
      types: {
        MapAsListpairs: {
          map: {
            keyType: 'String',
            valueType: 'String',
            representation: { listpairs: {} }
          }
        }
      }
    }, 'MapAsListpairs')

    await lint(validator)

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, fauxCid, new Uint8Array(0), Uint8Array.from([1, 2, 3]), undefined]) {
      assert.isFalse(validator(obj), `obj: ${obj} != '{String:String}'`)
    }
    assert.isFalse(validator([1, 'obj']))
    assert.isFalse(validator([fauxCid]))
    assert.isFalse(validator([fauxCid, fauxCid, fauxCid]))
    assert.isFalse(validator([1]))
    assert.isFalse(validator([1, 2, 3]))
    assert.isFalse(validator(['one']))
    assert.isFalse(validator(['one', 'two', 'three']))
    assert.isTrue(validator([['o', 'one']]))
    assert.isFalse(validator([[1, 'one']]))
    assert.isTrue(validator([['o', 'one'], ['t', 'two'], ['th', 'three']]))
    assert.isFalse(validator([['o', 'one'], ['t', 'two'], ['th', fauxCid]]))
    assert.isFalse(validator([['o', 1], ['t', 2], ['th', 3]]))
    assert.isTrue(validator([]))
  })
})
