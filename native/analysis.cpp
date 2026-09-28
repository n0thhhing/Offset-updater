#include <capstone/capstone.h>
#include <cstdint>
#include <cstddef>
#include <cstring>
#include <vector>
#include <unordered_map>
#include <string>
#include <algorithm>

struct Segment { uint64_t file, va, size; uint32_t flags; };

static std::vector<Segment> segments(const uint8_t* data, size_t length) {
    std::vector<Segment> result;
    if (length < 64 || memcmp(data, "\x7f" "ELF\x02\x01", 6)) return result;
    uint64_t table; memcpy(&table, data + 32, 8);
    uint16_t entrySize, count; memcpy(&entrySize, data + 54, 2); memcpy(&count, data + 56, 2);
    if (entrySize < 56 || table + uint64_t(entrySize) * count > length) return {};
    for (uint16_t i = 0; i < count; i++) {
        const uint8_t* e = data + table + size_t(i) * entrySize;
        uint32_t type; memcpy(&type, e, 4); if (type != 1) continue;
        Segment s; memcpy(&s.flags, e + 4, 4); memcpy(&s.file, e + 8, 8); memcpy(&s.va, e + 16, 8); memcpy(&s.size, e + 32, 8);
        if (s.file + s.size <= length) result.push_back(s);
    }
    return result;
}

static uint32_t branch_target(const std::vector<Segment>& segs, uint32_t at, int64_t displacement, size_t length) {
    if (segs.empty()) {
        int64_t target = int64_t(at) + displacement;
        return target >= 0 && uint64_t(target + 4) <= length ? uint32_t(target) : UINT32_MAX;
    }
    for (const auto& source : segs) if (at >= source.file && uint64_t(at) + 4 <= source.file + source.size) {
        uint64_t va = source.va + at - source.file + displacement;
        for (const auto& dest : segs) if (va >= dest.va && va + 4 <= dest.va + dest.size) return uint32_t(dest.file + va - dest.va);
    }
    return UINT32_MAX;
}

extern "C" void index_u64_values(const uint8_t* data, size_t length, const uint64_t* values, uint32_t valueCount,
    uint32_t* counts, uint32_t* offsets, uint32_t capacity) {
    std::unordered_map<uint64_t, uint32_t> ids;
    ids.reserve(valueCount * 2);
    for (uint32_t i = 0; i < valueCount; i++) { ids.emplace(values[i], i); counts[i] = 0; }
    for (size_t pos = 0; pos + 8 <= length; pos += 8) {
        uint64_t value; memcpy(&value, data + pos, 8);
        auto it = ids.find(value); if (it == ids.end()) continue;
        uint32_t id = it->second, count = counts[id]++;
        if (count < capacity) offsets[id * capacity + count] = uint32_t(pos);
    }
}

extern "C" void extract_bl_targets(const uint8_t* data, size_t length, const uint32_t* starts, const uint32_t* windows,
    uint32_t count, uint32_t* outCounts, uint32_t* outTargets, uint32_t capacity) {
    const auto segs = segments(data, length);
    for (uint32_t i = 0; i < count; i++) {
        uint32_t total = 0;
        size_t end = std::min<size_t>(length >= 4 ? length - 3 : 0, size_t(starts[i]) + windows[i]);
        for (size_t pos = starts[i]; pos < end; pos += 4) {
            uint32_t word; memcpy(&word, data + pos, 4);
            if ((word & 0xfc000000u) != 0x94000000u) continue;
            int64_t displacement = int64_t(int32_t(word << 6) >> 6) * 4;
            uint32_t target = branch_target(segs, uint32_t(pos), displacement, length);
            if (target != UINT32_MAX) { if (total < capacity) outTargets[i * capacity + total] = target; total++; }
        }
        outCounts[i] = total;
    }
}

static bool is_branch(const char* m) {
    return !strcmp(m,"b") || !strcmp(m,"bl") || !strcmp(m,"br") || !strcmp(m,"blr") || !strcmp(m,"cbz") ||
      !strcmp(m,"cbnz") || !strcmp(m,"tbz") || !strcmp(m,"tbnz") || !strcmp(m,"ret") || !strncmp(m,"b.",2);
}

extern "C" uint32_t filter_control_flow(const uint8_t* source, size_t sourceLength, uint32_t sourceOffset,
    const uint8_t* destination, size_t destinationLength, uint32_t* candidates, uint32_t candidateCount, uint32_t evidenceLength) {
    if (sourceOffset + evidenceLength > sourceLength) return 0;
    csh handle; if (cs_open(CS_ARCH_ARM64, CS_MODE_ARM, &handle) != CS_ERR_OK) return 0;
    cs_option(handle, CS_OPT_SKIPDATA, CS_OPT_ON);
    cs_insn* src = nullptr; size_t srcCount = cs_disasm(handle, source + sourceOffset, evidenceLength, sourceOffset, 0, &src);
    uint32_t written = 0;
    for (uint32_t c = 0; c < candidateCount; c++) {
        uint32_t offset = candidates[c]; if (offset + evidenceLength > destinationLength) continue;
        cs_insn* dst = nullptr; size_t dstCount = cs_disasm(handle, destination + offset, evidenceLength, offset, 0, &dst);
        bool ok = dstCount == srcCount; size_t equal = 0;
        if (ok) for (size_t i = 0; i < srcCount; i++) {
            bool sb = is_branch(src[i].mnemonic), db = is_branch(dst[i].mnemonic);
            if (sb != db || (sb && strcmp(src[i].mnemonic, dst[i].mnemonic))) { ok = false; break; }
            if (!strcmp(src[i].mnemonic, dst[i].mnemonic)) equal++;
        }
        if (ok && srcCount && double(equal) / srcCount >= 0.9) candidates[written++] = offset;
        if (dst) cs_free(dst, dstCount);
    }
    if (src) cs_free(src, srcCount); cs_close(&handle); return written;
}
