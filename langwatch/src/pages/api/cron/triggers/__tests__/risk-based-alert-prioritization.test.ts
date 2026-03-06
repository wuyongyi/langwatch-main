import { describe, it, expect } from "vitest";
import { determineAlertPriority } from "../risk-based-alert-prioritization";
import type { Trace } from "~/server/tracer/types";
import { AlertType } from "@prisma/client";

describe("Risk-Based Alert Prioritization", () => {
  describe("determineAlertPriority", () => {
    describe("given a trace with high risk level", () => {
      describe("when the trace has an error", () => {
        it("returns CRITICAL priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "high",
            },
            error: {
              has_error: true,
              message: "Operation failed",
              stacktrace: [],
            },
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.CRITICAL);
        });
      });

      describe("when the trace has no error", () => {
        it("returns WARNING priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "high",
            },
            error: null,
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.WARNING);
        });
      });
    });

    describe("given a trace with medium risk level", () => {
      describe("when the trace has an error", () => {
        it("returns WARNING priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "medium",
            },
            error: {
              has_error: true,
              message: "Operation failed",
              stacktrace: [],
            },
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.WARNING);
        });
      });

      describe("when the trace has no error", () => {
        it("returns INFO priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "medium",
            },
            error: null,
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.INFO);
        });
      });
    });

    describe("given a trace with low risk level", () => {
      describe("when the trace has an error", () => {
        it("returns INFO priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "low",
            },
            error: {
              has_error: true,
              message: "Operation failed",
              stacktrace: [],
            },
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.INFO);
        });
      });

      describe("when the trace has no error", () => {
        it("returns INFO priority", () => {
          const trace: Partial<Trace> = {
            metadata: {
              "langwatch.risk.level": "low",
            },
            error: null,
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.INFO);
        });
      });
    });

    describe("given a trace without risk level", () => {
      describe("when the trace has an error", () => {
        it("returns WARNING priority", () => {
          const trace: Partial<Trace> = {
            metadata: {},
            error: {
              has_error: true,
              message: "Operation failed",
              stacktrace: [],
            },
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.WARNING);
        });
      });

      describe("when the trace has no error", () => {
        it("returns INFO priority", () => {
          const trace: Partial<Trace> = {
            metadata: {},
            error: null,
          };

          const priority = determineAlertPriority(trace as Trace);

          expect(priority).toBe(AlertType.INFO);
        });
      });
    });
  });
});
