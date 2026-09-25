/**
 * Ambient environment typings for Minecraft Bedrock QuickJS Script API.
 * Minecraft provides a global `console` object for content logging.
 * Browser (window, document, fetch) and Node.js (process, fs) APIs are absent.
 */

declare interface Console {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  info(...data: unknown[]): void;
}

declare const console: Console;
