/**
 * Redis Cluster / ElastiCache Serverless expose a cluster-style API. Bull uses
 * pipelines/Lua that touch multiple keys; they must hash to the same slot or
 * Redis returns: CROSSSLOT Keys in request don't hash to the same slot.
 *
 * A hash tag is the substring inside the first {...} in a key; all keys that
 * share the same tag are co-located. Queue names below embed `{cp}` so every
 * Bull key for that queue shares one slot.
 *
 * Changing these names creates new Redis key namespaces (old queued jobs are
 * not migrated).
 *
 * @see https://redis.io/docs/reference/cluster-spec/#hash-tags
 */
module.exports = {
  CODE_EXECUTION_SINGLE: '{cp}code-execution-single',
  CODE_EXECUTION_BATCH: '{cp}code-execution-batch',
  PROJECT_EVALUATION: '{cp}project-evaluation'
};
