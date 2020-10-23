/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Unions', () => {
  it('keyed', () => {
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

  it('kinded', () => {
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

  it('inline', () => {
    /*
      type Bar struct {
        bral String
      }

      type Foo struct {
        froz Bool
      }

      type UnionInline union {
        | Foo "foo"
        | Bar "bar"
      } representation inline {
        discriminantKey "tag"
      }
    */
    const validator = SchemaValidate.create({
      types: {
        UnionInline: {
          kind: 'union',
          representation: {
            inline: {
              discriminantKey: 'tag',
              discriminantTable: {
                foo: 'Foo',
                bar: 'Bar'
              }
            }
          }
        },
        Foo: {
          kind: 'struct',
          fields: {
            froz: { type: 'Bool' }
          },
          representation: { map: {} }
        },
        Bar: {
          kind: 'struct',
          fields: {
            bral: { type: 'String' }
          },
          representation: { map: {} }
        }
      }
    }, 'UnionInline')

    let obj = { tag: 'foo', froz: true }
    assert.isTrue(validator(obj))
    assert.deepEqual(obj, { tag: 'foo', froz: true }) // unmolested

    obj = { tag: 'bar', bral: 'zot' }
    assert.isTrue(validator(obj))
    assert.deepEqual(obj, { tag: 'bar', bral: 'zot' }) // unmolested

    assert.isFalse(validator({ froz: true }))
    assert.isFalse(validator({ bral: 'zot' }))
    assert.isFalse(validator({ tag: 'foo' }))
    assert.isFalse(validator({ tag: 'bar' }))
    assert.isFalse(validator({ tag: 'foo', bral: 'zot' }))
    assert.isFalse(validator({ tag: 'bar', froz: true }))
    assert.isFalse(validator({ tag: 'foo', froz: 'zot' }))
  })

  it('envelope', () => {
    /*
      type Bar bool

      type Baz string

      type Foo int

      type UnionEnvelope union {
        | Foo "foo"
        | Bar "bar"
        | Baz "baz"
      } representation envelope {
        discriminantKey "bim"
        contentKey "bam"
      }
    */
    const validator = SchemaValidate.create({
      types: {
        Bar: { kind: 'bool' },
        Baz: { kind: 'string' },
        Foo: { kind: 'int' },
        UnionEnvelope: {
          kind: 'union',
          representation: {
            envelope: {
              discriminantKey: 'bim',
              contentKey: 'bam',
              discriminantTable: {
                foo: 'Foo',
                bar: 'Bar',
                baz: 'Baz'
              }
            }
          }
        }
      }
    }, 'UnionEnvelope')

    assert.isTrue(validator({ bim: 'foo', bam: 100 }))
    assert.isTrue(validator({ bim: 'bar', bam: true }))
    assert.isTrue(validator({ bim: 'baz', bam: 'here be baz' }))

    assert.isFalse(validator({ bim: 'foo' }))
    assert.isFalse(validator({ bim: 'bar' }))
    assert.isFalse(validator({ bim: 'baz' }))
    assert.isFalse(validator({ bim: 'foo', bam: 'zot' }))
    assert.isFalse(validator({ bim: 'bar', bam: 100 }))
    assert.isFalse(validator({ bim: 'baz', bam: true }))
    assert.isFalse(validator(100))
    assert.isFalse(validator(true))
    assert.isFalse(validator('here be string'))
    assert.isFalse(validator({ }))
    assert.isFalse(validator([]))
  })

  it('byteprefix', () => {
    /*
      type Bls12_381Signature bytes

      type Secp256k1Signature bytes

      type Signature union {
        | Secp256k1Signature 0
        | Bls12_381Signature 1
      } representation byteprefix
    */
    const validator = SchemaValidate.create({
      types: {
        Bls12_381Signature: { kind: 'bytes' },
        Secp256k1Signature: { kind: 'bytes' },
        Signature: {
          kind: 'union',
          representation: {
            byteprefix: {
              Secp256k1Signature: 0,
              Bls12_381Signature: 1
            }
          }
        }
      }
    }, 'Signature')

    for (const obj of [null, 1.01, -0.1, 101, -101, 'a string', false, true, {}, [], undefined]) {
      assert.isFalse(validator(obj))
    }

    assert.isTrue(validator(Uint8Array.from([0, 1, 2, 3])))
    assert.isTrue(validator(Uint8Array.from([0])))
    assert.isTrue(validator(Uint8Array.from([1, 1, 2, 3])))
    assert.isTrue(validator(Uint8Array.from([1])))
    assert.isFalse(validator(Uint8Array.from([2, 1, 2, 3])))
    assert.isFalse(validator(Uint8Array.from([2])))
    assert.isFalse(validator(Uint8Array.from([0xff, 1, 2, 3])))
    assert.isFalse(validator(Uint8Array.from([0xff])))
  })
})
