/* eslint-env mocha */

import SchemaValidate from 'ipld-schema-validate'
import chai from 'chai'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Structs', () => {
  it('struct with 3 different field kinds', () => {
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

  it('struct within a struct', () => {
    const validator = SchemaValidate.create({
      types: {
        $struct2: {
          kind: 'struct',
          fields: {
            foo: { kind: 'int' },
            bar: { type: 'Bool' },
            baz: { kind: 'string' }
          },
          representation: { map: {} }
        },
        $struct1: {
          kind: 'struct',
          fields: {
            one: { type: 'Int' },
            two: { type: '$struct2' },
            three: { kind: 'link' }
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

  it('struct with maps and lists and structs', () => {
    /*
    type $list [&Any]

    type $map {String:$list}

    type $struct2 struct {
      foo Int
      bar Bool
      baz $list
    }

    type $struct1 struct {
      one $map
      two $struct2
      three &Any
    }
    */
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
            three: { kind: 'link' }
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
    assert.isFalse(validator({
      one: {},
      two: { foo: 100, bar: true, baz: [] },
      three: fauxCid,
      four: 'nope'
    }))
    assert.isFalse(validator({}))
  })

  it('struct with tuple representation', () => {
    const validator = SchemaValidate.create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int' },
            bar: { type: 'Bool' },
            baz: { type: 'String' }
          },
          representation: { tuple: {} }
        }
      }
    }, 'SimpleStruct')
    assert.isTrue(validator([100, true, 'this is baz']))
    assert.isFalse(validator({ foo: 100, bar: true, baz: 'this is baz' }))
    assert.isFalse(validator([]))
    assert.isFalse(validator([100, true]))
    assert.isFalse(validator([100, 'this is baz']))
    assert.isFalse(validator([true, 'this is baz']))
    assert.isFalse(validator([100, true, 'this is baz', 1]))
    assert.isFalse(validator([1, 100, true, 'nope']))
    assert.isFalse(validator([true, 100, 'nope']))
    assert.isFalse(validator([true, 100, 'nope']))
    assert.isFalse(validator([100, 'nope', true]))
  })

  it('struct with tuple representation containing structs', () => {
    const validator = SchemaValidate.create({
      types: {
        $struct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int' },
            bar: { type: 'Bool' },
            baz: { type: 'String' }
          },
          representation: { map: {} }
        },
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: '$struct' },
            bar: { type: '$struct' }
          },
          representation: { tuple: {} }
        }
      }
    }, 'SimpleStruct')
    assert.isTrue(validator([{ foo: 100, bar: true, baz: 'this is baz' }, { foo: -1100, bar: false, baz: '' }]))
    assert.isFalse(validator([{}, {}]))
    assert.isFalse(validator([]))
  })

  it('struct nullables', () => {
    const validator = SchemaValidate.create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int', nullable: true },
            bar: { type: 'Bool' },
            baz: { type: 'String', nullable: true }
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
    assert.isFalse(validator({ foo: undefined, bar: true, baz: '' }))
    assert.isFalse(validator({ foo: 1, bar: true, baz: undefined }))
    assert.isFalse(validator({ foo: undefined, bar: true, baz: undefined }))
    assert.isTrue(validator({ foo: null, bar: true, baz: '' }))
    assert.isTrue(validator({ foo: 1, bar: true, baz: null }))
    assert.isTrue(validator({ foo: null, bar: true, baz: null }))
  })

  it('struct tuple nullables', () => {
    const validator = SchemaValidate.create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int', nullable: true },
            bar: { type: 'Bool' },
            baz: { type: 'String', nullable: true }
          },
          representation: { tuple: {} }
        }
      }
    }, 'SimpleStruct')
    assert.isTrue(validator([100, true, 'this is baz']))
    assert.isFalse(validator([]))
    assert.isFalse(validator([100, true]))
    assert.isFalse(validator([100, 'this is baz']))
    assert.isFalse(validator([true, 'this is baz']))
    assert.isFalse(validator([100, true, 'this is baz', 1]))
    assert.isFalse(validator([undefined, true, '']))
    assert.isFalse(validator([1, true, undefined]))
    assert.isFalse(validator([undefined, true, undefined]))
    assert.isTrue(validator([null, true, '']))
    assert.isTrue(validator([1, true, null]))
    assert.isTrue(validator([null, true, null]))
  })

  it('struct optionals', () => {
    const validator = SchemaValidate.create({
      types: {
        SimpleStruct: {
          kind: 'struct',
          fields: {
            foo: { type: 'Int', optional: true },
            bar: { type: 'Bool' },
            baz: { type: 'String', optional: true }
          },
          representation: { map: {} }
        }
      }
    }, 'SimpleStruct')
    assert.isTrue(validator({ foo: 100, bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({}))
    assert.isTrue(validator({ foo: 100, bar: true }))
    assert.isFalse(validator({ foo: 100, baz: 'this is baz' }))
    assert.isTrue(validator({ bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({ foo: 100, bar: true, baz: 'this is baz', nope: 1 }))
    assert.isFalse(validator({ foo: undefined, bar: true, baz: '' })) // the next 3 don't validate because 'undefined' isn't in the data model
    assert.isFalse(validator({ foo: 1, bar: true, baz: undefined }))
    assert.isFalse(validator({ foo: undefined, bar: true, baz: undefined }))
    assert.isTrue(validator({ bar: true, baz: '' }))
    assert.isTrue(validator({ foo: 1, bar: true }))
    assert.isTrue(validator({ bar: true }))
  })

  it('struct with anonymous types', () => {
    /*
      type StructWithAnonymousTypes struct {
        fooField optional {String:String}
        barField nullable {String:String}
        bazField {String:nullable String}
        wozField {String:[nullable String]}
      }
    */
    const validator = SchemaValidate.create({
      types: {
        StructWithAnonymousTypes: {
          kind: 'struct',
          fields: {
            fooField: {
              type: {
                kind: 'map',
                keyType: 'String',
                valueType: 'String'
              },
              optional: true
            },
            barField: {
              type: {
                kind: 'map',
                keyType: 'String',
                valueType: 'String'
              },
              nullable: true
            },
            bazField: {
              type: {
                kind: 'map',
                keyType: 'String',
                valueType: 'String',
                valueNullable: true
              }
            },
            wozField: {
              type: {
                kind: 'map',
                keyType: 'String',
                valueType: {
                  kind: 'list',
                  valueType: 'String',
                  valueNullable: true
                }
              }
            }
          },
          representation: {
            map: {}
          }
        }
      }
    }, 'StructWithAnonymousTypes')

    assert.isFalse(validator({}))

    assert.isTrue(validator({
      fooField: { s: '', a: 'b' },
      barField: { string: 'yep', a: 'b' },
      bazField: { bip: 'bop', a: 'b' },
      wozField: { hack: ['fip', 'fop'], gack: [] }
    }))

    assert.isTrue(validator({ fooField: {}, barField: {}, bazField: {}, wozField: {} }))
    assert.isTrue(validator({ barField: {}, bazField: {}, wozField: {} }))

    assert.isTrue(validator({
      barField: { string: 'yep', a: 'b' },
      bazField: { bip: 'bop', a: 'b' },
      wozField: { hack: ['fip', 'fop'], gack: [] }
    }))

    assert.isTrue(validator({
      barField: null,
      bazField: { bip: 'bop', a: 'b' },
      wozField: { hack: ['fip', 'fop'], gack: [] }
    }))

    assert.isTrue(validator({
      barField: null,
      bazField: { bip: null, a: 'b' },
      wozField: { hack: ['fip', 'fop'], gack: [] }
    }))

    assert.isTrue(validator({
      barField: null,
      bazField: { bip: null, a: 'b' },
      wozField: { hack: ['fip', null], gack: [] }
    }))
  })
})