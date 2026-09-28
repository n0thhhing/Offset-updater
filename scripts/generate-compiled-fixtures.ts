import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const libsDir = path.join(import.meta.dir, '..', 'libs');
const cppSourceDir = path.join(import.meta.dir, 'cpp_source');

fs.mkdirSync(libsDir, { recursive: true });
fs.mkdirSync(cppSourceDir, { recursive: true });

// Shared C structures and functions imitating IL2CPP
const sharedCode = `
typedef unsigned int uint32_t;
#define NOINLINE __attribute__((noinline))

struct MethodInfo;
struct Il2CppObject;

struct VTableEntry {
    void (*method)(struct Il2CppObject*);
};

struct Il2CppClass {
    void* image;
    void* gc_desc;
    const char* name;
    const char* namespaze;
    struct Il2CppClass* element_class;
    struct Il2CppClass* castClass;
    uint32_t instance_size;
    struct VTableEntry vtable[10];
};

struct Il2CppObject {
    struct Il2CppClass* klass;
    void* monitor;
};

struct MethodInfo {
    void* methodPointer;
    void* invoker_method;
    const char* name;
    struct Il2CppClass* klass;
};

// Extraneous structs for deep dereferencing and floating point tests
struct Vector3 { float x; float y; float z; };
struct Transform { struct Vector3 position; };
struct Component { struct Transform* transform; };
struct Player { struct Component* comp; };

// 1. Simple field read (LDR + offset)
NOINLINE int Player_GetHealth(struct Il2CppObject* __this) {
    if (!__this) return 0;
    return *(int*)((char*)__this + 0x18);
}

// 2. Static instance access (ADRP + LDR + CBZ)
NOINLINE struct Il2CppObject* GameManager_GetInstance() {
    static struct Il2CppObject* instance = (struct Il2CppObject*)0;
    if (!instance) {
        instance = (struct Il2CppObject*)0x12345678; // Fake alloc
    }
    return instance;
}

// 3. Simple branch logic and state write
NOINLINE void Weapon_Fire(struct Il2CppObject* __this, int ammo) {
    if (ammo > 0) {
        *(int*)((char*)__this + 0x20) = ammo - 1;
    }
}

// 4. More complex cast check simulation
NOINLINE struct Il2CppObject* Object_IsInst(struct Il2CppObject* obj, struct Il2CppClass* targetClass) {
    if (!obj) return (struct Il2CppObject*)0;
    struct Il2CppClass* klass = obj->klass;
    while (klass) {
        if (klass == targetClass) return obj;
        klass = klass->element_class; // Fake inheritance traversal
    }
    return (struct Il2CppObject*)0;
}

// 5. Jump Table (Switch statement - forces ADRP+LDR+BR sequences in compiler)
NOINLINE int ProcessEvent(int eventId) {
    switch(eventId) {
        case 1: return 100;
        case 2: return 200;
        case 3: return 300;
        case 5: return 500;
        case 8: return 800;
        case 13: return 1300;
        case 21: return 2100;
        case 34: return 3400;
        case 55: return 5500;
        default: return -1;
    }
}

// 6. Virtual Method Invocation (IL2CPP vtable simulation)
NOINLINE void InvokeVirtualMethod(struct Il2CppObject* obj, int vtable_slot) {
    if (!obj || !obj->klass) return;
    if (vtable_slot < 0 || vtable_slot >= 10) return;
    
    void (*method)(struct Il2CppObject*) = obj->klass->vtable[vtable_slot].method;
    if (method) {
        method(obj);
    }
}

// 7. Heavy Stack Usage (Many arguments forces stack spillage)
NOINLINE int ComputeHeavy(int a, int b, int c, int d, int e, int f, int g, int h, int i) {
    int arr[5] = {a, b, c, d, e};
    int sum = 0;
    for(int idx = 0; idx < 5; idx++) {
        sum += arr[idx] * f;
    }
    return sum + g + h + i;
}

// 8. Floating point math and deep struct navigation
NOINLINE float GetPlayerDistance(struct Player* p) {
    if (!p || !p->comp || !p->comp->transform) return 0.0f;
    float x = p->comp->transform->position.x;
    float y = p->comp->transform->position.y;
    float z = p->comp->transform->position.z;
    return (x*x) + (y*y) + (z*z);
}
`;

const oldCpp = `
${sharedCode}
`;

