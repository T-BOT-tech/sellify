// Phase 19.8 — Explainable Discovery Ranking Contract.
// Ranking explains and orders already-eligible deterministic matches. It owns
// no source truth, trust score, persistence, or transaction execution.

export const DISCOVERY_RANKING_VERSION = '1.0';

const norm = value => String(value == null ? '' : value).trim().toLowerCase();

function candidateKey(candidate = {}) {
  return norm(candidate.organizationId
    || candidate.sourceEntityId
    || candidate.organization?.id
    || candidate.productReference?.productId
    || candidate.title);
}

function candidateLabel(candidate = {}) {
  return String(candidate.organization?.name
    || candidate.organizationName
    || candidate.seller?.name
    || candidate.title
    || candidateKey(candidate));
}

function explainFactor(factor) {
  return Object.freeze({
    dimension: String(factor?.dimension || 'UNKNOWN'),
    points: Number(factor?.points || 0),
    reason: String(factor?.reason || 'Deterministic match factor'),
  });
}

export function explainDiscoveryMatch(candidate = {}, match = {}) {
  const eligible = Boolean(match.eligible);
  const factors = Array.isArray(match.factors) ? match.factors.map(explainFactor) : [];
  const hardConstraints = Array.isArray(match.hardConstraints)
    ? match.hardConstraints.map(c => Object.freeze({
      dimension: String(c?.dimension || 'UNKNOWN'),
      requested: Boolean(c?.requested),
      satisfied: Boolean(c?.satisfied),
    }))
    : [];

  return Object.freeze({
    rankingVersion: DISCOVERY_RANKING_VERSION,
    eligible,
    matchScore: eligible && Number.isFinite(Number(match.matchScore)) ? Number(match.matchScore) : null,
    rank: null,
    candidate: Object.freeze({
      organizationId: candidate.organizationId || candidate.organization?.id || null,
      label: candidateLabel(candidate),
      source: candidate.source || null,
      sourceAuthority: candidate.sourceAuthority || null,
      sourceEntityId: candidate.sourceEntityId || null,
    }),
    factors: Object.freeze(factors),
    hardConstraints: Object.freeze(hardConstraints),
    explanation: Object.freeze({
      summary: eligible
        ? `Eligible candidate with deterministic match score ${Number(match.matchScore || 0)}.`
        : 'Candidate excluded because one or more requested hard constraints were not satisfied.',
      factorCount: factors.length,
      satisfiedHardConstraintCount: hardConstraints.filter(c => c.requested && c.satisfied).length,
      failedHardConstraintCount: hardConstraints.filter(c => c.requested && !c.satisfied).length,
    }),
    trustScore: match.trustScore ?? null,
    deterministic: true,
    ai: false,
  });
}

export function rankDiscoveryMatches(evaluated = []) {
  const eligible = evaluated
    .filter(item => item?.match?.eligible)
    .map(item => ({
      ...item,
      explanation: explainDiscoveryMatch(item.candidate, item.match),
    }))
    .sort((a, b) => (Number(b.match.matchScore || 0) - Number(a.match.matchScore || 0))
      || norm(candidateLabel(a.candidate)).localeCompare(norm(candidateLabel(b.candidate)))
      || candidateKey(a.candidate).localeCompare(candidateKey(b.candidate))
      || ((a.index ?? 0) - (b.index ?? 0)));

  return eligible.map((item, index) => ({
    ...item,
    explanation: Object.freeze({ ...item.explanation, rank: index + 1 }),
  }));
}

export function explainableDiscoveryRankingContract() {
  return Object.freeze({
    version: DISCOVERY_RANKING_VERSION,
    authority: 'discovery_ranking',
    persistence: 'none',
    consumesDeterministicMatchOnly: true,
    preservesMatchScore: true,
    matchScoreDistinctFromTrustScore: true,
    trustScoreOwnedElsewhere: true,
    aiRanking: false,
    transactionExecution: false,
    opportunityPersistence: false,
    explanationIncludesFactors: true,
    explanationIncludesHardConstraints: true,
  });
}
