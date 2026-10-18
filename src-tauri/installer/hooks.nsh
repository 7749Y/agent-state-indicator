; 安装后把安装目录加到当前用户 PATH，卸载时再逐段剔除。
; qwq.exe 与 asi.exe 同目录，因此 qwq 命令装完即可用。

!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $0 HKCU "Environment" "Path"
  ; 前后加分隔符，按段比对，避免子串误判
  StrCpy $1 ";$0;"
  StrCpy $2 "$INSTDIR"
  StrLen $3 $2
  StrCpy $4 0
  cli_path_find:
    StrCpy $5 $1 $3 $4
    StrCmp $5 "" cli_path_append
    StrCmp $5 $2 cli_path_exists
    IntOp $4 $4 + 1
    Goto cli_path_find
  cli_path_append:
    StrCmp $0 "" cli_path_first
    StrCpy $0 "$0;$INSTDIR"
    Goto cli_path_write
  cli_path_first:
    StrCpy $0 "$INSTDIR"
  cli_path_write:
    WriteRegExpandStr HKCU "Environment" "Path" "$0"
    ; 通知系统环境变量变了
    System::Call 'user32::SendMessageTimeoutW(i 0xFFFF, i 0x001A, i 0, w "Environment", i 0, i 5000, *i .r0)'
  cli_path_exists:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ReadRegStr $0 HKCU "Environment" "Path"
  ; 按分号拆分，重建一份不含安装目录的 PATH
  StrCpy $1 ""
  StrCpy $4 ""
  StrCpy $2 0
  cli_path_split:
    StrCpy $3 $0 1 $2
    StrCmp $3 "" cli_path_flush
    StrCmp $3 ";" cli_path_push
    StrCpy $4 "$4$3"
    IntOp $2 $2 + 1
    Goto cli_path_split
  cli_path_push:
    StrCmp $4 "" cli_path_skip
    StrCmp $4 "$INSTDIR" cli_path_skip
    StrCmp $1 "" cli_path_keep_first
    StrCpy $1 "$1;$4"
    Goto cli_path_skip
  cli_path_keep_first:
    StrCpy $1 "$4"
  cli_path_skip:
    StrCpy $4 ""
    IntOp $2 $2 + 1
    Goto cli_path_split
  cli_path_flush:
    StrCmp $4 "" cli_path_apply
    StrCmp $4 "$INSTDIR" cli_path_apply
    StrCmp $1 "" cli_path_keep_last
    StrCpy $1 "$1;$4"
    Goto cli_path_apply
  cli_path_keep_last:
    StrCpy $1 "$4"
  cli_path_apply:
    StrCmp $1 $0 cli_path_done
    StrCmp $1 "" cli_path_delete
    WriteRegExpandStr HKCU "Environment" "Path" "$1"
    Goto cli_path_notify
  cli_path_delete:
    DeleteRegValue HKCU "Environment" "Path"
  cli_path_notify:
    System::Call 'user32::SendMessageTimeoutW(i 0xFFFF, i 0x001A, i 0, w "Environment", i 0, i 5000, *i .r0)'
  cli_path_done:
!macroend
