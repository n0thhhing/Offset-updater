#include <capstone/capstone.h>
#include <capstone/arm64.h>
#include <cstdint>
#include <cstring>

extern "C" {
    csh get_capstone_handle() {
        csh handle;
        if (cs_open(CS_ARCH_ARM64, CS_MODE_ARM, &handle) != CS_ERR_OK) return 0;
        cs_option(handle, CS_OPT_SKIPDATA, CS_OPT_ON);
        return handle;
    }

    struct FlatInstruction {
        uint64_t address;
        uint16_t size;
        char mnemonic[32];
        char op_str[160];
        uint8_t bytes[16];
    };

    size_t disasm_arm64(csh handle, const uint8_t* code, size_t code_size, uint64_t address, FlatInstruction* out_insns, size_t max_insns) {
        if (!handle) return 0;
        cs_insn *insn;
        size_t count = cs_disasm(handle, code, code_size, address, max_insns, &insn);
        if (count > 0) {
            for (size_t i = 0; i < count; i++) {
                out_insns[i].address = insn[i].address;
                out_insns[i].size = insn[i].size;
                uint32_t val = *(uint32_t*)insn[i].bytes;
                if ((val & 0x1f800000) == 0x12800000) {
                    uint32_t opc = (val >> 29) & 3;
                    if (opc == 2) strncpy(out_insns[i].mnemonic, "movz", sizeof(out_insns[i].mnemonic));
                    else if (opc == 0) strncpy(out_insns[i].mnemonic, "movn", sizeof(out_insns[i].mnemonic));
                    else if (opc == 3) strncpy(out_insns[i].mnemonic, "movk", sizeof(out_insns[i].mnemonic));
                    else strncpy(out_insns[i].mnemonic, insn[i].mnemonic, sizeof(out_insns[i].mnemonic));
                } else {
                    memcpy(out_insns[i].mnemonic, insn[i].mnemonic, sizeof(out_insns[i].mnemonic));
                }
                memcpy(out_insns[i].op_str, insn[i].op_str, sizeof(insn[i].op_str));
                memcpy(out_insns[i].bytes, insn[i].bytes, insn[i].size);
            }
            cs_free(insn, count);
        }
        return count;
    }
}
