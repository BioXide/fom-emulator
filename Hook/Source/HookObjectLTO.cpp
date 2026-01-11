/** Object.lto detours for TravelMgrSrv_OnMessage logging. */
#include "HookObjectLTO.h"
#include "HookDetours.h"
#include "HookLogging.h"
#include "HookState.h"

#include <atomic>

namespace
{
using TravelMgrSrv_OnMessageFn = void(__fastcall *)(void* ThisPtr, void* Edx, void* Msg);
using Tick_VortexActiveStateFn = void(__fastcall *)(void* ThisPtr, void* Edx, int StateId);
using SendWorldDataCheckFn = void(__fastcall *)(void* ThisPtr, void* Edx, const char* WorldName);
using SendObjMessage111_PingResultFn = int(__cdecl *)();

static TravelMgrSrv_OnMessageFn TravelMgrSrv_OnMessage_Orig = nullptr;
static Tick_VortexActiveStateFn Tick_VortexActiveState_Orig = nullptr;
static SendWorldDataCheckFn SendWorldDataCheck_Orig = nullptr;
static SendObjMessage111_PingResultFn SendObjMessage111_PingResult_Orig = nullptr;

static std::atomic<bool> GObjectLtoHooksInstalled = false;
static __declspec(thread) int GTravelMgrDepth = 0;

static HMODULE GetObjectLtoModule()
{
    HMODULE Mod = GetModuleHandleA("object.lto");
    if (!Mod)
    {
        Mod = GetModuleHandleA("OBJECT.LTO");
    }
    if (!Mod)
    {
        Mod = GetModuleHandleA("Object.lto");
    }
    return Mod;
}

static void __fastcall HookTravelMgrSrv_OnMessage(void* ThisPtr, void* Edx, void* Msg)
{
    (void)Edx;
    ++GTravelMgrDepth;
    if (TravelMgrSrv_OnMessage_Orig)
    {
        TravelMgrSrv_OnMessage_Orig(ThisPtr, Edx, Msg);
    }
    --GTravelMgrDepth;
}

static void __fastcall HookTick_VortexActiveState(void* ThisPtr, void* Edx, int StateId)
{
    (void)Edx;
    if (GTravelMgrDepth > 0)
    {
        LOG("[TravelMgr] msgType=0 stateId=%d", StateId);
    }
    if (Tick_VortexActiveState_Orig)
    {
        Tick_VortexActiveState_Orig(ThisPtr, Edx, StateId);
    }
}

static void __fastcall HookSendWorldDataCheck(void* ThisPtr, void* Edx, const char* WorldName)
{
    (void)Edx;
    if (GTravelMgrDepth > 0)
    {
        LOG("[TravelMgr] msgType=1 world=\"%s\"", WorldName ? WorldName : "<null>");
    }
    if (SendWorldDataCheck_Orig)
    {
        SendWorldDataCheck_Orig(ThisPtr, Edx, WorldName);
    }
}

static int __cdecl HookSendObjMessage111_PingResult()
{
    if (GTravelMgrDepth > 0)
    {
        LOG("[TravelMgr] msgType=4 (ping result)");
    }
    if (SendObjMessage111_PingResult_Orig)
    {
        return SendObjMessage111_PingResult_Orig();
    }
    return 0;
}

static void InstallObjectLtoDetours(HMODULE ObjectLto)
{
    if (!ObjectLto)
    {
        return;
    }
    uint8_t* Base = reinterpret_cast<uint8_t*>(ObjectLto);

    static constexpr uint32_t kRva_TravelMgrSrv_OnMessage = 0x00079E10;
    static constexpr uint32_t kRva_Tick_VortexActiveState = 0x00079960;
    static constexpr uint32_t kRva_SendWorldDataCheck = 0x00079210;
    static constexpr uint32_t kRva_SendObjMessage111_PingResult = 0x00079470;

    const uint8_t kTravelMgrPrologue[9] = {0x55, 0x8B, 0xEC, 0x81, 0xEC, 0x08, 0x01, 0x00, 0x00};
    const uint8_t kVortexPrologue[10] = {0x55, 0x8B, 0xEC, 0x8B, 0x45, 0x08, 0x83, 0xC0, 0xFC, 0x56};
    const uint8_t kSEHPrologue[5] = {0x55, 0x8B, 0xEC, 0x6A, 0xFF};

    void* TravelMgrTarget = Base + kRva_TravelMgrSrv_OnMessage;
    void* VortexTarget = Base + kRva_Tick_VortexActiveState;
    void* WorldDataTarget = Base + kRva_SendWorldDataCheck;
    void* PingTarget = Base + kRva_SendObjMessage111_PingResult;

    bool OkTravelMgr = InstallDetourCheckedAt("TravelMgrSrv_OnMessage", TravelMgrTarget, sizeof(kTravelMgrPrologue),
                                              kTravelMgrPrologue, reinterpret_cast<void*>(&HookTravelMgrSrv_OnMessage),
                                              reinterpret_cast<void**>(&TravelMgrSrv_OnMessage_Orig));
    bool OkVortex = InstallDetourCheckedAt("Tick_VortexActiveState", VortexTarget, sizeof(kVortexPrologue),
                                           kVortexPrologue, reinterpret_cast<void*>(&HookTick_VortexActiveState),
                                           reinterpret_cast<void**>(&Tick_VortexActiveState_Orig));
    bool OkWorld = InstallDetourCheckedAt("SendWorldDataCheck", WorldDataTarget, sizeof(kSEHPrologue), kSEHPrologue,
                                          reinterpret_cast<void*>(&HookSendWorldDataCheck),
                                          reinterpret_cast<void**>(&SendWorldDataCheck_Orig));
    bool OkPing = InstallDetourCheckedAt("SendObjMessage111_PingResult", PingTarget, sizeof(kSEHPrologue), kSEHPrologue,
                                         reinterpret_cast<void*>(&HookSendObjMessage111_PingResult),
                                         reinterpret_cast<void**>(&SendObjMessage111_PingResult_Orig));

    LOG("[TravelMgr] Object.lto hooks: TravelMgr=%s Vortex=%s WorldData=%s Ping=%s",
        OkTravelMgr ? "ok" : "fail", OkVortex ? "ok" : "fail", OkWorld ? "ok" : "fail", OkPing ? "ok" : "fail");
}

static DWORD WINAPI ObjectLtoHookRescanThread(LPVOID)
{
    DWORD DelayMs = GConfig.RescanMs ? GConfig.RescanMs : 5000;
    for (;;)
    {
        if (GObjectLtoHooksInstalled.load())
        {
            return 0;
        }
        HMODULE ObjectLto = GetObjectLtoModule();
        if (ObjectLto)
        {
            InstallObjectLtoDetours(ObjectLto);
            GObjectLtoHooksInstalled.store(true);
            return 0;
        }
        Sleep(DelayMs);
    }
}
} // namespace

void EnsureObjectLtoHooks()
{
    if (GObjectLtoHooksInstalled.load())
    {
        return;
    }
    HMODULE ObjectLto = GetObjectLtoModule();
    if (!ObjectLto)
    {
        LOG("[TravelMgr] object.lto not loaded yet; deferring hooks");
        CreateThread(nullptr, 0, ObjectLtoHookRescanThread, nullptr, 0, nullptr);
        return;
    }
    InstallObjectLtoDetours(ObjectLto);
    GObjectLtoHooksInstalled.store(true);
}
