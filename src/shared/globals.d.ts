// Shared code intentionally omits DOM and Node ambient types.
// Declare console locally so shared modules can log without widening the platform boundary.
declare const console: Pick<typeof globalThis.console, "log" | "warn" | "error">
