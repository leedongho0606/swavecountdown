Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
using System.Threading;

namespace Utilities {
   public static class Display
   {
      [DllImport("user32.dll", CharSet = CharSet.Auto)]
      private static extern IntPtr SendMessage(
         IntPtr hWnd,
         UInt32 Msg,
         IntPtr wParam,
         IntPtr lParam
      );

      [DllImport("user32.dll")]
      static extern void mouse_event(Int32 dwFlags, Int32 dx, Int32 dy, Int32 dwData, UIntPtr dwExtraInfo);

      private const int MOUSEEVENTF_MOVE = 0x0001;

      public static void PowerOn()
      {
         mouse_event(MOUSEEVENTF_MOVE, 0, 1, 0, UIntPtr.Zero);
         Thread.Sleep(40);
         mouse_event(MOUSEEVENTF_MOVE, 0, -1, 0, UIntPtr.Zero);
      }
   }
}
'

[Utilities.Display]::PowerOn()