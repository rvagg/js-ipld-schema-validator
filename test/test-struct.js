/* eslint-env mocha */

import { create } from 'ipld-schema-validator'
import chai from 'chai'
import { lint } from './lint.js'

const { assert } = chai

const fauxCid = {}
fauxCid.asCID = fauxCid

describe('Structs', () => {
  it('struct with 3 different field kinds', async () => {
    const validator = create({
      types: {
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: 'String' }
            },
            representation: { map: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

    assert.isTrue(validator({ foo: 100, bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ foo: 100, bar: true }))
    assert.isFalse(validator({ foo: 100, baz: 'this is baz' }))
    assert.isFalse(validator({ bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({ foo: 100, bar: true, baz: 'this is baz', nope: 1 }))
    assert.isFalse(validator([100, true, 'nope']))
  })

  it('struct within a struct', async () => {
    const validator = create({
      types: {
        $struct2: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: 'String' }
            },
            representation: { map: {} }
          }
        },
        $struct1: {
          struct: {
            fields: {
              one: { type: 'Int' },
              two: { type: '$struct2' },
              three: { type: 'Link' }
            },
            representation: { map: {} }
          }
        }
      }
    }, '$struct1')

    await lint(validator)

    assert.isTrue(validator({ one: -1, two: { foo: 100, bar: true, baz: 'this is baz' }, three: fauxCid }))
    assert.isFalse(validator({}))
    assert.isFalse(validator({ one: -1, two: {}, three: fauxCid }))
    assert.isFalse(validator({ one: -1, two: [], three: fauxCid }))
  })

  it('struct with maps and lists and structs', async () => {
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
        },
        $struct2: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: '$list' }
            },
            representation: { map: {} }
          }
        },
        $struct1: {
          struct: {
            fields: {
              one: { type: '$map' },
              two: { type: '$struct2' },
              three: { type: 'Link' }
            },
            representation: { map: {} }
          }
        }
      }
    }, '$struct1')

    await lint(validator)

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

  it('struct with tuple representation', async () => {
    const validator = create({
      types: {
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: 'String' }
            },
            representation: { tuple: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

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

  it('struct with tuple representation containing structs', async () => {
    const validator = create({
      types: {
        $struct: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: 'String' }
            },
            representation: { map: {} }
          }
        },
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: '$struct' },
              bar: { type: '$struct' }
            },
            representation: { tuple: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

    assert.isTrue(validator([{ foo: 100, bar: true, baz: 'this is baz' }, { foo: -1100, bar: false, baz: '' }]))
    assert.isFalse(validator([{}, {}]))
    assert.isFalse(validator([]))
  })

  it('struct nullables', async () => {
    const validator = create({
      types: {
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: 'Int', nullable: true },
              bar: { type: 'Bool' },
              baz: { type: 'String', nullable: true }
            },
            representation: { map: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

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

  it('struct tuple nullables', async () => {
    const validator = create({
      types: {
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: 'Int', nullable: true },
              bar: { type: 'Bool' },
              baz: { type: 'String', nullable: true }
            },
            representation: { tuple: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

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

  it('struct optionals', async () => {
    const validator = create({
      types: {
        SimpleStruct: {
          struct: {
            fields: {
              foo: { type: 'Int', optional: true },
              bar: { type: 'Bool' },
              baz: { type: 'String', optional: true }
            },
            representation: { map: {} }
          }
        }
      }
    }, 'SimpleStruct')

    await lint(validator)

    assert.isTrue(validator({ foo: 100, bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({}))
    assert.isTrue(validator({ foo: 100, bar: true }))
    assert.isFalse(validator({ foo: 100, baz: 'this is baz' }))
    assert.isTrue(validator({ bar: true, baz: 'this is baz' }))
    assert.isFalse(validator({ foo: 100, bar: true, baz: 'this is baz', nope: 1 }))
    assert.isFalse(validator({ foo: undefined, bar: true, baz: '' })) // the next 3 don't validator because 'undefined' isn't in the data model
    assert.isFalse(validator({ foo: 1, bar: true, baz: undefined }))
    assert.isFalse(validator({ foo: undefined, bar: true, baz: undefined }))
    assert.isTrue(validator({ bar: true, baz: '' }))
    assert.isTrue(validator({ foo: 1, bar: true }))
    assert.isTrue(validator({ bar: true }))
  })

  it('struct with anonymous types', async () => {
    /*
      type StructWithAnonymousTypes struct {
        fooField optional {String:String}
        barField nullable {String:String}
        bazField {String:nullable String}
        wozField {String:[nullable String]}
      }
    */
    const validator = create({
      types: {
        StructWithAnonymousTypes: {
          struct: {
            fields: {
              fooField: {
                type: {
                  map: {
                    keyType: 'String',
                    valueType: 'String'
                  }
                },
                optional: true
              },
              barField: {
                type: {
                  map: {
                    keyType: 'String',
                    valueType: 'String'
                  }
                },
                nullable: true
              },
              bazField: {
                type: {
                  map: {
                    keyType: 'String',
                    valueType: 'String',
                    valueNullable: true
                  }
                }
              },
              wozField: {
                type: {
                  map: {
                    keyType: 'String',
                    valueType: {
                      list: {
                        valueType: 'String',
                        valueNullable: true
                      }
                    }
                  }
                }
              }
            },
            representation: {
              map: {}
            }
          }
        }
      }
    }, 'StructWithAnonymousTypes')

    await lint(validator)

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

  it('empty struct', async () => {
    const validator = create({
      types: {
        StructEmpty: {
          struct: {
            fields: {},
            representation: { map: {} }
          }
        }
      }
    }, 'StructEmpty')

    await lint(validator)

    for (const obj of [101, 1.01, 'a string', false, true, fauxCid, Uint8Array.from([1, 2, 3]), [1, 2, 3], null, undefined]) {
      assert.isFalse(validator(obj))
    }

    assert.isTrue(validator({}))
    assert.isFalse(validator({ a: 1 }))
  })

  it('empty struct', async () => {
    /*
      type StructAsMapWithRenames struct {
        bar Bool (rename "b")
        boom String
        baz String (rename "z")
        foo Int (rename "f" implicit "0")
      }
    */
    const validator = create({
      types: {
        StructAsMapWithRenames: {
          struct: {
            fields: {
              bar: { type: 'Bool' },
              boom: { type: 'String' },
              baz: { type: 'String' },
              foo: { type: 'Int' }
            },
            representation: {
              map: {
                fields: {
                  bar: { rename: 'b' },
                  baz: { rename: 'z' },
                  foo: { rename: 'f' }
                }
              }
            }
          }
        }
      }
    }, 'StructAsMapWithRenames')

    await lint(validator)

    assert.isFalse(validator({ bar: true, boom: 'str', baz: 'str', foo: 100 }))
    assert.isFalse(validator({ bar: true, boom: 'str', baz: 'str', b: 'str', z: 'str', f: 100, foo: 100 }))
    assert.isTrue(validator({ b: true, boom: 'str', z: 'str', f: 100 }))
  })

  it('empty struct', async () => {
    /*
      type StructAsMapWithImplicits struct {
        bar Bool (implicit "false")
        boom String (implicit "yay")
        baz String
        foo Int (implicit "0")
      }
    */
    const validator = create({
      types: {
        StructAsMapWithImplicits: {
          struct: {
            fields: {
              bar: { type: 'Bool' },
              boom: { type: 'String' },
              baz: { type: 'String' },
              foo: { type: 'Int' }
            },
            representation: {
              map: {
                fields: {
                  bar: { implicit: false },
                  boom: { implicit: 'yay' },
                  foo: { implicit: '0' }
                }
              }
            }
          }
        }
      }
    }, 'StructAsMapWithImplicits')

    await lint(validator)

    assert.isTrue(validator({ bar: true, boom: 'str', baz: 'str', foo: 100 }))
    assert.isTrue(validator({ boom: 'str', baz: 'str', foo: 100 }))
    assert.isTrue(validator({ baz: 'str', foo: 100 }))
    assert.isTrue(validator({ baz: 'str' }))
    assert.isFalse(validator({}))
  })

  it('tuple with custom fieldOrder', async () => {
    /*
      type StructAsTupleWithCustomFieldorder struct {
        foo Int
        bar Bool
        baz String
      } representation tuple {
        fieldOrder ["baz", "bar", "foo"]
      }
    */
    const validator = create({
      types: {
        StructAsTupleWithCustomFieldorder: {
          struct: {
            fields: {
              foo: { type: 'Int' },
              bar: { type: 'Bool' },
              baz: { type: 'String' }
            },
            representation: {
              tuple: {
                fieldOrder: ['baz', 'bar', 'foo']
              }
            }
          }
        }
      }
    }, 'StructAsTupleWithCustomFieldorder')

    assert.isFalse(validator([100, true, 'this is baz']))
    assert.isTrue(validator(['this is baz', true, 100]))
  })
})
