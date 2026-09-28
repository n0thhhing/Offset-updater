#include <cstdint>
#include <cstddef>
#include <vector>
#include <memory>
#include <arm_neon.h>
#include <dispatch/dispatch.h>

struct BatchPattern {
    uint32_t id;
    uint32_t len;
    const uint8_t* val;
    const uint8_t* mask;
    uint16_t anchor_val;
    uint16_t anchor_offset;
    bool wide_anchor;
};

extern "C" void batch_scan(
    const uint8_t* data, size_t data_len,
    const uint8_t* patterns_buf, size_t patterns_buf_len,
    uint32_t num_patterns,
    uint32_t* out_counts, uint32_t* out_offsets, uint32_t max_matches_per_pattern
) {
    if (!data || data_len == 0 || !patterns_buf || num_patterns == 0) return;

    std::vector<BatchPattern> patterns(num_patterns);
    size_t offset = 0;
    
    auto anchor_table = std::make_unique<std::vector<uint32_t>[]>(65536);
    auto byte_anchor_table = std::make_unique<std::vector<uint32_t>[]>(256);

    for (uint32_t i = 0; i < num_patterns; i++) {
        if (offset + 4 > patterns_buf_len) break;
        uint16_t id = *(uint16_t*)(patterns_buf + offset); offset += 2;
        uint16_t len = *(uint16_t*)(patterns_buf + offset); offset += 2;
        
        if (offset + len * 2 > patterns_buf_len) break;
        const uint8_t* val = patterns_buf + offset; offset += len;
        const uint8_t* mask = patterns_buf + offset; offset += len;

        uint16_t anchor_offset = 0;
        uint16_t anchor_val = 0;
        bool found = false;
        
        for (uint16_t j = 0; j < len - 1; j++) {
            if (mask[j] == 0xFF && mask[j+1] == 0xFF) {
                anchor_offset = j;
                anchor_val = val[j] | (val[j+1] << 8);
                found = true;
                break;
            }
        }
        
        if (!found) { 
            for (uint16_t j = 0; j < len; j++) {
                if (mask[j] == 0xFF) {
                    anchor_offset = j;
                    anchor_val = val[j];
                    break;
                }
            }
        }

        patterns[i] = { id, len, val, mask, anchor_val, anchor_offset, found };
        if (found) anchor_table[anchor_val].push_back(i);
        else byte_anchor_table[anchor_val & 0xff].push_back(i);
        out_counts[id] = 0;
    }

    constexpr size_t NUM_CHUNKS = 10;
    std::vector<std::vector<uint32_t>> local(NUM_CHUNKS * num_patterns);
    const size_t chunk_size = (data_len + NUM_CHUNKS - 1) / NUM_CHUNKS;
    auto* local_ptr = local.data();
    auto* patterns_ptr = patterns.data();
    auto* wide_table = anchor_table.get();
    auto* byte_table = byte_anchor_table.get();
    dispatch_queue_t queue = dispatch_get_global_queue(QOS_CLASS_USER_INTERACTIVE, 0);

    dispatch_apply(NUM_CHUNKS, queue, ^(size_t chunk) {
        const size_t begin = chunk * chunk_size;
        const size_t end = std::min(data_len, begin + chunk_size);
        if (begin >= end) return;
        for (size_t i = begin; i < end; i++) {
            if (i + 1 < data_len) {
                uint16_t v;
                memcpy(&v, data + i, sizeof(v));
                for (uint32_t pidx : wide_table[v]) {
                    const auto& pat = patterns_ptr[pidx];
                    if (i < pat.anchor_offset) continue;
                    size_t start = i - pat.anchor_offset;
                    // AArch64 method starts are instruction aligned. This also
                    // eliminates accidental byte-shifted matches in data/code.
                    if ((start & 3) || start + pat.len > data_len) continue;
                    bool match = true;
                    for (size_t j = 0; j < pat.len; j++) {
                        if ((data[start + j] & pat.mask[j]) != pat.val[j]) { match = false; break; }
                    }
                    if (match) local_ptr[chunk * num_patterns + pidx].push_back((uint32_t)start);
                }
            }
            for (uint32_t pidx : byte_table[data[i]]) {
                const auto& pat = patterns_ptr[pidx];
                if (i < pat.anchor_offset) continue;
                size_t start = i - pat.anchor_offset;
                if ((start & 3) || start + pat.len > data_len) continue;
                bool match = true;
                for (size_t j = 0; j < pat.len; j++) {
                    if ((data[start + j] & pat.mask[j]) != pat.val[j]) { match = false; break; }
                }
                if (match) local_ptr[chunk * num_patterns + pidx].push_back((uint32_t)start);
            }
        }
    });

    for (uint32_t pidx = 0; pidx < num_patterns; pidx++) {
        const uint32_t id = patterns[pidx].id;
        uint32_t count = 0;
        for (size_t chunk = 0; chunk < NUM_CHUNKS; chunk++) {
            for (uint32_t match : local[chunk * num_patterns + pidx]) {
                if (count < max_matches_per_pattern) out_offsets[id * max_matches_per_pattern + count] = match;
                count++;
            }
        }
        out_counts[id] = count;
    }
}
