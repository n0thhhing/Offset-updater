import { PatternFinder } from '../src/PatternFinder.mjs'


const patternFinder = new PatternFinder()
const preset = {
    'presetKey': 'customPreset',
    'challenge':         {
        'logic': {
            'and': [
                {
                    'value': /^[a-zA-Z]+$/,
                    'description': 'Test if string contains only a-z and A-Z.',
                    'method': 'regularExpression',
                    'option': null,
                    'expect': {
                        'logic': '=',
                        'value': true
                    }
                },
                {
                    'value': 'a',
                    'description': 'Search for a given characters.',
                    'method': 'inSuccession',
                    'option':  'startsWith', //'inBetween',//'endsWith',//'startsWith',
                    'expect': {
                        'logic': '=',
                        'value': 4
                    }
                }
            ]
        }
    }
}


const result = patternFinder
    .setPreset( preset )
    .getResult( { 
        'str': 'aaajkjjaaaackkkcc', 
        'presetKey': 'customPreset',
        'flattenResult': true
    } )

console.log( JSON.stringify( result, null, 4 ) )

