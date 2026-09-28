#include <cstdint>
#include <cstddef>
#include <cstring>
#include <vector>
#include <algorithm>
#include <dispatch/dispatch.h>
#include <arm_neon.h>
struct AnchorPoint {
    size_t offset;
    uint8_t byte_val;
    uint32_t rarity_weight;
};

// Fast hex decoder table
static inline int8_t hex_val(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

// In-place zero-allocation pattern parser
static size_t parse_pattern(const char* pat, size_t pat_len, uint8_t* vals, uint8_t* masks) {
    size_t out_len = 0;
    size_t i = 0;
    while (i < pat_len) {
        while (i < pat_len && (pat[i] == ' ' || pat[i] == '\t' || pat[i] == '\n' || pat[i] == '\r')) i++;
        if (i >= pat_len) break;
        if (i + 1 >= pat_len) break;

        if (out_len == 2048) return 0;
        char c0 = pat[i];
        char c1 = pat[i+1];
        i += 2;

        if (c0 == '?' && c1 == '?') {
            vals[out_len] = 0x00;
            masks[out_len] = 0x00;
        } else if (c0 == '?') {
            int8_t v1 = hex_val(c1);
            vals[out_len] = (v1 >= 0) ? (uint8_t)v1 : 0;
            masks[out_len] = 0x0F;
        } else if (c1 == '?') {
            int8_t v0 = hex_val(c0);
            vals[out_len] = (v0 >= 0) ? (uint8_t)(v0 << 4) : 0;
            masks[out_len] = 0xF0;
        } else {
            int8_t v0 = hex_val(c0);
            int8_t v1 = hex_val(c1);
            vals[out_len] = (uint8_t)(((v0 >= 0 ? v0 : 0) << 4) | (v1 >= 0 ? v1 : 0));
            masks[out_len] = 0xFF;
        }
        out_len++;
    }
    return out_len;
}

// AArch64 opcode rarity heuristic
static inline uint32_t get_rarity(uint8_t b) {
    if (b == 0x00 || b == 0xFF || b == 0xAA || b == 0xA9 || b == 0x91 || b == 0x1F || b == 0xD5) {
        return 1;
    }
    if ((b & 0x0F) == 0) return 5;
    return 10;
}

template <typename EmitFn>
static inline void scan_range(
    const uint8_t* data,
    size_t start_idx,
    size_t end_idx,
    size_t pattern_len,
    const uint8_t* p_val,
    const uint8_t* p_mask,
    size_t p0, uint8_t b0,
    size_t p1, uint8_t b1,
    size_t p2, uint8_t b2,
    size_t p3, uint8_t b3,
    EmitFn emit
) {
    const uint8x16_t v0 = vdupq_n_u8(b0);
    const uint8x16_t v1 = vdupq_n_u8(b1);
    const uint8x16_t v2 = vdupq_n_u8(b2);
    const uint8x16_t v3 = vdupq_n_u8(b3);

    size_t i = start_idx;

    while (i + 128 <= end_idx) {
        uint8x16_t c0 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + p0), v0), vceqq_u8(vld1q_u8(data + i + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + p2), v2), vceqq_u8(vld1q_u8(data + i + p3), v3)));
        uint8x16_t c1 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 16 + p0), v0), vceqq_u8(vld1q_u8(data + i + 16 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 16 + p2), v2), vceqq_u8(vld1q_u8(data + i + 16 + p3), v3)));
        uint8x16_t c2 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 32 + p0), v0), vceqq_u8(vld1q_u8(data + i + 32 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 32 + p2), v2), vceqq_u8(vld1q_u8(data + i + 32 + p3), v3)));
        uint8x16_t c3 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 48 + p0), v0), vceqq_u8(vld1q_u8(data + i + 48 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 48 + p2), v2), vceqq_u8(vld1q_u8(data + i + 48 + p3), v3)));

        uint8x16_t c4 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 64 + p0), v0), vceqq_u8(vld1q_u8(data + i + 64 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 64 + p2), v2), vceqq_u8(vld1q_u8(data + i + 64 + p3), v3)));
        uint8x16_t c5 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 80 + p0), v0), vceqq_u8(vld1q_u8(data + i + 80 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 80 + p2), v2), vceqq_u8(vld1q_u8(data + i + 80 + p3), v3)));
        uint8x16_t c6 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 96 + p0), v0), vceqq_u8(vld1q_u8(data + i + 96 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 96 + p2), v2), vceqq_u8(vld1q_u8(data + i + 96 + p3), v3)));
        uint8x16_t c7 = vandq_u8(vandq_u8(vceqq_u8(vld1q_u8(data + i + 112 + p0), v0), vceqq_u8(vld1q_u8(data + i + 112 + p1), v1)),
                                vandq_u8(vceqq_u8(vld1q_u8(data + i + 112 + p2), v2), vceqq_u8(vld1q_u8(data + i + 112 + p3), v3)));

        uint8x16_t orA = vorrq_u8(vorrq_u8(c0, c1), vorrq_u8(c2, c3));
        uint8x16_t orB = vorrq_u8(vorrq_u8(c4, c5), vorrq_u8(c6, c7));
        uint8x16_t any = vorrq_u8(orA, orB);

        if (__builtin_expect(vmaxvq_u8(any) == 0, 1)) {
            i += 128;
            continue;
        }

        alignas(16) uint8_t cands[128];
        vst1q_u8(cands, c0);      vst1q_u8(cands + 16, c1);
        vst1q_u8(cands + 32, c2); vst1q_u8(cands + 48, c3);
        vst1q_u8(cands + 64, c4); vst1q_u8(cands + 80, c5);
        vst1q_u8(cands + 96, c6); vst1q_u8(cands + 112, c7);

        for (size_t k = 0; k < 128; k++) {
            if (__builtin_expect(cands[k] != 0, 0)) {
                size_t cand_pos = i + k;
                bool match = true;
                size_t p = 0;
                while (p + 16 <= pattern_len) {
                    uint8x16_t d = vld1q_u8(data + cand_pos + p);
                    uint8x16_t m = vld1q_u8(p_mask + p);
                    uint8x16_t v = vld1q_u8(p_val + p);
                    if (vminvq_u8(vceqq_u8(vandq_u8(d, m), v)) != 0xFF) {
                        match = false;
                        break;
                    }
                    p += 16;
                }
                if (match) {
                    for (; p < pattern_len; p++) {
                        if ((data[cand_pos + p] & p_mask[p]) != p_val[p]) {
                            match = false;
                            break;
                        }
                    }
                }
                if (match) {
                    emit((uint32_t)cand_pos);
                }
            }
        }
        i += 128;
    }

    while (i < end_idx) {
        if (data[i + p0] == b0 && data[i + p1] == b1 && data[i + p2] == b2 && data[i + p3] == b3) {
            bool match = true;
            for (size_t p = 0; p < pattern_len; p++) {
                if ((data[i + p] & p_mask[p]) != p_val[p]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                emit((uint32_t)i);
            }
        }
        i++;
    }
}

