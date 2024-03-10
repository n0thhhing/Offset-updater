enum Foreground {
  Black = '\x1b[30m',
  Red = '\x1b[31m',
  Green = '\x1b[32m',
  Yellow = '\x1b[33m',
  Blue = '\x1b[34m',
  Magenta = '\x1b[35m',
  Cyan = '\x1b[36m',
  White = '\x1b[37m',
  BrightBlack = '\x1b[90m',
  BrightRed = '\x1b[91m',
  BrightGreen = '\x1b[92m',
  BrightYellow = '\x1b[93m',
  BrightBlue = '\x1b[94m',
  BrightMagenta = '\x1b[95m',
  BrightCyan = '\x1b[96m',
  BrightWhite = '\x1b[97m',
  Grey = '\x1b[90m',
  Gray = '\x1b[90m',
  LightGray = '\x1b[38;5;248m',
  DarkGray = '\x1b[38;5;240m',
  Brown = '\x1b[38;5;130m',
  Olive = '\x1b[38;5;58m',
  Navy = '\x1b[38;5;18m',
}

enum Background {
  Black = '\x1b[40m',
  Red = '\x1b[41m',
  Green = '\x1b[42m',
  Yellow = '\x1b[43m',
  Blue = '\x1b[44m',
  Magenta = '\x1b[45m',
  Cyan = '\x1b[46m',
  White = '\x1b[47m',
  BrightBlack = '\x1b[100m',
  BrightRed = '\x1b[101m',
  BrightGreen = '\x1b[102m',
  BrightYellow = '\x1b[103m',
  BrightBlue = '\x1b[104m',
  BrightMagenta = '\x1b[105m',
  BrightCyan = '\x1b[106m',
  BrightWhite = '\x1b[107m',
  LightGray = '\x1b[48;5;248m',
  DarkGray = '\x1b[48;5;240m',
  Brown = '\x1b[48;5;130m',
  Olive = '\x1b[48;5;58m',
  Navy = '\x1b[48;5;18m',
}

enum Modifiers {
  Reset = '\x1b[0m',
  Bold = '\x1b[1m',
  Dim = '\x1b[2m',
  Italic = '\x1b[3m',
  Underline = '\x1b[4m',
  Blink = '\x1b[5m',
  Reverse = '\x1b[7m',
  Hidden = '\x1b[8m',
}

enum ColorError {
  InvalidHexFormat = 'Invalid hex color format',
  InvalidColorType = 'Invalid color type',
}

type Color = Foreground | Background;
type Modifier = Modifiers;
type ColorType = 'fg' | 'bg';

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface ColorFunction {
  (text: string): string;
}

interface ColorMethods {
  [key: string]: ColorFunction;
}

interface ColorObject {
  [key: string]: ColorMethods;
}

function methodBuilder(colorType: ColorType, colorEnum: any): ColorMethods {
  const methods: ColorMethods = {};

  Object.keys(colorEnum).forEach((key) => {
    const colorCode = colorEnum[key];
    methods[key] = (text: string | number) => {
      if (typeof text === 'number') text = text.toString();

      const resetCode = Modifiers.Reset;
      let result = '';
      let lastIndex = 0;

      while (true) {
        const resetIndex = text.indexOf(resetCode, lastIndex);
        if (resetIndex === -1) {
          result += `${colorCode}${text.slice(lastIndex)}${resetCode}`;
          break;
        }

        result += `${colorCode}${text.slice(lastIndex, resetIndex)}${resetCode}${colorCode}`;
        lastIndex = resetIndex + resetCode.length;
      }

      return result;
    };
  });

  return methods;
}

function rainbow(text: string): string {
  const rainbowColors = [
    color.Red,
    color.Yellow,
    color.Green,
    color.Cyan,
    color.Blue,
    color.Magenta,
  ];

  let rainbowText = '';
  for (let i = 0; i < text.length; i++) {
    const colorIndex = i % rainbowColors.length;
    rainbowText += rainbowColors[colorIndex](text[i]);
  }
  return rainbowText;
}
function rainbowBg(text: string): string {
  const hueStep = 360 / (text.length * 5);
  let rainbowText = '';
  for (let i = 0; i < text.length; i++) {
    const hue = i * hueStep;
    rainbowText += `\x1b[48;2;${hslToRgb(hue, 100, 50)}m${text[i]}`;
  }
  return rainbowText + Modifiers.Reset;
}

function hslToRgb(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hueToRgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  return `${Math.round(r * 255)};${Math.round(g * 255)};${Math.round(b * 255)}`;
}

const color: ColorModule = {
  ...methodBuilder('fg', Foreground),
  ...methodBuilder('modifier', Modifiers),
  bg: {
    ...methodBuilder('bg', Background),
    rgb: (r: number, g: number, b: number) => color.rgb(r, g, b, 'bg'),
    hex: (hex: string) => color.hex(hex, 'bg'),
    rainbow: rainbowBg,
  },
  rgb: (
    r: number,
    g: number,
    b: number,
    type: ColorType = 'fg',
  ): ColorFunction => {
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error(ColorError.InvalidColorType);
    }
    const colorCode =
      type === 'fg' ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[48;2;${r};${g};${b}m`;
    return (text: string) => `${colorCode}${text}${Modifiers.Reset}`;
  },
  hex: (hex: string, type: ColorType = 'fg'): ColorFunction => {
    const { r, g, b } = hexToRgb(hex);
    return color.rgb(r, g, b, type);
  },
  rainbow: rainbow,
};

function hexToRgb(hex: string): RGBColor {
  const regexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!regexResult) {
    throw new Error(ColorError.InvalidHexFormat);
  }
  const [, r, g, b] = regexResult.map((x) => parseInt(x, 16));
  if (
    isNaN(r) ||
    isNaN(g) ||
    isNaN(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    throw new Error(ColorError.InvalidHexFormat);
  }
  return { r, g, b };
}

export { color };
