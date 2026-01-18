# FoM Client Login Flow (CShell.dll)
Generated: 2025-12-31
IDB: Client\Client_FoM\Resources\CShell.dll
ImageBase: 0x10000000

## Overview
- Login UI submit path reads fields 0x5E (username) and 0x7C (password), writes shared mem, and triggers send/tick.
- Login request throttle uses EncVar indices 10/11/12/13; sends Packet_ID_LOGIN_REQUEST (0x6C) when threshold met.
- Login tick (sub_101C0820) sends Packet_ID_LOGIN_REQUEST (0x6C) when SharedMem flag 0x54 is set and timing gate passes.
- 0x6D response handler parses status/text and updates UI only.

## UI Message Mapping (Login Status)

### 0x6D LOGIN_REQUEST_RETURN (status -> UI string)
| Status | Name | UI String ID | UI Text |
|---|---|---|---|
| 0 | INVALID_INFO | 1711 | You have entered invalid login information. Please check your username and try again! |
| 1 | SUCCESS | — | (no error message) |
| 2 | OUTDATED_CLIENT | 1720 | Your client version is outdated. Please make sure it is patched properly to the newest version. Please try again later! |
| 3 | ALREADY_LOGGED_IN | 1710 | You are already logged in. Please try again in a few minutes. |

### 0x6F LOGIN_RETURN (status -> UI string)
| Status | Name | UI String ID | UI Text |
|---|---|---|---|
| 0 | INVALID_LOGIN | 1711 | You have entered invalid login information. Please check your username and try again! |
| 1 | SUCCESS | — | (no error message) |
| 2 | UNKNOWN_USERNAME | 1708 | This username is unknown. Please try again! |
| 3 | LOGIN_RETURN_3 | — | (no error message) |
| 4 | INCORRECT_PASSWORD | 1709 | Incorrect password. Please try again! |
| 5 | CREATE_CHARACTER | — | (enters character creation flow) |
| 6 | CREATE_CHARACTER_ERROR | 1706 | We're sorry, but an error occurred while trying to create your avatar. Please try again later! |
| 7 | TEMP_BANNED | 1718 | Your account has been temporarily banned, %1!s! hours remaining. |
| 8 | PERM_BANNED | 1719 | Your account has been permanently banned. |
| 9 | DUPLICATE_IP | 1732 | Your account has been locked as our systems have detected multiple accounts originating from your IP address. Please contact Face of Mankind Support if you believe this is a mistake. |
| 10 | INTEGRITY_CHECK_FAILED | 1707 | Integrity check failed! You are using a wrong client version. |
| 11 | RUN_AS_ADMIN | 1700 | Please make sure to run the game client with admin privileges! |
| 12 | ACCOUNT_LOCKED | 1699 | Your account is locked. |
| 13 | NOT_PURCHASED | 1741 | Please visit https://www.faceofmankind.com/account/detail and purchase the game to log in! |

Note: On status 1/5, the handler compares the `clientVersion` field against `0x073D`. If greater, it shows the outdated-client message (ID 1720).

## Login_OnSubmit (0x101C1072)
Role: UI submit; reads username/password; updates UI and triggers login send/tick.