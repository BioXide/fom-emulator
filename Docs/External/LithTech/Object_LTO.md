# Object.lto in LithTech Server Architecture

## What is Object.lto?

`Object.lto` is a **renamed DLL** (Dynamic Link Library) that contains the **game-specific server-side object definitions** for a LithTech game. The `.lto` extension stands for "**LithTech Object**" and is simply a DLL with a different extension to distinguish it from regular Windows DLLs.

## Purpose

The `Object.lto` file serves as the **game object plugin** that defines all server-side game entities (players, NPCs, items, triggers, world models, etc.). It provides:

1. **Class Definitions**: All game object classes derived from `BaseClass`
2. **Properties**: Configurable properties for each class (exposed to level editors)
3. **Lifecycle Callbacks**: Constructor/destructor functions for object instantiation
4. **Server Shell**: The `IServerShell` implementation for game-specific server logic

## How It's Loaded

From `dsys_interface.cpp`:

```cpp
LTRESULT dsi_LoadServerObjects(CClassMgr *pClassMgr) {
    // 1. Copy or locate the object.lto file
    GetOrCopyFile("ltjs_object.dll", fileName, ...);  // (or "object.lto" in original)
    
    // 2. Load the DLL via cb_LoadModule
    status = cb_LoadModule(fileName, bFileCopied, pClassMgr->m_ClassModule, &version);
    
    // 3. Also load sres.dll (server resources)
    bm_BindModule(sres_file_name, ...);
}
```

## The Loading Mechanism

From `classbind.cpp`:

```cpp
int cb_LoadModule(const char *pModuleName, bool bTempFile, 
                  ClassBindModule& classBindModule, int *version) {
    // 1. Bind the DLL into memory
    status = bm_BindModule(pModuleName, bTempFile, hModule);
    
    // 2. Find the exported "ObjectDLLSetup" function
    theFunction = (ObjectDLLSetupFn)bm_GetFunctionPointer(hModule, "ObjectDLLSetup");
    
    // 3. Call it to get the class definitions
    classBindModule.m_pClassDefs = theFunction(&classBindModule.m_nClassDefs, 
                                                ilt_server, version);
    
    // 4. Verify version compatibility
    if (*version != SERVEROBJ_VERSION) return CB_VERSIONMISMATCH;
    
    // 5. Validate all property definitions
    cb_VerifyClassDefProperties(&classBindModule);
}
```

## Required Export: ObjectDLLSetup

Every `Object.lto` must export a single function:

```cpp
typedef ClassDef** (*ObjectDLLSetupFn)(int *nDefs, void *pServer, int *version);

// Typical implementation via macros (from ltserverobj.h):
ClassDef** ObjectDLLSetup(int *nDefs, ILTServer *pServer, int *version) {
    *version = SERVEROBJ_VERSION;  // Version handshake
    g_pLTServer = pServer;         // Store server interface pointer
    *nDefs = nClasses;             // Number of class definitions
    return __g_cpp_classlist;      // Array of ClassDef pointers
}
```

## ClassDef Structure

Each game object class is defined by a `ClassDef`:

```cpp
struct ClassDef {
    const char *m_ClassName;         // "CPlayerObj", "WorldModel", etc.
    ClassDef *m_ParentClass;         // Inheritance chain
    uint32 m_ClassFlags;             // CF_STATIC, CF_ALWAYSLOAD, etc.
    
    ConstructObjectFn m_ConstructFn; // Called when object is created
    DestructObjectFn m_DestructFn;   // Called when object is destroyed
    CreateObjectPluginFn m_PluginFn; // Editor plugin factory
    
    short m_nProps;                  // Number of properties
    PropDef *m_Props;                // Property definitions (for editors/spawning)
    
    long m_ClassObjectSize;          // sizeof(ClassName)
    void *m_pInternal[2];            // Runtime data (CClassData pointers)
};
```

## Server-Side Object Lifecycle

