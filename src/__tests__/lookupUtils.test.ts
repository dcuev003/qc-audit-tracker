import { describe, it, expect } from "vitest";
import {
	buildAuditLinkMap,
	buildLookupUrl,
	deriveCellKeyCandidates,
} from "@/shared/lookupUtils";

describe("lookupUtils", () => {
	it("builds link map from nodes array (full and short keys)", () => {
		const data = {
			nodes: [
				{
					_id: "e0f7d12345abcdef67890123",
					qaOperation: {
						_id: "qaop_111111111111111111111111",
						relatedObjectId: "rel_aaaaaaaaaaaaaaaaaaaaaaaa",
					},
				},
				{
					id: "abcdexxxxxyyyyyzzzzz00000",
					qaOperationId: "qaop_222222222222222222222222",
					qaOperationRelatedObjectId: "rel_bbbbbbbbbbbbbbbbbbbbbbbb",
				},
			],
		};

		const map = buildAuditLinkMap(data);
    expect(map["e0f7d12345abcdef67890123"]).toEqual({
        qaId: "qaop_111111111111111111111111",
        batchId: "rel_aaaaaaaaaaaaaaaaaaaaaaaa",
    });
		// Prefix and suffix keys should both work
    expect(map["e0f7d"]).toEqual({
        qaId: "qaop_111111111111111111111111",
        batchId: "rel_aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(map["90123"]).toEqual({
        qaId: "qaop_111111111111111111111111",
        batchId: "rel_aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(map["abcdexxxxxyyyyyzzzzz00000"]).toEqual({
        qaId: "qaop_222222222222222222222222",
        batchId: "rel_bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(map["abcde"]).toEqual({
        qaId: "qaop_222222222222222222222222",
        batchId: "rel_bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(map["00000"]).toEqual({
        qaId: "qaop_222222222222222222222222",
        batchId: "rel_bbbbbbbbbbbbbbbbbbbbbbbb",
    });
	});

	it("builds the correct lookup URL", () => {
		const url = buildLookupUrl("batch_x");
		expect(url).toBe(
			"https://app.outlier.ai/en/expert/outlieradmin/tools/chat_bulk_audit/batch_x"
		);
	});

	it("derives key candidates from cell text", () => {
		const keys = deriveCellKeyCandidates(" e0f7d123 ");
		expect(keys.exact).toBe("e0f7d123");
		expect(keys.prefix).toBe("e0f7d");
		expect(keys.suffix).toBe("7d123");
	});
});
