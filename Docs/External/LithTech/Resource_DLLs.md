# SRes.dll vs CRes.dll in LithTech

Both are **resource DLLs** containing **localized strings** and other resources. They differ by **which side** of the client/server architecture they serve.

## Summary Table

| Aspect | **SRes.dll** (Server Resources) | **CRes.dll** (Client Resources) |
|--------|--------------------------------|--------------------------------|
| **Side** | Server | Client |
| **Stored In** | `CClassMgr::m_hServerResourceModule` | `CClientMgr::m_hClientResourceModule` |
| **Loaded By** | `dsi_LoadServerObjects()` | `dsi_InitClientShellDE()` |
| **Primary Use** | `ILTServer::FormatString()` | `ILTClient::FormatString()` |
| **Contents** | Server-side string resources | Client-side string resources (UI, messages) |
| **Companion To** | `Object.lto` | `CShell.dll` |
| **Project** | `game/serverres/*/` | `game/clientres/*/` |

## What They Contain

Both DLLs are **string resource containers** compiled with Windows resource files (`.rc`). They hold:

- **Localized strings** (UI text, error messages, item names, etc.)
- **String tables** addressable by numeric IDs
- Potentially localized versions for different languages

The engine uses `str_FormatString()` to load and format strings from these modules:

```cpp
// Server-side (from serverde_impl.cpp)
HSTRING CLTServer::FormatString(int messageCode, ...) {
    if (!g_pServerMgr->m_ClassMgr.m_hServerResourceModule)
        return LTNULL;
    
    pBuf = str_FormatString(g_pServerMgr->m_ClassMgr.m_hServerResourceModule,
        messageCode, &marker, &bufferLen);
    // ...
}

// Client-side (from clientde_impl.cpp)
HSTRING CLTClient::FormatString(int messageCode, ...) {
    // First check localized module
    if (g_pClientMgr->m_hLocalizedClientResourceModule) {
        pBuffer = str_FormatString(g_pClientMgr->m_hLocalizedClientResourceModule,
            messageCode, &marker, &bufferLen);
    }
    // Fall back to main CRes
    if (g_pClientMgr->m_hClientResourceModule) {
        pBuffer = str_FormatString(g_pClientMgr->m_hClientResourceModule,
            messageCode, &marker, &bufferLen);
    }
}
```

## Loading Sequence

**Server Side** (`dsi_LoadServerObjects`):
```
1. Load object.lto  -> game object classes
2. Load sres.dll    -> server string resources
```

**Client Side** (`dsi_InitClientShellDE`):
```
1. Load cshell.dll  -> client shell (UI, rendering, input)
2. Load cres.dll    -> client string resources
```

## Why Two Separate DLLs?

1. **Dedicated Servers**: A headless server only needs `Object.lto` + `SRes.dll`. It doesn't need client UI strings.

2. **Client-Only Strings**: Things like "Press SPACE to continue" or menu text only exist in `CRes.dll` - the server doesn't need them.

3. **Server-Only Strings**: Error messages, server console output, or NPC dialogue that gets sent to clients might come from `SRes.dll`.

4. **Localization**: `CRes.dll` can have multiple localized versions. The engine also supports `m_hLocalizedClientResourceModule` for additional language-specific overrides.

## Resource Validation Check

From `rezutils.cpp`, the engine validates `.rez` archives by checking for these known DLLs:

```cpp
if (pDir->GetRezFromDosPath("cshell.dll") != NULL) return TRUE;
if (pDir->GetRezFromDosPath("cres.dll") != NULL) return TRUE;
if (pDir->GetRezFromDosPath("sres.dll") != NULL) return TRUE;
if (pDir->GetRezFromDosPath("object.lto") != NULL) return TRUE;
```

This shows the four core game DLLs that LithTech expects to find.

## LithTech Core DLL Summary

| DLL | Purpose | Side |
|-----|---------|------|
| `Object.lto` | Game object class definitions (ClassDef array) | Server |
| `SRes.dll` | Server string resources | Server |
| `CShell.dll` | Client shell (UI, input, rendering logic) | Client |
| `CRes.dll` | Client string resources | Client |

## Key Source Files

| File | Purpose |
|------|---------|
| `engine/runtime/kernel/src/sys/win/dsys_interface.cpp` | DLL loading for both client and server |
| `engine/runtime/server/src/serverde_impl.cpp` | `ILTServer::FormatString()` implementation |
| `engine/runtime/client/src/clientde_impl.cpp` | `ILTClient::FormatString()` implementation |
| `engine/runtime/server/src/classmgr.h` | `CClassMgr::m_hServerResourceModule` definition |
| `engine/runtime/client/src/clientmgr.h` | `CClientMgr::m_hClientResourceModule` definition |
| `engine/libs/rezmgr/rezutils.cpp` | Resource archive validation |

## FoM-Specific Notes

In Face of Mankind:

- **CRes.dll** is located at `Client/Client_FoM/Resources/CRes.dll`
- Contains client string resources including item names and UI text
- Item/catalog string tables have been extracted to `catalog/CRes_*_items.csv`
- **SRes.dll** may not be present if FoM embedded server strings elsewhere or used a different architecture

## See Also

- [Object_LTO.md](Object_LTO.md) - Server object DLL documentation
