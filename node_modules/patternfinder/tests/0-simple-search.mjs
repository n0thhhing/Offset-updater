import { PatternFinder } from '../src/PatternFinder.mjs'

const patternFinder = new PatternFinder()
const presetKeys = patternFinder
    .getPresetKeys()

const result = patternFinder
    .getResult( { 
        'str': '0000jkjjaklklaaac00000', 
        'presetKey': 'startsAndEndsWithZeros',
        'flattenResult': false
    } )

console.log( `Available PresetsKeys: ${presetKeys.join( ', ' )}` )
console.log( JSON.stringify( result, null, 4 ) )