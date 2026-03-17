import { describe, expect, it } from "vitest";
import { classifyTaskComplexity, buildComplexityHint } from "./task-complexity.js";

describe("classifyTaskComplexity", () => {
  describe("DIRECT — query/lookup patterns", () => {
    it("classifies Korean change query as direct", () => {
      const result = classifyTaskComplexity("이 커밋에서 뭐가 바뀌었는지 확인해줘");
      expect(result.complexity).toBe("direct");
    });

    it("classifies Korean lookup as direct", () => {
      const result = classifyTaskComplexity("현재 상태 파악해줘");
      expect(result.complexity).toBe("direct");
    });

    it("classifies English query as direct", () => {
      const result = classifyTaskComplexity("What changed in this commit?");
      expect(result.complexity).toBe("direct");
    });

    it("classifies list/status request as direct", () => {
      const result = classifyTaskComplexity("TODO 목록 정리해줘");
      expect(result.complexity).toBe("direct");
    });

    it("classifies commit diff request as direct", () => {
      const result = classifyTaskComplexity("커밋 diff 봐줘");
      expect(result.complexity).toBe("direct");
    });
  });

  describe("FULL — complex work patterns", () => {
    it("classifies [deep] tag as full", () => {
      const result = classifyTaskComplexity("[deep] 아키텍처 리뷰해줘");
      expect(result.complexity).toBe("full");
      expect(result.reason).toBe("[deep]-tag");
    });

    it("[deep] tag takes priority over query patterns", () => {
      const result = classifyTaskComplexity("[deep] 현재 상태 확인해줘");
      expect(result.complexity).toBe("full");
    });

    it("classifies refactoring as full", () => {
      const result = classifyTaskComplexity("이 모듈 전체 리팩토링 해야할 것 같아");
      expect(result.complexity).toBe("full");
    });

    it("classifies new feature as full", () => {
      const result = classifyTaskComplexity("Redis 캐싱 새 기능 구현해줘");
      expect(result.complexity).toBe("full");
    });

    it("classifies security review as full", () => {
      const result = classifyTaskComplexity("보안 리뷰 해줘");
      expect(result.complexity).toBe("full");
    });

    it("classifies migration as full", () => {
      const result = classifyTaskComplexity("DB 마이그레이션 진행해야 함");
      expect(result.complexity).toBe("full");
    });

    it("classifies long request as full", () => {
      const lines = Array.from({ length: 10 }, (_, i) => `Line ${i}: some requirement`);
      const result = classifyTaskComplexity(lines.join("\n"));
      expect(result.complexity).toBe("full");
    });
  });

  describe("SIMPLE — short requests", () => {
    it("classifies short non-query request as simple", () => {
      const result = classifyTaskComplexity("설정 파일 수정해줘");
      expect(result.complexity).toBe("simple");
    });

    it("classifies empty input as direct", () => {
      const result = classifyTaskComplexity("");
      expect(result.complexity).toBe("direct");
    });
  });
});

describe("buildComplexityHint", () => {
  it("builds direct hint", () => {
    const hint = buildComplexityHint({ complexity: "direct", reason: "query:ko-lookup" });
    expect(hint).toContain("DIRECT");
    expect(hint).toContain("execute immediately");
  });

  it("builds simple hint", () => {
    const hint = buildComplexityHint({ complexity: "simple", reason: "short-request" });
    expect(hint).toContain("SIMPLE");
    expect(hint).toContain("without approval");
  });

  it("builds full hint", () => {
    const hint = buildComplexityHint({ complexity: "full", reason: "[deep]-tag" });
    expect(hint).toContain("FULL");
    expect(hint).toContain("spec-first");
  });
});
