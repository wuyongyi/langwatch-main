import { describe, it, expect } from "vitest";
import { RiskClassifier, type RiskLevel } from "../../risk-classifier";

describe("RiskClassifier", () => {
  describe("given a risk classifier instance", () => {
    const classifier = new RiskClassifier();

    describe("when classifying operations with delete keywords", () => {
      it("classifies delete_user_account as high risk", () => {
        const result = classifier.classify("delete_user_account");
        expect(result).toBe("high");
      });

      it("classifies drop_table as high risk", () => {
        const result = classifier.classify("drop_table");
        expect(result).toBe("high");
      });

      it("classifies remove_database as high risk", () => {
        const result = classifier.classify("remove_database");
        expect(result).toBe("high");
      });
    });

    describe("when classifying operations with update keywords", () => {
      it("classifies update_user_profile as medium risk", () => {
        const result = classifier.classify("update_user_profile");
        expect(result).toBe("medium");
      });

      it("classifies modify_settings as medium risk", () => {
        const result = classifier.classify("modify_settings");
        expect(result).toBe("medium");
      });

      it("classifies change_password as medium risk", () => {
        const result = classifier.classify("change_password");
        expect(result).toBe("medium");
      });
    });

    describe("when classifying safe operations", () => {
      it("classifies get_user_profile as low risk", () => {
        const result = classifier.classify("get_user_profile");
        expect(result).toBe("low");
      });

      it("classifies read_data as low risk", () => {
        const result = classifier.classify("read_data");
        expect(result).toBe("low");
      });

      it("classifies list_items as low risk", () => {
        const result = classifier.classify("list_items");
        expect(result).toBe("low");
      });
    });

    describe("when classifying with context", () => {
      it("classifies execute_query with DROP TABLE context as high risk", () => {
        const result = classifier.classifyWithContext("execute_query", {
          query: "DROP TABLE users",
        });
        expect(result).toBe("high");
      });

      it("classifies execute_query with DELETE context as high risk", () => {
        const result = classifier.classifyWithContext("execute_query", {
          query: "DELETE FROM users WHERE id = 1",
        });
        expect(result).toBe("high");
      });

      it("classifies execute_query with UPDATE context as medium risk", () => {
        const result = classifier.classifyWithContext("execute_query", {
          query: "UPDATE users SET name = 'John'",
        });
        expect(result).toBe("medium");
      });

      it("classifies execute_query with SELECT context as low risk", () => {
        const result = classifier.classifyWithContext("execute_query", {
          query: "SELECT * FROM users",
        });
        expect(result).toBe("low");
      });
    });

    describe("when classifying case-insensitive operations", () => {
      it("classifies DELETE_USER as high risk", () => {
        const result = classifier.classify("DELETE_USER");
        expect(result).toBe("high");
      });

      it("classifies Update_Profile as medium risk", () => {
        const result = classifier.classify("Update_Profile");
        expect(result).toBe("medium");
      });
    });
  });
});
