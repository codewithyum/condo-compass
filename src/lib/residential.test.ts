import { describe, expect, it } from "vitest";
import { classifyResidential } from "./residential";

describe("residential classification — mixed-use condo towers", () => {
  it("classifies a Solo District / Stratus mixed-use tower as residential, not excluded", () => {
    // Real-world style tags for Stratus at Solo District (2008 Rosser Ave),
    // a tall residential tower with retail/office on the podium.
    const tags = {
      name: "Stratus at Solo District",
      building: "yes",
      "building:part": "apartments",
      "building:levels": "45",
      shop: "yes",
      office: "company",
      "addr:housenumber": "2008",
      "addr:street": "Rosser Avenue",
      "addr:city": "Burnaby",
    };
    const { status } = classifyResidential(tags);
    expect(status).not.toBe("Unlikely residential");
    expect([
      "Likely residential",
      "Possible residential building",
      "Possible mixed-use residential building",
    ]).toContain(status);
  });

  it("flags a residential+commercial building as possible mixed-use", () => {
    const tags = {
      name: "Solo District Tower",
      building: "apartments",
      shop: "supermarket",
      "building:levels": "50",
    };
    const { status } = classifyResidential(tags);
    expect(status).toBe("Possible mixed-use residential building");
  });

  it("recognises building:use=residential and addr:flats", () => {
    const tags = {
      building: "yes",
      "building:use": "residential",
      "addr:flats": "1-120",
      "addr:housenumber": "4007",
      "addr:street": "Rosser Avenue",
    };
    const { status } = classifyResidential(tags);
    expect(status).not.toBe("Unlikely residential");
  });

  it("treats a high-rise (by height) with retail podium as residential", () => {
    const tags = {
      building: "yes",
      height: "120 m",
      shop: "mall",
    };
    const { status } = classifyResidential(tags);
    expect(status).toBe("Possible mixed-use residential building");
  });

  it("still excludes clearly non-residential commercial buildings", () => {
    const tags = { building: "retail", shop: "supermarket" };
    const { status } = classifyResidential(tags);
    expect(status).toBe("Unlikely residential");
  });
});
