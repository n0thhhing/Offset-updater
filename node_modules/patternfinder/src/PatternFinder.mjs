import { config } from './data/config.mjs'
import { presets } from './data/presets.mjs'
import { printMessages, keyPathToValue } from './helpers/mixed.mjs'


export class PatternFinder {
    #config
    #presets
    #debug


    constructor( debug=false ) {
        this.#debug = debug
        this.#config = config

        this.#presets = {}
        const [ messages, comments ] = Object
            .entries( presets )
            .reduce( ( acc, a, index ) => {
                const [ presetKey, challenge ] = a
                const [ m, c ] = this.#validateAddChallenge( { presetKey, challenge } )

                acc[ 0 ].push( ...m )
                acc[ 1 ].push( ...c )
                return acc 
            }, [ [], [] ] )
        printMessages( { messages, comments } )
        this.#presets = presets
        return true
    }


    setPreset( { presetKey, challenge } ) {
        const [ messages, comments ] = this.#validateAddChallenge( { presetKey, challenge } )
        printMessages( { messages, comments } )
        this.#presets[ presetKey ] = challenge
        return this
    }

    getPresetKeys() {
        return Object.keys( this.#presets )
    }


    getResult( { str, presetKey, flattenResult=true } ) {
        const [ messages, comments ] = this.#validateTest( { str, presetKey } )
        printMessages( { messages, comments } )

        const preset = this.#presets[ presetKey ]
        const tests = this.#findPatterns( { str, preset } )

        const result = flattenResult ? this.#flattenResult( { tests } ) : tests
        return result
    }


    #flattenResult( { tests } ) {
        const flat = Object
            .entries( tests )
            .reduce( ( acc, a, index ) => {
                const [ operator, values ] = a
                if( index === 0 ) {
                    acc[ operator ] = []
                }

                switch( operator ) {
                    case 'and':
                        acc[ operator ] = values
                            .every( a => a['success'] )
                        break
                    case 'or':
                        acc[ operator ] = values
                            .some( a => a['success'] )
                        break
                    default:
                        console.log( 'unknow operator' )
                        process.exit( 1 )
                }
                return acc
            }, {} )

        const result = Object
            .entries( flat ) 
            .every( a => a[ 1 ] )

        return result
    }


    #findPatterns( { str, preset } ) {
        let result = Object
            .entries( preset['logic'] )
            .reduce( ( acc, a, index ) => {
                const [ key, patterns ] = a
                acc[ key ] = patterns
                    .map( pattern => {
                        let result
                        switch( pattern['method'] ) {
                            case 'regularExpression':
                                result = this.#patternsRegularExpression( { str, pattern } ) 
                                break
                            case 'inSuccession': 
                                result = this.#patternsInSuccession( { str, pattern } ) 
                                break
                            default:
                                console.log( 'Unknwon method.' )
                                process.exit( 1 )
                                break
                        }
                        return result
                    } )
                return acc
            }, {} )

