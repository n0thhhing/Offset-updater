declare global {
  type FilePath = string;
  type Time = number;
  type BytePattern = Byte;
  type Pattern = string;
  type Offset = number | null;
  type OffsetArr = number[] | null;
  type IsFound = boolean;
  type ArmMode = number;
  type Arch = number;
  type Operand = string;
  type ByteSize = number;
  type InstrId = number;
  type InstrAddress = number;
  type Mnemonic = string;
  type InstrDetails = object;
  type InstrByte = number;

  interface Instruction {
    id: InstrId;
    address: InstrAddress;
    size: ByteSize;
    bytes: InstrByte[];
    mnemonic: Mnemonic;
    op_str: Operand;
    detail: InstrDetails;
  }
  interface OffsetNamePair {
    offset: number;
    name: string;
  }

  interface Signature {
    Pattern: Byte[];
    FoundOffset: number;
  }

  interface Byte {
    N1: {
      Wildcard: boolean;
      Data: number;
    };
    N2: {
      Wildcard: boolean;
      Data: number;
    };
  }
}

export {};
