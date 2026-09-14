import { describe, it, expect } from "vitest";
import { nextDriverLabelCode, resolveStickerDriver } from "../shared/driverLabelCode";
describe("driver sticker codes", () => {
  it("allocates short codes without filling old gaps", () => {
    expect(nextDriverLabelCode([])).toBe("D01");
    expect(nextDriverLabelCode(["D01", "D05"])).toBe("D06");
    expect(nextDriverLabelCode(["D99"])).toBe("D100");
  });
  const plan = {customerId:"c", deliveryTime:"MORNING", status:"PREPARED", driverId:"daily"};
  it("uses daily assignment before the default", () => {
    expect(resolveStickerDriver([plan],"c","MORNING","default")).toBe("daily");
  });
  it("isolates shifts and ignores cancelled plans", () => {
    expect(resolveStickerDriver([plan],"c","EVENING","default")).toBe("default");
    expect(resolveStickerDriver([{...plan,status:"CANCELLED"}],"c","MORNING","default")).toBe("default");
  });
  it("uses default for unassigned and template-only customers", () => {
    expect(resolveStickerDriver([{...plan,driverId:undefined}],"c","MORNING","default")).toBe("default");
    expect(resolveStickerDriver([],"c","MORNING","default")).toBe("default");
    expect(resolveStickerDriver([],"c","MORNING")).toBe(null);
  });
  it("refuses conflicting assignments", () => {
    expect(resolveStickerDriver([plan,{...plan,driverId:"other"}],"c","MORNING","default")).toBe(null);
  });
});
