export const config = {
    'validations': {
        'regularExpression' : {
            'value': 'RegularExpression',
            'option': [ null, undefined ],
            'expect': {
                'logic': [ '=' ],
                'value': 'Boolean'
            }
        },
        'inSuccession': {
            'value': 'SingleChar',
            'option': [ 'startsWith', 'endsWith', 'inBetween' ],
            'expect': {
                'logic': [ '=', '>', '>=', '<', '<=' ] , 
                'value': 'Number'
            }
        }
    }
}