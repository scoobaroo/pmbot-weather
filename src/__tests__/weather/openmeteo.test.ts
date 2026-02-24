import { fetchEnsembleForecast } from "../../weather/openmeteo";
import { CityConfig, EnsembleModelConfig } from "../../config/types";

// Mock global fetch
const originalFetch = global.fetch;

const mockCity: CityConfig = {
  name: "New York City",
  slug: "nyc",
  latitude: 40.7128,
  longitude: -74.006,
  timezone: "America/New_York",
  country: "US",
};

const mockModel: EnsembleModelConfig = {
  name: "GFS",
  memberCount: 2,
  apiParam: "gfs_seamless",
};

describe("fetchEnsembleForecast", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses ensemble members from response", async () => {
    const mockResponse = {
      hourly: {
        time: ["2025-02-25T00:00", "2025-02-25T01:00", "2025-02-25T02:00"],
        temperature_2m_member00: [40, 45, 42],
        temperature_2m_member01: [38, 43, 41],
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchEnsembleForecast(
      "https://ensemble-api.open-meteo.com/v1/ensemble",
      mockCity,
      mockModel
    );

    expect(result.model).toBe("GFS");
    expect(result.city).toBe("nyc");
    expect(result.members).toHaveLength(2);
    expect(result.members[0].temperatures).toEqual([40, 45, 42]);
    expect(result.members[1].temperatures).toEqual([38, 43, 41]);
  });

  it("throws on API error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Server error"),
    });

    await expect(
      fetchEnsembleForecast(
        "https://ensemble-api.open-meteo.com/v1/ensemble",
        mockCity,
        { ...mockModel, memberCount: 1 }
      )
    ).rejects.toThrow();
  }, 30_000);
});
