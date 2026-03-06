/**
 * Decorators for instrumenting Claude Code agents with LangWatch observability.
 * 
 * This module provides @trace and @span decorators for automatic trace and span creation.
 */

export { trace, type TraceOptions } from "./trace";
export { span, type SpanOptions } from "./span";
