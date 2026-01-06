import { PacketLogger } from './PacketLogger';

interface LoggerConfig {
    quiet: boolean;
    debug: boolean;
}

const config: LoggerConfig = {
    quiet: false,
    debug: false,
};

// Update logging switches once config is loaded.
export function configureLogger(next: Partial<LoggerConfig>): void {
    if (typeof next.quiet === 'boolean') {
        config.quiet = next.quiet;
    }
    if (typeof next.debug === 'boolean') {
        config.debug = next.debug;
    }
}

// Emit to console or to PacketLogger note channel depending on quiet mode.
function emit(line: string, level: 'log' | 'warn' | 'error'): void {
    const shouldConsole = !config.quiet;
    if (shouldConsole) {
        console[level](line);
    } else {
        PacketLogger.globalNote(line, false);
    }
}

// Standard info logging (quiet-aware).
export function info(message: string): void {
    emit(message, 'log');
}

// Warning logging (quiet-aware).
export function warn(message: string): void {
    emit(message, 'warn');
}

// Error logging (quiet-aware).
export function error(message: string): void {
    emit(message, 'error');
}

// Debug logging gated by config.debug.
export function debug(message: string): void {
    if (config.debug) {
        emit(message, 'log');
    }
}
