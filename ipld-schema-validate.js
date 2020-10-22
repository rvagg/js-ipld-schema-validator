/* eslint-disable no-new-func */

const KindNames = ['Null', 'Int', 'Float', 'String', 'Bool', 'Bytes', 'Link', 'List', 'Map']

const KindsDefn = `
const Kinds = {
  Null: (obj) => obj === null,
  Int: (obj) => Number.isInteger(obj),
  Float: (obj) => typeof obj === "number" && !Kinds.Int(obj),
  String: (obj) => typeof obj === "string",
  Bool: (obj) => typeof obj === "boolean",
  Bytes: (obj) => obj instanceof Uint8Array,
  Link: (obj) => !Kinds.Null(obj) && typeof obj === "object" && obj["asCID"] === obj,
  List: (obj) => Array.isArray(obj),
  Map: (obj) => !Kinds.Null(obj) && typeof obj === "object" && obj["asCID"] !== obj && !Kinds.List(obj) && !Kinds.Bytes(obj)
}`

function create (schema, root) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('A root is required')
  }

  if (typeof root === 'string' && KindNames.includes(root)) {
    return new Function('obj', `${KindsDefn}; return Kinds.${root}(obj)`)
  }

  if (!schema || !schema.types || !Object.keys(schema.types).length) {
    throw new TypeError('Invalid schema definition')
  }

  const typeValidators = {}

  const addType = (typeName) => {
    if (typeValidators[typeName]) { // already added this one
      return
    }

    if (typeof schema.types[typeName] !== 'object') {
      throw new TypeError(`A type must match an existing type definition ("${typeName}")`)
    }

    const typeDef = schema.types[typeName]

    if (typeDef.kind === 'list') {
      let valueValidator = ''
      if (KindNames.includes(typeDef.valueType)) {
        valueValidator = `Kinds.${typeDef.valueType}`
      } else {
        if (typeDef.valueType === typeName) {
          throw new Error(`Recursive typedef in type "${typeName}"`)
        }
        addType(typeDef.valueType)
        valueValidator = `Types["${typeDef.valueType}"]`
      }
      typeValidators[typeName] = `return Kinds.List(obj) && Array.prototype.every.call(obj, ${valueValidator})`
    } else if (typeDef.kind === 'map') {
      if (typeDef.keyType !== 'String') {
        throw new Error(`Invalid keyType for Map, expected String, found "${typeDef.valueType}"`)
      }
      let valueValidator = ''
      if (KindNames.includes(typeDef.valueType)) {
        valueValidator = `Kinds.${typeDef.valueType}`
      } else {
        if (typeDef.valueType === typeName) {
          throw new Error(`Recursive typedef in type "${typeName}"`)
        }
        addType(typeDef.valueType)
        valueValidator = `Types["${typeDef.valueType}"]`
      }
      typeValidators[typeName] = `return Kinds.Map(obj) && Array.prototype.every.call(Object.values(obj), ${valueValidator})`
    } else {
      throw new Error(`Can't deal with type kind: ${typeDef.kind}`)
    }
  }

  addType(root)
  let fn = `${KindsDefn};\n`
  fn += `const Types = {\n${Object.entries(typeValidators).map((e) => `  ["${e[0]}"]: (obj) => { ${e[1]} }`).join(',\n')}\n};\n`
  fn += `return Types["${root}"](obj);`
  // console.log(fn)
  return new Function('obj', fn)
}

export default { create }