        return result
    }


    #patternsRegularExpression( { str, pattern } ) {
        const result = {
            'success': null,
            'value': null
        }

        const test = pattern['value'].test( str )
        result['success'] = test === pattern['expect']['value']
        return result
    }


    #patternsInSuccession( { str, pattern } ) {
        let count = 0
        let loop = true
        let max = 0

        const result = {
            'success': null,
            'value': null
        }

        while( loop ) {
            let search
            switch( pattern['option'] ) {
                case 'startsWith':
                    search = str.substring( 0, 1 )
                    str = str.substring( 1, str.length )
                    search === pattern['value'] ? count++ : loop = false
                    result['value'] = count
                    break
                case 'endsWith':
                    search = str.substring( str.length - 1, str.length )
                    str = str.substring( 0, str.length - 1 )
                    search === pattern['value'] ? count++ : loop = false
                    result['value'] = count
                    break
                case 'inBetween':
                    search = str.substring( 0, 1 )
                    str = str.substring( 1, str.length )
                    search === pattern['value'] ? count++ : count = 0
                    max = count > max ? count : max
                    result['value'] = max
                    break
            }

            search === '' ? loop = false : ''
        }

        switch( pattern['expect']['logic'] ) {
            case '=':
                result['success'] = ( result['value'] === pattern['expect']['value'] ) ? true : false
                break
            case '>':
                result['success'] = ( result['value'] > pattern['expect']['value'] ) ? true : false
                break
            case '>=':
                result['success'] = ( result['value'] >= pattern['expect']['value'] ) ? true : false
                break
            case '<':
                result['success'] = ( result['value'] < pattern['expect']['value'] ) ? true : false
                break
            case '<=':
                result['success'] = ( result['value'] <= pattern['expect']['value'] ) ? true : false
                break
            default:
                console.log( 'Unknown input.' )
                process.exit( 1 )
                break
        }
        
        return result
    }
    

    #validateTest( { str, presetKey } ) {
        const messages = []
        const comments = []

        if( typeof str !== 'string' ) {
            messages.push( `Key 'str' is not type of 'string'.` )
        }

        if( typeof presetKey !== 'string' ) {
            messages.push( `Key 'presetKey' is not type of 'string'. `)
        } else if( !Object.keys( this.#presets ).includes( presetKey ) ) {
            messages.push( `Key 'presetKey' with the value '${presetKey}' is not known. Choose from ${Object.keys( this.#presets ).map( a => `'${a}'` ).join( ', ' )} instead.` )
        }

        return [ messages, comments ]
    }


    #validateAddChallenge( { presetKey, challenge } ) {
        let messages = []
        let comments = []

        if( typeof presetKey !== 'string' ) {
            messages.push( `Key 'presetKey' is not type of string` )
        } else if( !/^[a-zA-Z]+$/.test( presetKey ) ) {
            messages.push( `Key 'presetKey' accepts only characters from a-z and A-Z.` )
        } else if( Object.keys( this.#presets ).includes( presetKey ) ) {
            comments.push( `Key '${presetKey}' is already taken, will overwrite data.` )
        }
        if( typeof challenge !== 'object' ) {
            messages.push( `Challenge is not type of 'object'.` )
        } else {
            const valid = [ 
                [ 'description', 'string' ],
                [ 'logic', 'object' ]
            ]

            Object
                .keys( challenge )
                .forEach( key => {
                    const find = valid.find( a => a[ 0 ] === key )
                    if( find === undefined ) {
                        messages.push( `Key '${key}' in Challenge is not allowed.` )
                    } else {
                        if( typeof challenge[ find[ 0 ] ] !== find[ 1 ] ) {
                            messages.push( `Key '${find[ 0 ]}' in Challenge is not type of '${find[ 1 ]}'.` )
                        }
                    }
                } )
        }

        if( messages.length !== 0 ) {
            return [ messages, comments ]
        }

        const ops = [ 'and', 'or' ]
        if( !ops.some( op => Object.hasOwn( challenge['logic'], op ) ) ) {
            messages.push( `Key 'logic' in Challenge expects only ${ops.map( a => `'${a}'`).join( ', ' )} as key.` )
        } else if( Object.keys( challenge['logic'] ).length !== 1 ) {
            messages.push( `Key 'logic' in Challenge has more then one key. Choose from ${ops.map( a => `'${a}'`).join( ', ' )}` )
        } else if( !Array.isArray( challenge['logic'][ Object.keys( challenge['logic'] )[ 0 ] ] ) ) {
            messages.push( `Key '${Object.keys( challenge['logic'])}' in challenge['logic'] is not type of 'array'.`)
        } else {
            Object
                .entries( challenge['logic'] )
                .forEach( a => {
                    const [ key, items ] = a
                        items
                            .forEach( ( item, index ) => {
                                let id = ''
                                id += "['logic']"
                                id += `['${key}']`
                                id += `[ ${index} ]`

                                const [ m, c ] = this.#validateLogicItem( { item, id } )
                                messages = [ ...messages, ...m ]
                                comments = [ ...comments, ...c ] 
                            } )
                } )
        }

        return [ messages, comments ]
    }


    #validateLogicItem( { item, id } ) {
        const messages = []
        const comments = []

        const validations = this.#config['validations']
        if( !Object.hasOwn( item, 'method' ) ) {
            messages.push( `${id} Key 'method' is missing.` )
            return [ messages, comments ]
        } else if( !Object.keys( validations ).includes( item['method'] ) ) {
            messages.push( `${id} Key 'method' with the value '${item['method']}' is not allowed. Choose from ${Object.keys( validations ).map( a => `'${a}'`).join(', ')} instead.` )
            return [ messages, comments ]
        }

        const tmp = [
            [ 'value', 'type' ],
            [ 'option', 'includes' ],
            [ 'expect__logic', 'includes' ],
            [ 'expect__value', 'type']
        ]
            .forEach( a => {
                const [ keyPath, search ] = a
                const valid = keyPathToValue( { 'data': validations[ item['method'] ], keyPath } )

                const input = keyPathToValue( { 'data': item, keyPath } )
                const id2 = keyPath.split( '__' ).map( a => `['${a}']` ).join( '' )

                if( input === undefined ) {
                    messages.push( `${id} Key '${id2}' is not found.` )
                } else {
                    switch( search ) {
                        case 'includes':
                            if( !valid.includes( input ) ) {
                                messages.push( `${id} Key '${id2}' with the value '${input}' is not allowed. Choose from ${valid.map( a => `'${a}'`).join( ', ' )} instead.` )
                            }
                            break
                        case 'type':
                            switch( valid ) {
                                case 'Boolean':
                                    if( typeof input !== 'boolean' ) {
                                        messages.push( `${id} Key '${id2}' with the value '${input}' is not type of 'Boolean'.` )
                                    }
                                    break
                                case 'Number':
                                    if( !Number.isFinite( input ) ) {
                                        messages.push( `${id} Key '${id2}' with the value '${input}' is not type of 'Number' or 'Float'.` )
                                    } 
                                    break
                                case 'RegularExpression': 
                                    if( !( input instanceof RegExp ) ) {
                                        messages.push( `${id} Key '${id2}' with the value '${input}' is not type of 'Regular Expression'.` )
                                    }
                                    break
                                case 'SingleChar':
                                    if ( !( typeof input === 'string' && input.length === 1 ) ) {
                                        messages.push( `${id} Key '${id2}' with the value '${input}' is not type of 'string' and 1 character long.` )
                                    }
                                    break
                                default:
                                    console.log( 'Unknown Error.' )
                                    process.exit( 1 )
                                    break
                            }

                            break
                    }
                }
            } )

        return [ messages, comments ]
    }
}