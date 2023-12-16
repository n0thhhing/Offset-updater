export const presets = {
    'default': {
        'description': 'Default search',
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
                }
            ]
        }
    },
    'startsWithZeros': {
        'description': 'Find all zeros in the front',
        'logic': {
            'and': [
                {
                    'value': '0',
                    'description': 'Search for a given characters.',
                    'method': 'inSuccession',
                    'option':  'startsWith', // 'inBetween', // 'endsWith', // 'startsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                }
            ]
        }
    },
    'endsWithZeros': {
        'description': 'Find all zeros in the front',
        'logic': {
            'and': [
                {
                    'value': '0',
                    'description': 'Search for a given characters.',
                    'method': 'inSuccession',
                    'option':  'endsWith', // 'startsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                }
            ]
        }
    },
    'startsAndEndsWithZeros': {
        'description': 'Find all zeros in the front',
        'logic': {
            'and': [
                {
                    'value': '0',
                    'description': 'Search for a given characters.',
                    'method': 'inSuccession',
                    'option':  'startsWith', // 'inBetween', // 'endsWith', // 'startsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                },
                {
                    'value': '0',
                    'description': 'Search for a given characters.',
                    'method': 'inSuccession',
                    'option':  'endsWith', // 'startsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                }
            ]
        }
    }
}