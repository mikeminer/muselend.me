import { MuseLendRiskManagerAbi } from "@muselend/abis";
import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { proposalData } from "./governance-proposal";

describe("governance proposal payloads", () => {
  it("encodes bounded cap changes without arbitrary calldata", () => {
    const data = proposalData("caps", [250_000n * 10n ** 6n, 200_000n * 10n ** 6n], 0, undefined, false, undefined, undefined);
    expect(data).toBeDefined();
    const decoded = decodeFunctionData({ abi: MuseLendRiskManagerAbi, data: data! });
    expect(decoded.functionName).toBe("setGlobalCaps");
    expect(decoded.args).toEqual([250_000n * 10n ** 6n, 200_000n * 10n ** 6n]);
  });

  it("refuses an origination fee beyond the on-chain maximum", () => {
    expect(proposalData("fee", [1n, 1n], 201, undefined, false, undefined, undefined)).toBeUndefined();
  });
});
