import { Capstone } from './../';
declare global {
  type FilePath = string;
  type Time = number;
  type Pattern = string;
  type Offset = number;
  type OffsetArr = number[] | null;
  type IsFound = boolean;
  type ArmMode = number;
  type Arch = number;
  type Operand = string;
  type ByteSize = number;
  type InstrId = number;
  type InstrAddress = number;
  type Mnemonic = string;
  type SignatureLength = number;
  type LibData = Buffer;
  type LibOffset = number | string;
  type InstructionId = number;
  type OffsetName = string;
  type Capstone = typeof Capstone;
  type FileContent = string;
  type DisassemblerOpt = number;
  type ProcessedPattern = number;
  type Byte = number;
  type CommaCount = number;
  type InstrKey = string;

  interface String {
    commas(): CommaCount;
  }
  interface OffsetInfo {
    name: OffsetName;
    offsets: string;
    pattern: Pattern;
  }

  interface WildCards {
    [key: InstrKey]: InstrId | { [key: InstrKey]: InstrId };
  }

  interface InstructionCases {
    wildCards: WildCards;
    specialCases: WildCards;
    safeInstructions: { [key: InstrKey]: InstrId };
  }

  interface BytePattern {
    N1: {
      Wildcard: boolean;
      Data: number;
    };
    N2: {
      Wildcard: boolean;
      Data: number;
    };
  }

  interface UpdaterConfig {
    'output signatures': boolean;
    'signature length': SignatureLength;
    'offset file': FilePath;
    'old lib': FilePath;
    'new lib': FilePath;
    'offset output': FilePath;
    'signature output': FilePath;
  }

  interface Instruction {
    id: InstrId;
    address: Offset;
    size: ByteSize;
    bytes: Byte[];
    mnemonic: Mnemonic;
    op_str: Operand;
    detail: InstrDetails;
  }

  interface OffsetNamePair {
    offset: Offset;
    name: OffsetName;
  }

  interface Signature {
    Pattern: {
      N1: {
        Wildcard: boolean;
        Data: number;
      };
      N2: {
        Wildcard: boolean;
        Data: number;
      };
    }[];
    FoundOffset: number;
  }
}

export {};
