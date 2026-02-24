import { aggregateForecasts, extractDailyHighs, computeBucketProbabilities } from "../../weather/aggregator";
import { EnsembleForecast, EnsembleMember } from "../../weather/types";

function makeMember(model: string, index: number, temps: number[], date: string): EnsembleMember {
  const times = temps.map((_, i) => `${date}T${String(i).padStart(2, "0")}:00`);
  return { model, memberIndex: index, temperatures: temps, times };
}

function makeForecast(model: string, members: EnsembleMember[]): EnsembleForecast {
  return {
    city: "nyc",
    date: "2025-02-25",
    model,
    members,
    fetchedAt: new Date().toISOString(),
  };
}

describe("extractDailyHighs", () => {
  it("extracts daily max from each member", () => {
    const members = [
      makeMember("GFS", 0, [40, 45, 50, 48, 42], "2025-02-25"),
      makeMember("GFS", 1, [38, 43, 47, 46, 40], "2025-02-25"),
    ];

    const highs = extractDailyHighs(members, "2025-02-25");
    expect(highs).toEqual([50, 47]);
  });

  it("returns empty for wrong date", () => {
    const members = [makeMember("GFS", 0, [40, 45, 50], "2025-02-25")];
    const highs = extractDailyHighs(members, "2025-02-26");
    expect(highs).toEqual([]);
  });
});

describe("computeBucketProbabilities", () => {
  it("computes correct probabilities", () => {
    // 10 samples: 38, 40, 42, 44, 46, 48, 50, 52, 54, 56
    const samples = [38, 40, 42, 44, 46, 48, 50, 52, 54, 56];
    const buckets = [
      { lower: null, upper: 39, label: "39°F or lower" },
      { lower: 40, upper: 49, label: "40-49°F" },
      { lower: 50, upper: null, label: "50°F or higher" },
    ];

    const result = computeBucketProbabilities(samples, buckets);
    expect(result[0].probability).toBe(0.1); // just 38
    expect(result[1].probability).toBe(0.5); // 40,42,44,46,48
    expect(result[2].probability).toBe(0.4); // 50,52,54,56
  });

  it("handles all samples in one bucket", () => {
    const samples = [50, 51, 52];
    const buckets = [{ lower: 40, upper: 60, label: "40-60°F" }];
    const result = computeBucketProbabilities(samples, buckets);
    expect(result[0].probability).toBe(1);
  });
});

describe("aggregateForecasts", () => {
  it("aggregates multiple models into bucket probabilities", () => {
    const forecasts: EnsembleForecast[] = [
      makeForecast("GFS", [
        makeMember("GFS", 0, [40, 50, 45], "2025-02-25"),
        makeMember("GFS", 1, [42, 52, 47], "2025-02-25"),
      ]),
      makeForecast("ECMWF", [
        makeMember("ECMWF", 0, [41, 51, 46], "2025-02-25"),
        makeMember("ECMWF", 1, [43, 48, 44], "2025-02-25"),
      ]),
    ];

    const buckets = [
      { lower: null, upper: 49, label: "49°F or lower" },
      { lower: 50, upper: null, label: "50°F or higher" },
    ];

    const result = aggregateForecasts(forecasts, "2025-02-25", buckets);

    expect(result.totalMembers).toBe(4);
    expect(result.highTemps).toHaveLength(4);
    // highs: 50, 52, 51, 48
    expect(result.highTemps.sort()).toEqual([48, 50, 51, 52]);
    expect(result.bucketProbabilities).toHaveLength(2);
    // 48 is ≤49, so 1 out of 4 = 0.25
    expect(result.bucketProbabilities[0].probability).toBe(0.25);
    // 50,51,52 are ≥50, so 3 out of 4 = 0.75
    expect(result.bucketProbabilities[1].probability).toBe(0.75);
  });

  it("throws when no members available", () => {
    expect(() =>
      aggregateForecasts([], "2025-02-25", [])
    ).toThrow("No ensemble members");
  });
});
