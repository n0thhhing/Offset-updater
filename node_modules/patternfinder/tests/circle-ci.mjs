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

if( result ) {
    console.log( 'Success!' )
    process.exit( 0 )
} else {
    console.log( 'Failed' )
    process.exit( 1 )
}