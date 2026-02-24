import { kellySize } from "../../strategy/kelly";

describe("kellySize", () => {
  it("computes correct half-kelly for positive edge", () => {
    // forecast 70%, market 50%, bankroll $1000, half-kelly
    const result = kellySize(0.7, 0.5, 1000, 0.5);

    // fullKelly = (0.7 - 0.5) / (1 - 0.5) = 0.4
    expect(result.fullKelly).toBeCloseTo(0.4);
    // halfKelly = 0.4 * 0.5 = 0.2
    expect(result.fractionalKelly).toBeCloseTo(0.2);
    // size = 0.2 * 1000 = 200
    expect(result.sizeUsd).toBe(200);
  });

  it("returns zero for no edge", () => {
    const result = kellySize(0.5, 0.5, 1000);
    expect(result.fullKelly).toBe(0);
    expect(result.sizeUsd).toBe(0);
  });

  it("returns zero for negative edge", () => {
    const result = kellySize(0.3, 0.5, 1000);
    expect(result.sizeUsd).toBe(0);
  });

  it("returns zero for invalid market price", () => {
    expect(kellySize(0.7, 0, 1000).sizeUsd).toBe(0);
    expect(kellySize(0.7, 1, 1000).sizeUsd).toBe(0);
    expect(kellySize(0.7, -0.1, 1000).sizeUsd).toBe(0);
  });

  it("returns zero for zero bankroll", () => {
    const result = kellySize(0.7, 0.5, 0);
    expect(result.sizeUsd).toBe(0);
  });

  it("clamps kelly fraction to 1", () => {
    // extreme edge: forecast 99%, market 1%
    const result = kellySize(0.99, 0.01, 1000, 1.0);
    expect(result.fractionalKelly).toBeLessThanOrEqual(1);
  });

  it("handles small edges correctly", () => {
    // forecast 55%, market 50%
    const result = kellySize(0.55, 0.5, 1000, 0.5);
    // fullKelly = 0.05 / 0.5 = 0.1
    expect(result.fullKelly).toBeCloseTo(0.1);
    // halfKelly = 0.05
    expect(result.fractionalKelly).toBeCloseTo(0.05);
    expect(result.sizeUsd).toBe(50);
  });
});