1. **Loading**: `LoadServerBinaries()` calls `dsi_LoadServerObjects()`
2. **Initialization**: `IServerShell::OnServerInitialized()` is called
3. **Class Setup**: `InitExtraClassData()` creates runtime tracking for each class
4. **Static Objects**: `CreateStaticObjects()` instantiates `CF_STATIC` flagged classes
5. **Runtime Spawning**: `sm_AllocateObjectOfClass()` creates new instances:

```cpp
LPBASECLASS sm_AllocateObjectOfClass(ClassDef *pClass) {
    // Get runtime class data
    pClassData = (CClassData*)pClass->m_pInternal[classIndex];
    
    // Allocate from object pool
    pObject = (LPBASECLASS)sb_Allocate(&pClassData->m_ObjectBank);
    pObject->m_hObject = 0;
    pObject->m_pFirstAggregate = NULL;
    
    // Call the constructor
    pClass->m_ConstructFn(pObject);
    
    return pObject;
}
```

## Location/Packaging

The `Object.lto` can be:
- Loose file in game directory (`game/object.lto`)
- Packed inside a `.rez` resource archive
- The engine checks for it via `GetRezFromDosPath("object.lto")` during resource validation

## Summary Table

| Aspect | Description |
|--------|-------------|
| **File Type** | Renamed DLL (`.dll` -> `.lto`) |
| **Required Export** | `ObjectDLLSetup(int*, ILTServer*, int*)` |
| **Returns** | Array of `ClassDef**` (game object class definitions) |
| **Loaded By** | `CClassMgr` via `cb_LoadModule()` |
| **Version Check** | `SERVEROBJ_VERSION` (currently `1`) |
| **Companion File** | `sres.dll` (server resources) |
| **Build Output** | Linked as DLL with `/out:"Object.lto"` |

## Key Files in LithTech Source

| File | Purpose |
|------|---------|
| `engine/runtime/shared/src/classbind.cpp` | DLL loading and class binding |
| `engine/runtime/server/src/classmgr.cpp` | Class management, object pooling |
| `engine/runtime/kernel/src/sys/win/dsys_interface.cpp` | Platform-specific loader |
| `engine/sdk/inc/ltserverobj.h` | ClassDef, macros for defining classes |
| `game/objectdll/*/globalsinit.cpp` | Game-specific class registration |

## Defining Game Object Classes

Game developers use macros from `ltserverobj.h` to define classes:

```cpp
// Example: Defining a simple game object class
BEGIN_CLASS(MyGameObject)
    ADD_STRINGPROP(Name, "Default")
    ADD_REALPROP(Health, 100.0f)
    ADD_VECTORPROP(SpawnOffset)
    ADD_BOOLPROP(Active, true)
END_CLASS_DEFAULT(MyGameObject, BaseClass, NULL, NULL)
```

This expands to create:
- A `ClassDef` structure (`_MyGameObject_Class__`)
- Property definitions array (`_MyGameObject_Props__`)
- Default constructor/destructor wrappers
- Auto-registration with `__ClassDefiner`

## Class Flags (CF_*)

| Flag | Value | Description |
|------|-------|-------------|
| `CF_HIDDEN` | 0x0001 | Hidden from level editors |
| `CF_NORUNTIME` | 0x0002 | Editor-only, not spawned at runtime |
| `CF_STATIC` | 0x0004 | Single instance created at server start |
| `CF_ALWAYSLOAD` | 0x0008 | Always load even if not in current world |
| `CF_WORLDMODEL` | 0x0010 | Is a world model brush |

## Integration with IServerShell

The `Object.lto` also provides the `IServerShell` implementation:

```cpp
// In globalsinit.cpp
SETUP_SERVERSHELL()
define_interface(CGameServerShell, IServerShell);
```

This macro sets up:
- `g_pLTServer` global pointer
- DLL instance handle management
- Interface registration for `IServerShell`

The server shell receives callbacks for:
- `OnServerInitialized()` - Server startup
- `OnAddClient()` / `OnRemoveClient()` - Client connections
- `Update()` - Per-tick game logic
- `OnMessage()` - Custom message handling
