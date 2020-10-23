/* eslint-disable no-new-func */

const ScalarKindNames = ['Null', 'Int', 'Float', 'String', 'Bool', 'Bytes', 'Link']
// const KindNames = ScalarKindNames.concat(['List', 'Map'])
const ScalarKindNamesLower = ScalarKindNames.map((n) => n.toLowerCase())

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

function kindDefn (obj) {
  if (typeof obj === 'string' && ScalarKindNames.includes(obj)) {
    return obj
  }
  if (typeof obj === 'object' && typeof obj.kind === 'string' && ScalarKindNamesLower.includes(obj.kind)) {
    return obj.kind.charAt(0).toUpperCase() + obj.kind.substring(1)
  }
  return null
}

function create (schema, root) {
  if (!root || typeof root !== 'string') {
    throw new TypeError('A root is required')
  }

  // TODO: wind this back to the scalar kinds only, you shouldn't be able to 'Map' and 'List'
  const rootKind = kindDefn(root)
  if (rootKind) {
    return new Function('obj', `${KindsDefn}; return Kinds.${rootKind}(obj)`)
  }

  if (!schema || !schema.types || !Object.keys(schema.types).length) {
    throw new TypeError('Invalid schema definition')
  }

  const typeValidators = {}

  const addType = (typeName, typeDef) => {
    if (typeValidators[typeName]) { // already added this one
      return
    }

    if (!typeDef) {
      if (typeof schema.types[typeName] !== 'object') {
        throw new TypeError(`A type must match an existing type definition ("${typeName}")`)
      }
      typeDef = schema.types[typeName]
    }

    const defineType = (defType, name) => {
      if (defType === typeName) {
        throw new Error(`Recursive typedef in type "${typeName}"`)
      }
      let innerTypeName = defType
      if (typeof innerTypeName === 'object' && defType.kind) { // anonymous inline map or list!
        innerTypeName = `${typeName} -> ${name} (anon)`
        addType(innerTypeName, defType)
      } else if (typeof innerTypeName === 'string') {
        addType(innerTypeName)
      } else {
        throw new Error(`Bad field type for "${typeName}": "${name}"`)
      }
      return innerTypeName
    }

    if (typeDef.kind === 'list') {
      let valueValidator = ''
      const valueKind = kindDefn(typeDef.valueType)
      if (valueKind) {
        valueValidator = `Kinds.${valueKind}`
      } else {
        const valueTypeName = defineType(typeDef.valueType, 'valueType')
        valueValidator = `Types["${valueTypeName}"]`
      }
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      typeValidators[typeName] = `return Kinds.List(obj) && Array.prototype.every.call(obj, ${valueValidator})`
    } else if (typeDef.kind === 'map') {
      if (typeDef.keyType !== 'String') {
        throw new Error(`Invalid keyType for Map "${typeName}", expected String, found "${typeDef.keyType}"`)
      }
      let valueValidator = ''
      const valueKind = kindDefn(typeDef.valueType)
      if (valueKind) {
        valueValidator = `Kinds.${valueKind}`
      } else {
        const valueTypeName = defineType(typeDef.valueType, 'valueType')
        valueValidator = `Types["${valueTypeName}"]`
      }
      if (typeDef.valueNullable === true) {
        valueValidator = `(v) => v === null || ${valueValidator}(v)`
      }
      typeValidators[typeName] = `return Kinds.Map(obj) && Array.prototype.every.call(Object.values(obj), ${valueValidator})`
    } else if (typeDef.kind === 'struct') {
      let representation = 'map'
      if (typeDef.representation) {
        if (typeof typeDef.representation.tuple === 'object') {
          representation = 'tuple'
        } else if (typeof typeDef.representation.map !== 'object') {
          throw new Error(`Unsupported struct representation "${Object.keys(typeDef.representation).join(',')}"`)
        }
      }
      if (Object.keys(typeDef.representation[representation]).length) {
        throw new Error(`Unsupported representation parameters for "${typeName}"`)
      }

      const requiredFields = []
      for (const [fieldName, fieldDef] of Object.entries(typeDef.fields)) {
        const fieldKey = `${typeName} -> ${fieldName}`
        if (representation !== 'map' || fieldDef.optional !== true) {
          requiredFields.push(fieldName)
        }
        if (representation !== 'map' && fieldDef.optional === true) {
          throw new Error('Don\'t support "optional" fields for non-map structs')
        }
        let fieldValidator = ''
        const fieldKind = kindDefn(fieldDef.type) || kindDefn(fieldDef) // { type: 'String' } || { kind: 'link' }
        if (fieldKind) {
          fieldValidator = `Kinds.${fieldKind}(obj)`
        } else {
          const fieldTypeName = defineType(fieldDef.type, fieldName)
          fieldValidator = `Types["${fieldTypeName}"](obj)`
        }
        if (fieldDef.nullable === true) {
          fieldValidator = `obj === null || ${fieldValidator}`
        }
        typeValidators[fieldKey] = `return ${fieldValidator}`
      }

      if (representation === 'tuple') {
        typeValidators[typeName] = `return Kinds.List(obj) && obj.length === ${requiredFields.length}${requiredFields.map((fieldName, i) => ` && Types["${typeName} -> ${fieldName}"](obj[${i}])`).join('')}`
      } else {
        typeValidators[typeName] = `const keys = obj && Object.keys(obj); return Kinds.Map(obj) && ${JSON.stringify(requiredFields)}.every((k) => keys.includes(k)) && Object.entries(obj).every(([name, value]) => Types["${typeName} -> " + name] && Types["${typeName} -> " + name](value))`
      }
    } else {
      throw new Error(`Can't deal with type kind: "${typeDef.kind}"`)
    }
  }

  addType(root)

  let fn = `${KindsDefn};\n`
  fn += `const Types = {\n${Object.entries(typeValidators).map(([name, fn]) => `  ["${name}"]: (obj) => { ${fn} }`).join(',\n')}\n};\n`
  fn += `return Types["${root}"](obj);`
  // console.log(fn)

  return new Function('obj', fn)
}

export default { create }