extern "C" uint32_t scan_str_mt(
    const uint8_t* data,
    size_t data_len,
    const char* pattern_str,
    size_t pattern_str_len,
    uint32_t* out_offsets,
    uint32_t max_out
) {
    if (!data || data_len == 0 || !pattern_str || pattern_str_len == 0) return 0;

    alignas(16) uint8_t pattern_val[2048];
    alignas(16) uint8_t pattern_mask[2048];
    size_t pattern_len = parse_pattern(pattern_str, pattern_str_len, pattern_val, pattern_mask);
    if (pattern_len == 0 || data_len < pattern_len) return 0;

    AnchorPoint exacts[2048];
    size_t num_exacts = 0;
    for (size_t i = 0; i < pattern_len; i++) {
        if (pattern_mask[i] == 0xFF) {
            exacts[num_exacts++] = {i, pattern_val[i], get_rarity(pattern_val[i])};
        }
    }

    if (num_exacts < 2) {
        // Fallback for extreme wildcard patterns
        uint32_t count = 0;
        for (size_t i = 0; i <= data_len - pattern_len; i++) {
            bool ok = true;
            for (size_t j = 0; j < pattern_len; j++) {
                if ((data[i + j] & pattern_mask[j]) != pattern_val[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                if (count < max_out) out_offsets[count] = (uint32_t)i;
                count++;
            }
        }
        return count;
    }

    std::sort(exacts, exacts + num_exacts, [](const AnchorPoint& a, const AnchorPoint& b) {
        return a.rarity_weight > b.rarity_weight;
    });

    size_t num_anchors = std::min<size_t>(num_exacts, 4);
    size_t p0 = exacts[0].offset; uint8_t b0 = exacts[0].byte_val;
    size_t p1 = exacts[1].offset; uint8_t b1 = exacts[1].byte_val;
    size_t p2 = (num_anchors >= 3) ? exacts[2].offset : p0;
    uint8_t b2 = (num_anchors >= 3) ? exacts[2].byte_val : b0;
    size_t p3 = (num_anchors >= 4) ? exacts[3].offset : p1;
    uint8_t b3 = (num_anchors >= 4) ? exacts[3].byte_val : b1;

    size_t total_work = data_len - pattern_len + 1;

    // Small-buffer fast path: bypass GCD thread scheduling overhead
    if (total_work < 131072) {
        uint32_t total = 0;
        scan_range(data, 0, total_work, pattern_len, pattern_val, pattern_mask,
                   p0, b0, p1, b1, p2, b2, p3, b3, [&](uint32_t off) {
            if (total < max_out) out_offsets[total] = off;
            total++;
        });
        return total;
    }

    constexpr size_t NUM_CHUNKS = 10;
    size_t chunk_size = total_work / NUM_CHUNKS;

    std::vector<uint32_t> results[NUM_CHUNKS];
    for (size_t c = 0; c < NUM_CHUNKS; c++) results[c].reserve(64);

    const uint8_t* p_val = pattern_val;
    const uint8_t* p_mask = pattern_mask;
    std::vector<uint32_t>* p_res = results;

    dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_USER_INTERACTIVE, 0);

    dispatch_apply(NUM_CHUNKS, queue, ^(size_t idx) {
        size_t start_idx = idx * chunk_size;
        size_t end_idx = (idx == NUM_CHUNKS - 1) ? total_work : (start_idx + chunk_size);
        auto& local_res = p_res[idx];

        scan_range(data, start_idx, end_idx, pattern_len, p_val, p_mask,
                   p0, b0, p1, b1, p2, b2, p3, b3, [&](uint32_t off) {
            local_res.push_back(off);
        });
    });

    uint32_t total = 0;
    for (size_t c = 0; c < NUM_CHUNKS; c++) {
        for (uint32_t off : results[c]) {
            if (total < max_out) out_offsets[total] = off;
            total++;
        }
    }
    return total;
}

extern "C" uint32_t filter_matches(
    const uint8_t* data,
    size_t data_len,
    uint32_t* inout_offsets,
    uint32_t offsets_count,
    const char* pattern_str,
    size_t pattern_str_len,
    size_t check_start
) {
    if (!data || data_len == 0 || !inout_offsets || offsets_count == 0 || !pattern_str || pattern_str_len == 0) return 0;

    alignas(16) uint8_t pattern_val[2048];
    alignas(16) uint8_t pattern_mask[2048];
    size_t pattern_len = parse_pattern(pattern_str, pattern_str_len, pattern_val, pattern_mask);
    if (pattern_len == 0 || check_start >= pattern_len) return offsets_count;

    uint32_t out_count = 0;
    for (uint32_t i = 0; i < offsets_count; i++) {
        uint32_t off = inout_offsets[i];
        if (off + pattern_len > data_len) continue;

        bool match = true;
        size_t p = check_start;

        // Use SIMD for the tail if it's large enough
        while (p + 16 <= pattern_len) {
            uint8x16_t d = vld1q_u8(data + off + p);
            uint8x16_t m = vld1q_u8(pattern_mask + p);
            uint8x16_t v = vld1q_u8(pattern_val + p);
            if (vminvq_u8(vceqq_u8(vandq_u8(d, m), v)) != 0xFF) {
                match = false;
                break;
            }
            p += 16;
        }

        if (match) {
            for (; p < pattern_len; p++) {
                if ((data[off + p] & pattern_mask[p]) != pattern_val[p]) {
                    match = false;
                    break;
                }
            }
        }

        if (match) {
            inout_offsets[out_count++] = off;
        }
    }

    return out_count;
}

