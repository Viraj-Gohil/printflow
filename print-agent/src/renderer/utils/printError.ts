export function formatPrintError(message: string): string {
  if (!message.includes('powershell -NoProfile -EncodedCommand')) return message;
  if (/No application is associated|class not registered|application not found/i.test(message)) {
    return 'Windows has no print handler configured for this document type. Install a Windows app that can print this file, or use a PDF document.';
  }
  return 'Windows could not confirm printing. Check that a physical printer is connected and ready, then rescan before retrying.';
}
