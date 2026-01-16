export interface AuditNodeLike {
	_id?: string;
	id?: string;
	relatedObjectId?: string;
	qaOperationId?: string;
	qaOperationRelatedObjectId?: string;
	qaOperation?: {
		_id?: string;
		relatedObjectId?: string;
	};
}

export type AuditLinkMap = Record<string, { qaId: string; batchId: string }>;

// Build a lookup map from assigned-operation-nodes response
export function buildAuditLinkMap(data: unknown): AuditLinkMap {
	const map: AuditLinkMap = {};
	const nodes: AuditNodeLike[] = Array.isArray(data)
		? (data as AuditNodeLike[])
		: Array.isArray((data as any)?.nodes)
		? (data as any).nodes
		: [];


	for (const audit of nodes) {
		const qaId = audit?.qaOperation?._id || audit?.qaOperationId;
		const batchId =
			audit?.qaOperation?.relatedObjectId ||
			audit?.relatedObjectId ||
			audit?.qaOperationRelatedObjectId;
		const fullId = audit?._id || audit?.id || qaId;
		if (!qaId || !batchId || !fullId) continue;

		const fullKey = String(fullId);
		const first5 = fullKey.substring(0, 5);
		const last5 = fullKey.slice(-5);
		map[fullKey] = { qaId, batchId };
		map[first5] = { qaId, batchId };
		map[last5] = { qaId, batchId };
	}

	return map;
}

export function buildLookupUrl(batchId: string): string {
	// Lookup links do not include closeOnComplete=1 to avoid starting timers
	return `https://app.outlier.ai/en/expert/outlieradmin/tools/chat_bulk_audit/${batchId}`;
}

export function deriveCellKeyCandidates(textContent: string): {
	exact?: string;
	prefix?: string;
	suffix?: string;
} {
	const raw = (textContent || "").trim();
	if (!raw) return {};
	return { exact: raw, prefix: raw.substring(0, 5), suffix: raw.slice(-5) };
}
