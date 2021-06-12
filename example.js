// This example requires the dependencies:
//   - ipld-schema
//   - ipld-schema-validator
// And needs to be run as a "module" which either means a package.json with
//   `"type": "module"`
// or the file needs to be renamed `example.mjs`.

// @ts-ignore
import Schema from 'ipld-schema'
import SchemaValidator from 'ipld-schema-validator'

// Build an IPLD Schema from the text form
const schemaText = `
type FooBarBazStruct struct {
  bim Int
  bam String
  boom Bool
} representation tuple

type MyList [Int]

type MyStruct struct {
  foo FooBarBazStruct
  bar MyList
  baz String
}
`

// Compile it to its object descriptor form which SchemaValidator consumes
const schemaDescriptor = new Schema(schemaText).descriptor

// Create a validator function from the Schema descriptor, with 'MyStruct' as the
// root type to inspect
const myStructValidator = SchemaValidator.create(schemaDescriptor, 'MyStruct')

// An object that matches our schema
const obj = {
  foo: [1, 'one', true],
  bar: [1, 2, 3, 4],
  baz: 'baz'
}

console.log('Validating object as MyStruct:', myStructValidator(obj)) // true
obj.boop = true // modify the object, adding an additional property not defined by the schema
console.log('Validating modified object as MyStruct:', myStructValidator(obj)) // false

// Make another validator function but use the 'MyList' (`[Int]`) type as the root
const myListValidator = SchemaValidator.create(schemaDescriptor, 'MyList')

console.log('Validating [1, 2, 3] as MyStruct:', myListValidator([1, 2, 3])) // true
console.log('Validating object as MyStruct:', myListValidator(obj)) // false
console.log('Validating [1, \'one\', true] as MyStruct:', myListValidator([1, 'one', true])) // false
console.log('Validating {} as MyStruct:', myListValidator({})) // false
