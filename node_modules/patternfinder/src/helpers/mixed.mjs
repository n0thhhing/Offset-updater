function keyPathToValue( { data, keyPath, separator='__' } ) {
    if( typeof keyPath !== 'string' ) {
        console.log( `KeyPath: ${keyPath} is not a "string".` )
        return undefined
    }

    const result = keyPath
        .split( separator )
        .reduce( ( acc, key, index ) => {
            if( !acc ) return undefined
            if( !acc.hasOwnProperty( key ) ) return undefined
            acc = acc[ key ]
            return acc
        }, data )

    return result
}


function printMessages( { messages=[], comments=[] } ) {
    const n = [
        [ comments, 'Comment', false ],
        [ messages, 'Error', true ]
    ]
        .forEach( ( a, index ) => {
            const [ msgs, headline, stop ] = a
            msgs
                .forEach( ( msg, rindex, all ) => {
                    rindex === 0 ? console.log( `\n${headline}${all.length > 1 ? 's' : ''}:` ) : ''
                    console.log( `  - ${msg}` )
                    if( ( all.length - 1 ) === rindex ) {
                        if( stop === true ) {
                            process.exit( 1 )
                        }
                    }
                } )
        } )

    return true
}


function regexToString( key, value ) {
    if( value instanceof RegExp ) {
        return value.toString()
    }
    return value
}


function stringToRegex( key, value ) {
    let regex = null
    if( /^\/.*\/[gimy]*$/.test( value ) ) {
        try {
            new RegExp( value )
            regex = true
        } catch (error) {
            regex = false
        }
    } else {
        regex = false
    }

    if( regex ) {
        return new RegExp( value.slice( 1, -1 ) )
    } else {
        return value
    }
}


export { regexToString, stringToRegex, printMessages, keyPathToValue }