const newCpp = `
${sharedCode}

// ─── ADDING DUMMY PADDING TO SHIFT ADDRESSES ───
int g_dummy1 = 1;
int g_dummy2 = 2;

NOINLINE int DummyPaddingFunc(int a) {
    g_dummy1 += a;
    if (g_dummy1 > 100) return g_dummy1;
    return g_dummy1 + g_dummy2;
}

NOINLINE void AnotherDummyFunc() {
    g_dummy2 *= 2;
}
`;

fs.writeFileSync(path.join(cppSourceDir, 'old.c'), oldCpp);
fs.writeFileSync(path.join(cppSourceDir, 'new.c'), newCpp);

console.log('Compiling old_cpp.so (C version)...');
const oldCompile = spawnSync('zig', [
  'cc',
  '-target',
  'aarch64-linux-gnu',
  '-shared',
  '-fPIC',
  '-O2',
  '-w',
  path.join(cppSourceDir, 'old.c'),
  '-o',
  path.join(libsDir, 'old_cpp.so'),
]);
if (oldCompile.status !== 0) {
  console.error('Failed to compile old_cpp.so', oldCompile.stderr?.toString());
  process.exit(1);
}

console.log('Compiling new_cpp.so (C version)...');
const newCompile = spawnSync('zig', [
  'cc',
  '-target',
  'aarch64-linux-gnu',
  '-shared',
  '-fPIC',
  '-O2',
  '-w',
  path.join(cppSourceDir, 'new.c'),
  '-o',
  path.join(libsDir, 'new_cpp.so'),
]);
if (newCompile.status !== 0) {
  console.error('Failed to compile new_cpp.so', newCompile.stderr?.toString());
  process.exit(1);
}

// Extract offsets using llvm-nm (using --print-size to get function sizes)
function extractOffsets(libPath: string) {
  const res = spawnSync('llvm-nm', ['--dynamic', '--print-size', libPath], { encoding: 'utf-8' });
  if (res.status !== 0) {
    console.error('Failed to run llvm-nm', res.stderr);
    return {};
  }
  const lines = res.stdout.split('\n');
  const offsets: Record<string, { offset: number; size: number }> = {};
  for (const line of lines) {
    // e.g. 00000000000103ec 000000000000000c T Player_GetHealth
    const match = line.match(/^([0-9a-fA-F]+)\s+([0-9a-fA-F]+)\s+[A-Za-z]\s+(.*)$/);
    if (match) {
      const [_, hexOffset, hexSize, name] = match;
      offsets[name] = {
        offset: parseInt(hexOffset, 16),
        size: parseInt(hexSize, 16),
      };
    }
  }
  return offsets;
}

const oldOffsets = extractOffsets(path.join(libsDir, 'old_cpp.so'));
const newOffsets = extractOffsets(path.join(libsDir, 'new_cpp.so'));

const targets = [
  'Player_GetHealth',
  'GameManager_GetInstance',
  'Weapon_Fire',
  'Object_IsInst',
  'ProcessEvent',
  'InvokeVirtualMethod',
  'ComputeHeavy',
  'GetPlayerDistance',
];

let offsetsTxt = '-- Auto-generated from real compiled C (IL2CPP-like)\n';
console.log('\nFunction                 Old Offset   New Offset   Delta      Size');
console.log('─'.repeat(70));

for (const target of targets) {
  const oldInfo = oldOffsets[target];
  const newInfo = newOffsets[target];
  if (oldInfo !== undefined && newInfo !== undefined) {
    const delta = newInfo.offset - oldInfo.offset;
    console.log(
      `${target.padEnd(24)} 0x${oldInfo.offset.toString(16).padStart(4, '0')}      0x${newInfo.offset.toString(16).padStart(4, '0')}      +0x${delta.toString(16).padEnd(4)}   ${oldInfo.size} bytes`,
    );
    offsetsTxt += `0x${oldInfo.offset.toString(16)}|${oldInfo.size} -- ${target}\n`;
  } else {
    console.log(`${target} - Missing in one of the libs!`);
  }
}

fs.writeFileSync(path.join(import.meta.dir, '..', 'offsets_cpp.txt'), offsetsTxt);
console.log('\n✅ Generated libs/old_cpp.so and libs/new_cpp.so');
console.log('✅ Generated offsets_cpp.txt');
