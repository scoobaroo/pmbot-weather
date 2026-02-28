import { parseMarketTitle } from "../../market/parser";

describe("parseMarketTitle", () => {
  it("parses range bucket with full city name", () => {
    const result = parseMarketTitle(
      "Will the high temperature in New York City on February 25 be between 40°F and 44°F?"
    );
    expect(result).toEqual({
      city: "nyc",
      date: expect.stringMatching(/^\d{4}-02-25$/),
      metric: "high",
      bucketLower: 40,
      bucketUpper: 44,
      bucketLabel: "40-44°F",
      unit: "°F",
    });
  });

  it("parses 'or higher' bucket", () => {
    const result = parseMarketTitle(
      "Will the high temperature in Chicago on February 26 be 50°F or higher?"
    );
    expect(result).toEqual({
      city: "chicago",
      date: expect.stringMatching(/^\d{4}-02-26$/),
      metric: "high",
      bucketLower: 50,
      bucketUpper: null,
      bucketLabel: "50°F or higher",
      unit: "°F",
    });
  });

  it("parses 'or lower' bucket", () => {
    const result = parseMarketTitle(
      "Will the high temperature in Seoul on March 1 be 35°F or lower?"
    );
    expect(result).toEqual({
      city: "seoul",
      date: expect.stringMatching(/^\d{4}-03-01$/),
      metric: "high",
      bucketLower: null,
      bucketUpper: 35,
      bucketLabel: "35°F or lower",
      unit: "°F",
    });
  });

  it("parses NYC abbreviation", () => {
    const result = parseMarketTitle(
      "Will the high temperature in NYC on February 25 be between 45°F and 49°F?"
    );
    expect(result).not.toBeNull();
    expect(result!.city).toBe("nyc");
  });

  it("parses London", () => {
    const result = parseMarketTitle(
      "Will the high temperature in London on March 2 be between 50°F and 54°F?"
    );
    expect(result).not.toBeNull();
    expect(result!.city).toBe("london");
  });

  it("returns null for non-weather market", () => {
    const result = parseMarketTitle("Will Bitcoin reach $100k by March?");
    expect(result).toBeNull();
  });

  it("returns null for unknown city", () => {
    const result = parseMarketTitle(
      "Will the high temperature in Tokyo on March 1 be between 40°F and 44°F?"
    );
    expect(result).toBeNull();
  });

  it("parses negative temperatures", () => {
    const result = parseMarketTitle(
      "Will the high temperature in Chicago on January 15 be between -5°F and 0°F?"
    );
    expect(result).not.toBeNull();
    expect(result!.bucketLower).toBe(-5);
    expect(result!.bucketUpper).toBe(0);
  });

  it("parses 'highest temperature' (real Polymarket format)", () => {
    const result = parseMarketTitle(
      "Will the highest temperature in New York City be between 32-33°F on March 1?"
    );
    expect(result).not.toBeNull();
    expect(result!.city).toBe("nyc");
    expect(result!.metric).toBe("high");
    expect(result!.bucketLower).toBe(32);
    expect(result!.bucketUpper).toBe(33);
    expect(result!.bucketLabel).toBe("32-33°F");
    expect(result!.unit).toBe("°F");
  });

  it("parses 'or below' bucket (real Polymarket format)", () => {
    const result = parseMarketTitle(
      "Will the highest temperature in New York City be 31°F or below on March 1?"
    );
    expect(result).not.toBeNull();
    expect(result!.bucketLower).toBeNull();
    expect(result!.bucketUpper).toBe(31);
    expect(result!.bucketLabel).toBe("31°F or lower");
    expect(result!.unit).toBe("°F");
  });

  it("parses Celsius range with em-dash", () => {
    const result = parseMarketTitle(
      "Will the highest temperature in London be between 7–8°C on March 1?"
    );
    expect(result).not.toBeNull();
    expect(result!.city).toBe("london");
    expect(result!.bucketLower).toBe(7);
    expect(result!.bucketUpper).toBe(8);
    expect(result!.bucketLabel).toBe("7-8°C");
    expect(result!.unit).toBe("°C");
  });

  it("parses Celsius 'or below'", () => {
    const result = parseMarketTitle(
      "Will the highest temperature in London be 6°C or below on March 1?"
    );
    expect(result).not.toBeNull();
    expect(result!.bucketLower).toBeNull();
    expect(result!.bucketUpper).toBe(6);
    expect(result!.bucketLabel).toBe("6°C or lower");
    expect(result!.unit).toBe("°C");
  });

  it("parses negative Celsius", () => {
    const result = parseMarketTitle(
      "Will the highest temperature in Seoul be -11°C or below on March 1?"
    );
    expect(result).not.toBeNull();
    expect(result!.city).toBe("seoul");
    expect(result!.bucketUpper).toBe(-11);
    expect(result!.bucketLabel).toBe("-11°C or lower");
    expect(result!.unit).toBe("°C");
  });
});
