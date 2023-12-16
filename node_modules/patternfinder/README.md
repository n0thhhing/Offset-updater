![CircleCI](https://img.shields.io/circleci/build/github/a6b8/patternFinder/main)


# Pattern Finder

This tool helps you find patterns in text. It's handy for spotting particular sequences in public keys, making it easier to locate addresses. Plus, it adds a bit of fun to pattern hunting.

For Inspiration: [12 Zeros Address](https://bscscan.com/address/0x0000000000004946c0e9f43f4dee607b0ef1fa1c)

## Quickstart

```shell
npm i patternfinder
```

```javascript
import { PatternFinder } from 'patternfinder'
const patternFinder = new PatternFinder()
const result = patternFinder
    .getResult( { 
        'str': '0000abcdefghijklmnop00000', 
        'presetKey': 'startsAndEndsWithZeros',
        'flattenResult': false
    } )
console.log( JSON.stringify( result, null, 4 ) )
```

## Table of Contents

- Pattern Finder
- Quickstart
- Table of Contents
- Methods
  - getPresetKeys()
  - getResult()
  - setPreset()
- Challenges
- License

## Methods

The module has the main method `.getResults()` that processes a string using predefined presets in just a few lines. You can query all loaded preset keys with `getPresetKeys()`. You can create your custom presets using `setPreset()`, which are then available through `.getResults()`.

### getPresetKeys()

This method returns all available presets, including those added later via `.setPresets()`.

```javascript
import { PatternFinder } from 'patternfinder'
const patternFinder = new PatternFinder()
const presetKeys = patternFinder.getPresetKeys()
console.log( `Available PresetsKeys: ${presetKeys.join( ', ' )}` )
```

### getResult()

```javascript
.getResult( { str, presetKey, flattenResult=false } )
```

| Key           | Type   | Description                                         | Required |
| ------------- | ------ | --------------------------------------------------- | -------- |
| str           | String | The string to be analyzed.                         | true     |
| presetKey     | String | The preset to use.                                 | true     |
| flattenResult | Object, Boolean | Override the default values to force a detailed result. Depending on the method, additional information may be available. | true |

```javascript
import { PatternFinder } from 'patternfinder'
const patternFinder = new PatternFinder()
const result = patternFinder
    .getResult( { 
        'str': '0000abcdefghijklmnop00000', 
        'presetKey': 'startsAndEndsWithZeros',
        'flattenResult': false
    } )
console.log( JSON.stringify( result, null, 4 ) )
```

### setPreset()

This method allows you to preload your custom challenges so that they can be accessed via `getResult()`.

```javascript
.setPreset( { presetKey, challenge } )
```

| Key           | Type   | Description                                         | Required |
| ------------- | ------ | --------------------------------------------------- | -------- |
| presetKey     | String | Expects the key under which the challenge is to be found. | true     |
| challenge     | Object | Contains all the information needed to perform a challenge. | true |

```javascript
import { PatternFinder } from 'patternfinder'
const patternFinder = new PatternFinder()
const preset = {
    'presetKey': 'customPreset',
    'challenge':         {
        'logic': {
            'and': [
                {
                    'value': '0',
                    'description': 'Search for a given character.',
                    'method': 'inSuccession',
                    'option':  'startsWith', // 'inBetween', // 'endsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                }
            ]
        }
    }
}

const search = '000abcdefghi'
const result = patternFinder
    .setPreset( preset )
    .getResult( { 
        'str': search, 
        'presetKey': 'customPreset',
        'flattenResult': true
    } )

console.log( JSON.stringify( result, null, 4 ) )
```

You can find all default presets here: [./src/data/presets.mjs](./src/data/presets.mjs)

## Challenges

A preset consists of a `presetKey` name, an optional description, and the actual logic section.

| Operator | Description                                            |
| -------- | ------------------------------------------------------ |
| and      | Requires that all patterns be found.                   |
| or       | Requires that at least one pattern be found.           |

The following basic operators are available: `and` and `or`. `and` expects all patterns to be found, while `or` expects at least one pattern to be found.

| Search Type       | Description                                                 | Options          | Logic     |
| ----------------- | ----------------------------------------------------------- | ----------------- | --------- |
| regularExpression | Allows complex search patterns using regular expressions.  |                 | =         |
| inSuccession      | Allows counting the same characters at the beginning, end, or anywhere in the text and comparing with a number. | startsWith, endsWith, inBetween | =, >, >=, <, <= |

There are currently two different basic search types: `regularExpression` and `inSuccession`. `regularExpression` allows for high complexity, while `inSuccession` allows counting the same characters at the beginning (startsWith), end (endsWith), or anywhere in the text (inBetween). You can specify a number using the `expect.value` key and a comparison operator using `expect.logic`.

These individual patterns can be grouped as described above using `and` and `or`, and the additional function in `getResults({ ... flattenResults: 'true' })` simplifies the output with a Boolean value.

In this example, it searches for `0s` that are in sequence at the beginning of the string. If there are at least 2, it is considered true.

```javascript
const preset = {
    'presetKey': 'customPreset',
    'challenge': {
        'logic': {
            'and': [
                {
                    'value': '0',
                    'description': 'Search for a given character.',
                    'method': 'inSuccession',
                    'option':  'startsWith', // 'inBetween', // 'endsWith',
                    'expect': {
                        'logic': '>=',
                        'value': 2
                    }
                }
            ]
        }
    }
}
```

You can find all default presets here: [./src/data/presets.mjs](./src/data/presets.mjs)

## License

This project is licensed under the MIT License - see the LICENSE file for details.