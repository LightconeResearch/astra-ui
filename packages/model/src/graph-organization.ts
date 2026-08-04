import {
  type AstraGraphEdge,
  type AstraGraphNode,
  type AstraGraphProjectionV1,
  createAstraGraphProjection,
} from './graph.js';
import {
  type OutputRecordView,
  type ProjectViewModelV1,
  type ViewerDiagnostic,
} from './types.js';

export const ASTRA_GRAPH_ORGANIZATION_VERSION = 1 as const;
export const ASTRA_GRAPH_ORGANIZATION_TOPOLOGY_VERSION =
  'astra-graph-organization-topology.v1' as const;

/** The ASTRA-only revision used to decide whether an organization is current. */
export interface AstraGraphOrganizationSourceV1 {
  analysisRevision: string;
  organizationDigest: string;
}

/** A visual grouping of peer outputs. It cannot declare graph edges. */
export interface AstraGraphOutputGroupV1 {
  id: string;
  label: string;
  rationale?: string;
  /** Fully qualified canonical ASTRA output paths. */
  outputs: string[];
}

/**
 * A flat, presentation-only stage inside one real ASTRA scope. `outputs` are
 * direct stage members; `groups` are collapsed one level below the stage.
 */
export interface AstraGraphVisualStageV1 {
  id: string;
  label: string;
  scopeId: string;
  rationale?: string;
  /** Fully qualified canonical ASTRA output paths not placed in a group. */
  outputs?: string[];
  groups?: AstraGraphOutputGroupV1[];
}

/**
 * A constrained visual overlay. Deliberately absent: edges, decisions,
 * recipes, hierarchy, coordinates, visibility, and ASTRA mutations.
 */
export interface AstraGraphOrganizationV1 {
  version: typeof ASTRA_GRAPH_ORGANIZATION_VERSION;
  source: AstraGraphOrganizationSourceV1;
  stages: AstraGraphVisualStageV1[];
}

export interface AstraGraphOrganizationTopologyOutputV1 {
  canonicalPath: string;
  scopeId: string;
  outputType: OutputRecordView['outputType'];
  label?: string;
  description?: string;
  tags?: string[];
  dependencies: string[];
  decisions: string[];
  /** Request-local equality class; raw recipe commands are not exposed. */
  recipeClass?: string;
}

/** Browser-safe, resource-free input suitable for a constrained curator. */
export interface AstraGraphOrganizationTopologyV1 {
  version: typeof ASTRA_GRAPH_ORGANIZATION_TOPOLOGY_VERSION;
  project: {
    id: string;
    name: string;
    description?: string;
    astraVersion?: string;
  };
  source: AstraGraphOrganizationSourceV1;
  scopes: Array<{
    id: string;
    canonicalPath: string;
    name: string;
    parentId?: string;
  }>;
  outputs: AstraGraphOrganizationTopologyOutputV1[];
}

export type AstraGraphOrganizationSourceStatus =
  | 'invalid'
  | 'current'
  | 'compatible'
  | 'outdated';

export interface AstraGraphOrganizationValidation {
  valid: boolean;
  sourceStatus: AstraGraphOrganizationSourceStatus;
  diagnostics: ViewerDiagnostic[];
  assignedOutputPaths: string[];
  unassignedOutputPaths: string[];
}

export interface AstraGraphOrganizationProjectionOptions {
  /** Stable synthetic graph-node ids returned by this projection. */
  expandedNodeIds?: readonly string[];
}

export interface AstraGraphOrganizationParseResult {
  organization?: AstraGraphOrganizationV1;
  diagnostics: ViewerDiagnostic[];
}

export const ASTRA_GRAPH_ORGANIZATION_LIMITS = {
  serializedBytes: 262_144,
  stages: 64,
  groupsPerStage: 64,
  outputsPerList: 256,
  outputReferences: 4_096,
  idCharacters: 64,
  labelCharacters: 160,
  rationaleCharacters: 2_000,
  scopeCharacters: 256,
  pathCharacters: 512,
  revisionCharacters: 256,
  digestCharacters: 128,
} as const;

const SAFE_ORGANIZATION_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UTF8_ENCODER = new TextEncoder();

const PRIMARY_EDGE_KINDS = new Set([
  'flow',
  'produces',
  'supports',
  'concludes',
]);

function diagnostic(
  severity: ViewerDiagnostic['severity'],
  code: string,
  message: string,
  canonicalPath?: string,
): ViewerDiagnostic {
  return {
    severity,
    code,
    message,
    ...(canonicalPath ? { canonicalPath } : {}),
  };
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  diagnostics: ViewerDiagnostic[],
): void {
  for (const key of Object.keys(value)) {
    if (allowed.has(key)) continue;
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_unknown_key',
      `Unknown graph organization field "${key}".`,
      `${path}.${key}`,
    ));
  }
}

function parsedString(
  value: unknown,
  path: string,
  maximum: number,
  diagnostics: ViewerDiagnostic[],
  options: { required?: boolean; id?: boolean } = {},
): string | undefined {
  if (value === undefined && !options.required) return undefined;
  if (typeof value !== 'string') {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_invalid_type',
      `${path} must be a string.`,
      path,
    ));
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_empty_string',
      `${path} cannot be empty.`,
      path,
    ));
    return undefined;
  }
  if (normalized.length > maximum) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_string_limit',
      `${path} exceeds the ${maximum}-character limit.`,
      path,
    ));
    return undefined;
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_control_character',
      `${path} cannot contain control characters.`,
      path,
    ));
    return undefined;
  }
  if (options.id && !SAFE_ORGANIZATION_ID.test(normalized)) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_invalid_id',
      `${path} must match ${SAFE_ORGANIZATION_ID.source}.`,
      path,
    ));
    return undefined;
  }
  return normalized;
}

function parsedOutputList(
  value: unknown,
  path: string,
  diagnostics: ViewerDiagnostic[],
  count: { value: number },
  required: boolean,
): string[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_invalid_type',
      `${path} must be an array of canonical output paths.`,
      path,
    ));
    return undefined;
  }
  if (value.length > ASTRA_GRAPH_ORGANIZATION_LIMITS.outputsPerList) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_array_limit',
      `${path} exceeds the ${ASTRA_GRAPH_ORGANIZATION_LIMITS.outputsPerList}-output limit.`,
      path,
    ));
    return undefined;
  }
  count.value += value.length;
  if (count.value > ASTRA_GRAPH_ORGANIZATION_LIMITS.outputReferences) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_reference_limit',
      `The organization exceeds ${ASTRA_GRAPH_ORGANIZATION_LIMITS.outputReferences} output references.`,
      path,
    ));
    return undefined;
  }
  const outputs: string[] = [];
  for (const [index, item] of value.entries()) {
    const output = parsedString(
      item,
      `${path}.${index}`,
      ASTRA_GRAPH_ORGANIZATION_LIMITS.pathCharacters,
      diagnostics,
      { required: true },
    );
    if (output) outputs.push(output);
  }
  return outputs;
}

/**
 * Strictly parses untrusted curator output. Unknown capabilities are rejected,
 * strings are trimmed, and the returned value contains only allowlisted keys.
 */
export function parseAstraGraphOrganization(
  value: unknown,
): AstraGraphOrganizationParseResult {
  const diagnostics: ViewerDiagnostic[] = [];
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      return {
        diagnostics: [diagnostic(
          'error',
          'graph_organization_invalid_manifest',
          'Graph organization must be a JSON object.',
          'graphOrganization',
        )],
      };
    }
    if (
      UTF8_ENCODER.encode(serialized).byteLength
      > ASTRA_GRAPH_ORGANIZATION_LIMITS.serializedBytes
    ) {
      return {
        diagnostics: [diagnostic(
          'error',
          'graph_organization_size_limit',
          `Graph organization exceeds ${ASTRA_GRAPH_ORGANIZATION_LIMITS.serializedBytes} serialized bytes.`,
          'graphOrganization',
        )],
      };
    }
    const plain: unknown = JSON.parse(serialized);
    const manifest = recordValue(plain);
    if (!manifest) {
      return {
        diagnostics: [diagnostic(
          'error',
          'graph_organization_invalid_manifest',
          'Graph organization must be a JSON object.',
          'graphOrganization',
        )],
      };
    }
    rejectUnknownKeys(
      manifest,
      new Set(['version', 'source', 'stages']),
      'graphOrganization',
      diagnostics,
    );
    if (manifest.version !== ASTRA_GRAPH_ORGANIZATION_VERSION) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_unsupported_version',
        `Graph organization version must be ${ASTRA_GRAPH_ORGANIZATION_VERSION}.`,
        'graphOrganization.version',
      ));
    }

    const sourceValue = recordValue(manifest.source);
    let source: AstraGraphOrganizationSourceV1 | undefined;
    if (!sourceValue) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_invalid_type',
        'graphOrganization.source must be an object.',
        'graphOrganization.source',
      ));
    } else {
      rejectUnknownKeys(
        sourceValue,
        new Set(['analysisRevision', 'organizationDigest']),
        'graphOrganization.source',
        diagnostics,
      );
      const analysisRevision = parsedString(
        sourceValue.analysisRevision,
        'graphOrganization.source.analysisRevision',
        ASTRA_GRAPH_ORGANIZATION_LIMITS.revisionCharacters,
        diagnostics,
        { required: true },
      );
      const organizationDigest = parsedString(
        sourceValue.organizationDigest,
        'graphOrganization.source.organizationDigest',
        ASTRA_GRAPH_ORGANIZATION_LIMITS.digestCharacters,
        diagnostics,
        { required: true },
      );
      if (analysisRevision && organizationDigest) {
        source = { analysisRevision, organizationDigest };
      }
    }

    const stageValues = manifest.stages;
    const stages: AstraGraphVisualStageV1[] = [];
    const referenceCount = { value: 0 };
    if (!Array.isArray(stageValues)) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_invalid_type',
        'graphOrganization.stages must be an array.',
        'graphOrganization.stages',
      ));
    } else if (stageValues.length === 0) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_empty_stages',
        'graphOrganization.stages must contain at least one visual stage.',
        'graphOrganization.stages',
      ));
    } else if (stageValues.length > ASTRA_GRAPH_ORGANIZATION_LIMITS.stages) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_array_limit',
        `graphOrganization.stages exceeds the ${ASTRA_GRAPH_ORGANIZATION_LIMITS.stages}-stage limit.`,
        'graphOrganization.stages',
      ));
    } else {
      for (const [stageIndex, item] of stageValues.entries()) {
        const path = `graphOrganization.stages.${stageIndex}`;
        const stageValue = recordValue(item);
        if (!stageValue) {
          diagnostics.push(diagnostic(
            'error',
            'graph_organization_invalid_type',
            `${path} must be an object.`,
            path,
          ));
          continue;
        }
        rejectUnknownKeys(
          stageValue,
          new Set(['id', 'label', 'scopeId', 'rationale', 'outputs', 'groups']),
          path,
          diagnostics,
        );
        const id = parsedString(
          stageValue.id,
          `${path}.id`,
          ASTRA_GRAPH_ORGANIZATION_LIMITS.idCharacters,
          diagnostics,
          { required: true, id: true },
        );
        const label = parsedString(
          stageValue.label,
          `${path}.label`,
          ASTRA_GRAPH_ORGANIZATION_LIMITS.labelCharacters,
          diagnostics,
          { required: true },
        );
        const scopeId = parsedString(
          stageValue.scopeId,
          `${path}.scopeId`,
          ASTRA_GRAPH_ORGANIZATION_LIMITS.scopeCharacters,
          diagnostics,
          { required: true },
        );
        const rationale = parsedString(
          stageValue.rationale,
          `${path}.rationale`,
          ASTRA_GRAPH_ORGANIZATION_LIMITS.rationaleCharacters,
          diagnostics,
        );
        const outputs = parsedOutputList(
          stageValue.outputs,
          `${path}.outputs`,
          diagnostics,
          referenceCount,
          false,
        );

        const groups: AstraGraphOutputGroupV1[] = [];
        if (stageValue.groups !== undefined) {
          if (!Array.isArray(stageValue.groups)) {
            diagnostics.push(diagnostic(
              'error',
              'graph_organization_invalid_type',
              `${path}.groups must be an array.`,
              `${path}.groups`,
            ));
          } else if (
            stageValue.groups.length
            > ASTRA_GRAPH_ORGANIZATION_LIMITS.groupsPerStage
          ) {
            diagnostics.push(diagnostic(
              'error',
              'graph_organization_array_limit',
              `${path}.groups exceeds the ${ASTRA_GRAPH_ORGANIZATION_LIMITS.groupsPerStage}-group limit.`,
              `${path}.groups`,
            ));
          } else {
            for (const [groupIndex, groupItem] of stageValue.groups.entries()) {
              const groupPath = `${path}.groups.${groupIndex}`;
              const groupValue = recordValue(groupItem);
              if (!groupValue) {
                diagnostics.push(diagnostic(
                  'error',
                  'graph_organization_invalid_type',
                  `${groupPath} must be an object.`,
                  groupPath,
                ));
                continue;
              }
              rejectUnknownKeys(
                groupValue,
                new Set(['id', 'label', 'rationale', 'outputs']),
                groupPath,
                diagnostics,
              );
              const groupId = parsedString(
                groupValue.id,
                `${groupPath}.id`,
                ASTRA_GRAPH_ORGANIZATION_LIMITS.idCharacters,
                diagnostics,
                { required: true, id: true },
              );
              const groupLabel = parsedString(
                groupValue.label,
                `${groupPath}.label`,
                ASTRA_GRAPH_ORGANIZATION_LIMITS.labelCharacters,
                diagnostics,
                { required: true },
              );
              const groupRationale = parsedString(
                groupValue.rationale,
                `${groupPath}.rationale`,
                ASTRA_GRAPH_ORGANIZATION_LIMITS.rationaleCharacters,
                diagnostics,
              );
              const groupOutputs = parsedOutputList(
                groupValue.outputs,
                `${groupPath}.outputs`,
                diagnostics,
                referenceCount,
                true,
              );
              if (groupId && groupLabel && groupOutputs) {
                groups.push({
                  id: groupId,
                  label: groupLabel,
                  ...(groupRationale ? { rationale: groupRationale } : {}),
                  outputs: groupOutputs,
                });
              }
            }
          }
        }
        if (id && label && scopeId) {
          stages.push({
            id,
            label,
            scopeId,
            ...(rationale ? { rationale } : {}),
            ...(outputs ? { outputs } : {}),
            ...(stageValue.groups !== undefined ? { groups } : {}),
          });
        }
      }
    }
    if (
      diagnostics.some((item) => item.severity === 'error')
      || !source
      || !Array.isArray(stageValues)
    ) {
      return { diagnostics };
    }
    return {
      organization: {
        version: ASTRA_GRAPH_ORGANIZATION_VERSION,
        source,
        stages,
      },
      diagnostics,
    };
  } catch {
    return {
      diagnostics: [diagnostic(
        'error',
        'graph_organization_invalid_manifest',
        'Graph organization could not be safely parsed as bounded JSON.',
        'graphOrganization',
      )],
    };
  }
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of UTF8_ENCODER.encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(JSON.stringify(value))}`;
}

function relationPath(
  targetRecordId: string,
  recordsById: ReadonlyMap<string, ProjectViewModelV1['records'][number]>,
  allowedKinds: ReadonlySet<ProjectViewModelV1['records'][number]['kind']>,
): string | undefined {
  let target = recordsById.get(targetRecordId);
  const seen = new Set<string>();
  while (target && !seen.has(target.id)) {
    seen.add(target.id);
    const alias = target.relations.find((relation) => relation.kind === 'aliases');
    if (!alias) break;
    target = recordsById.get(alias.targetRecordId);
  }
  return target && allowedKinds.has(target.kind) ? target.canonicalPath : undefined;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareCanonicalText);
}

function compareCanonicalText(left: string, right: string): number {
  const leftBytes = UTF8_ENCODER.encode(left);
  const rightBytes = UTF8_ENCODER.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
    if (difference) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function recipeKey(output: OutputRecordView): string | undefined {
  const command = output.recipe?.command?.trim();
  const container = output.recipe?.container?.trim();
  if (!command && !container) return undefined;
  return JSON.stringify({
    ...(command ? { command } : {}),
    ...(container ? { container } : {}),
  });
}

function organizationTopologyPayload(model: ProjectViewModelV1): Omit<
  AstraGraphOrganizationTopologyV1,
  'source'
> {
  const recordsById = new Map(model.records.map((record) => [record.id, record]));
  const outputRecords = model.records
    .filter((record): record is OutputRecordView =>
      record.kind === 'output'
      && record.active !== false
      && !record.relations.some((relation) => relation.kind === 'aliases'));
  const recipeKeys = [...new Set(
    outputRecords.flatMap((output) => {
      const key = recipeKey(output);
      return key ? [key] : [];
    }),
  )].sort(compareCanonicalText);
  const recipeClassByKey = new Map(
    recipeKeys.map((key, index) => [key, `recipe-${index + 1}`]),
  );
  const outputs = outputRecords
    .map((output): AstraGraphOrganizationTopologyOutputV1 => ({
      canonicalPath: output.canonicalPath,
      scopeId: output.scopeId,
      outputType: output.outputType,
      ...(output.label ? { label: output.label } : {}),
      ...(output.description ? { description: output.description } : {}),
      ...(output.tags?.length ? { tags: uniqueSorted(output.tags) } : {}),
      dependencies: uniqueSorted(output.relations
        .filter((relation) => relation.kind === 'depends_on')
        .flatMap((relation) => {
          const path = relationPath(
            relation.targetRecordId,
            recordsById,
            new Set(['input', 'output']),
          );
          return path ? [path] : [];
        })),
      decisions: uniqueSorted(output.relations
        .filter((relation) => relation.kind === 'parameterized_by')
        .flatMap((relation) => {
          const path = relationPath(
            relation.targetRecordId,
            recordsById,
            new Set(['decision']),
          );
          return path ? [path] : [];
        })),
      ...(() => {
        const key = recipeKey(output);
        const recipeClass = key ? recipeClassByKey.get(key) : undefined;
        return recipeClass ? { recipeClass } : {};
      })(),
    }))
    .sort((left, right) =>
      compareCanonicalText(left.canonicalPath, right.canonicalPath)
      || compareCanonicalText(left.scopeId, right.scopeId));
  return {
    version: ASTRA_GRAPH_ORGANIZATION_TOPOLOGY_VERSION,
    project: {
      id: model.project.id,
      name: model.project.name,
      ...(model.project.description
        ? { description: model.project.description }
        : {}),
      ...(model.project.astraVersion
        ? { astraVersion: model.project.astraVersion }
        : {}),
    },
    scopes: model.scopes
      .map((scope) => ({
        id: scope.id,
        canonicalPath: scope.canonicalPath,
        name: scope.name,
        ...(scope.parentId ? { parentId: scope.parentId } : {}),
      }))
      .sort((left, right) =>
        compareCanonicalText(left.canonicalPath, right.canonicalPath)
        || compareCanonicalText(left.id, right.id)),
    outputs,
  };
}

/**
 * Non-cryptographic change detector over only the canonical sanitized curator
 * payload. It is for staleness, never integrity or authentication.
 */
export function createAstraGraphOrganizationDigest(
  model: ProjectViewModelV1,
): string {
  return fingerprint(organizationTopologyPayload(model));
}

export function createAstraGraphOrganizationSource(
  model: ProjectViewModelV1,
): AstraGraphOrganizationSourceV1 {
  return {
    analysisRevision: model.revision.analysis,
    organizationDigest: createAstraGraphOrganizationDigest(model),
  };
}

export function createAstraGraphOrganizationTopology(
  model: ProjectViewModelV1,
): AstraGraphOrganizationTopologyV1 {
  return {
    ...organizationTopologyPayload(model),
    source: createAstraGraphOrganizationSource(model),
  };
}

function safeNodeIdPart(value: string): string {
  let encoded = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    encoded += /^[A-Za-z0-9_.-]$/.test(character)
      ? character
      : `~${value.charCodeAt(index).toString(16).padStart(4, '0')}`;
  }
  return encoded;
}

export function astraGraphVisualStageNodeId(
  scopeId: string,
  stageId: string,
): string {
  return `organization:stage:${safeNodeIdPart(scopeId)}:${safeNodeIdPart(stageId)}`;
}

export function astraGraphOutputGroupNodeId(
  scopeId: string,
  stageId: string,
  groupId: string,
): string {
  return `organization:group:${safeNodeIdPart(scopeId)}:${safeNodeIdPart(stageId)}:${safeNodeIdPart(groupId)}`;
}

interface ValidGroup {
  spec: AstraGraphOutputGroupV1;
  nodeId: string;
  paths: string[];
}

interface ValidStage {
  spec: AstraGraphVisualStageV1;
  nodeId: string;
  directPaths: string[];
  groups: ValidGroup[];
  paths: string[];
}

interface OrganizationInspection {
  diagnostics: ViewerDiagnostic[];
  stages: ValidStage[];
  assigned: Set<string>;
  outputByPath: Map<string, AstraGraphNode>;
}

function reachableGroupMembers(
  projection: AstraGraphProjectionV1,
  paths: readonly string[],
  outputByPath: ReadonlyMap<string, AstraGraphNode>,
): [string, string] | undefined {
  const pathById = new Map(
    paths.flatMap((path) => {
      const node = outputByPath.get(path);
      return node ? [[node.id, path] as const] : [];
    }),
  );
  const outgoing = new Map<string, string[]>();
  for (const edge of projection.edges) {
    if (!PRIMARY_EDGE_KINDS.has(edge.kind)) continue;
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  for (const [sourceId, sourcePath] of pathById) {
    const queue = [...(outgoing.get(sourceId) ?? [])];
    const seen = new Set([sourceId]);
    while (queue.length) {
      const current = queue.shift();
      if (!current || seen.has(current)) continue;
      seen.add(current);
      const targetPath = pathById.get(current);
      if (targetPath) return [sourcePath, targetPath];
      queue.push(...(outgoing.get(current) ?? []));
    }
  }
  return undefined;
}

function inspectOrganization(
  projection: AstraGraphProjectionV1,
  organization: AstraGraphOrganizationV1,
): OrganizationInspection {
  const diagnostics: ViewerDiagnostic[] = [];
  const outputByPath = new Map(
    projection.nodes
      .filter((node): node is AstraGraphNode & { canonicalPath: string } =>
        node.kind === 'output' && Boolean(node.canonicalPath))
      .map((node) => [node.canonicalPath, node]),
  );
  const scopeIds = new Set(
    projection.nodes
      .filter((node) => node.kind === 'analysis')
      .map((node) => node.scopeId),
  );
  const stageIdsByScope = new Set<string>();
  const assigned = new Set<string>();
  const stages: ValidStage[] = [];

  if (organization.version !== ASTRA_GRAPH_ORGANIZATION_VERSION) {
    diagnostics.push(diagnostic(
      'error',
      'graph_organization_unsupported_version',
      `Unsupported graph organization version: ${String(organization.version)}.`,
      'graphOrganization.version',
    ));
    return { diagnostics, stages, assigned, outputByPath };
  }

  for (const stage of organization.stages) {
    const stagePath = `graphOrganization.stages.${stage.id}`;
    const scopedStageId = `${stage.scopeId}\0${stage.id}`;
    if (!stage.id.trim() || stageIdsByScope.has(scopedStageId)) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_duplicate_stage',
        `Visual stage id "${stage.id}" is empty or duplicated.`,
        stagePath,
      ));
      continue;
    }
    stageIdsByScope.add(scopedStageId);
    if (!stage.label.trim()) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_missing_label',
        `Visual stage "${stage.id}" needs a label.`,
        stagePath,
      ));
      continue;
    }
    if (!scopeIds.has(stage.scopeId)) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_missing_scope',
        `Visual stage "${stage.id}" references unknown ASTRA scope "${stage.scopeId}".`,
        stagePath,
      ));
      continue;
    }

    const directCandidates: string[] = [];
    const seenInStage = new Set<string>();
    for (const path of stage.outputs ?? []) {
      const output = outputByPath.get(path);
      if (!output) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_missing_output',
          `Visual stage "${stage.id}" references missing output "${path}".`,
          path,
        ));
      } else if (output.scopeId !== stage.scopeId) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_cross_scope',
          `Output "${path}" is outside visual stage scope "${stage.scopeId}".`,
          path,
        ));
      } else if (seenInStage.has(path)) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_duplicate_output',
          `Output "${path}" occurs more than once in visual stage "${stage.id}".`,
          path,
        ));
      } else {
        seenInStage.add(path);
        directCandidates.push(path);
      }
    }

    const groupCandidates: ValidGroup[] = [];
    const groupIdsInStage = new Set<string>();
    for (const group of stage.groups ?? []) {
      const groupPath = `${stagePath}.groups.${group.id}`;
      if (!group.id.trim() || groupIdsInStage.has(group.id)) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_duplicate_group',
          `Output group id "${group.id}" is empty or duplicated.`,
          groupPath,
        ));
        continue;
      }
      groupIdsInStage.add(group.id);
      if (!group.label.trim()) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_missing_label',
          `Output group "${group.id}" needs a label.`,
          groupPath,
        ));
        continue;
      }
      const paths: string[] = [];
      for (const path of group.outputs) {
        const output = outputByPath.get(path);
        if (!output) {
          diagnostics.push(diagnostic(
            'error',
            'graph_organization_missing_output',
            `Output group "${group.id}" references missing output "${path}".`,
            path,
          ));
        } else if (output.scopeId !== stage.scopeId) {
          diagnostics.push(diagnostic(
            'error',
            'graph_organization_cross_scope',
            `Output "${path}" is outside output group scope "${stage.scopeId}".`,
            path,
          ));
        } else if (seenInStage.has(path)) {
          diagnostics.push(diagnostic(
            'error',
            'graph_organization_duplicate_output',
            `Output "${path}" occurs more than once in this visual organization.`,
            path,
          ));
        } else {
          seenInStage.add(path);
          paths.push(path);
        }
      }
      if (paths.length < 2) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_small_group',
          `Output group "${group.id}" needs at least two valid outputs.`,
          groupPath,
        ));
        for (const path of paths) seenInStage.delete(path);
        continue;
      }
      const reachable = reachableGroupMembers(projection, paths, outputByPath);
      if (reachable) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_non_peer_group',
          `Output group "${group.id}" is not a peer set: "${reachable[0]}" reaches "${reachable[1]}" in the canonical DAG.`,
          groupPath,
        ));
        for (const path of paths) seenInStage.delete(path);
        continue;
      }
      groupCandidates.push({
        spec: group,
        nodeId: astraGraphOutputGroupNodeId(stage.scopeId, stage.id, group.id),
        paths,
      });
    }

    const available = (paths: readonly string[]): string[] => paths.filter((path) => {
      if (!assigned.has(path)) return true;
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_duplicate_output',
        `Output "${path}" is assigned to more than one visual stage.`,
        path,
      ));
      return false;
    });
    const directPaths = available(directCandidates);
    const groups: ValidGroup[] = [];
    for (const group of groupCandidates) {
      const paths = available(group.paths);
      if (paths.length < 2) {
        diagnostics.push(diagnostic(
          'error',
          'graph_organization_small_group',
          `Output group "${group.spec.id}" has fewer than two uniquely assigned outputs.`,
          `${stagePath}.groups.${group.spec.id}`,
        ));
        continue;
      }
      groups.push({ ...group, paths });
      for (const path of paths) assigned.add(path);
    }
    for (const path of directPaths) assigned.add(path);
    const paths = [...directPaths, ...groups.flatMap((group) => group.paths)];
    if (!paths.length) {
      diagnostics.push(diagnostic(
        'error',
        'graph_organization_empty_stage',
        `Visual stage "${stage.id}" has no valid outputs.`,
        stagePath,
      ));
      continue;
    }
    stages.push({
      spec: stage,
      nodeId: astraGraphVisualStageNodeId(stage.scopeId, stage.id),
      directPaths,
      groups,
      paths,
    });
  }
  return { diagnostics, stages, assigned, outputByPath };
}

function sourceStatus(
  actual: AstraGraphOrganizationSourceV1,
  expected: AstraGraphOrganizationSourceV1,
): AstraGraphOrganizationSourceStatus {
  if (actual.organizationDigest !== expected.organizationDigest) return 'outdated';
  return actual.analysisRevision === expected.analysisRevision ? 'current' : 'compatible';
}

export function validateAstraGraphOrganization(
  model: ProjectViewModelV1,
  value: unknown,
): AstraGraphOrganizationValidation {
  const projection = createAstraGraphProjection(model, {
    mode: 'lossless',
    includeResult: false,
  });
  const parsed = parseAstraGraphOrganization(value);
  if (!parsed.organization) {
    const outputPaths = projection.nodes
      .filter((node): node is AstraGraphNode & { canonicalPath: string } =>
        node.kind === 'output' && Boolean(node.canonicalPath))
      .map((node) => node.canonicalPath)
      .sort(compareCanonicalText);
    return {
      valid: false,
      sourceStatus: 'invalid',
      diagnostics: parsed.diagnostics,
      assignedOutputPaths: [],
      unassignedOutputPaths: outputPaths,
    };
  }
  const organization = parsed.organization;
  const inspected = inspectOrganization(projection, organization);
  const expected = createAstraGraphOrganizationSource(model);
  const status = sourceStatus(organization.source, expected);
  const diagnostics = [
    ...parsed.diagnostics,
    ...inspected.diagnostics,
    ...(!inspected.diagnostics.some((item) => item.severity === 'error')
      ? organizationSafetyDiagnostics(projection, inspected)
      : []),
  ];
  if (status === 'outdated') {
    diagnostics.push(diagnostic(
      'warning',
      'graph_organization_source_outdated',
      'The ASTRA topology has changed since this visual organization was generated.',
      'graphOrganization.source',
    ));
  } else if (status === 'compatible') {
    diagnostics.push(diagnostic(
      'info',
      'graph_organization_revision_advanced',
      'The ASTRA revision changed, but the curator-visible topology is unchanged.',
      'graphOrganization.source',
    ));
  }
  const outputPaths = [...inspected.outputByPath.keys()].sort(compareCanonicalText);
  return {
    valid: !diagnostics.some((item) => item.severity === 'error'),
    sourceStatus: status,
    diagnostics,
    assignedOutputPaths: [...inspected.assigned].sort(compareCanonicalText),
    unassignedOutputPaths: outputPaths.filter((path) => !inspected.assigned.has(path)),
  };
}

function aggregateNode(
  kind: 'visual-stage' | 'output-group',
  id: string,
  label: string,
  scopeId: string,
  paths: string[],
  rationale?: string,
): AstraGraphNode {
  return {
    id,
    kind,
    label,
    title: label,
    scopeId,
    ...(rationale ? { description: rationale } : {}),
    meta: [
      kind === 'visual-stage' ? 'visual stage' : 'organized output group',
      `${paths.length} outputs`,
    ],
    memberPaths: paths,
    synthetic: true,
  };
}

interface EdgeAccumulator {
  source: string;
  target: string;
  kind: AstraGraphEdge['kind'];
  label?: string;
  parentId?: string;
  semanticEdgeIds: Set<string>;
  coveredTargetIds: Set<string>;
}

function quotientProjection(
  projection: AstraGraphProjectionV1,
  inspected: OrganizationInspection,
  expanded: ReadonlySet<string>,
): AstraGraphProjectionV1 {
  const representative = new Map<string, string>();
  const syntheticNodes: AstraGraphNode[] = [];
  const aggregateById = new Map<string, AstraGraphNode>();

  for (const stage of inspected.stages) {
    if (!expanded.has(stage.nodeId)) {
      const node = aggregateNode(
        'visual-stage',
        stage.nodeId,
        stage.spec.label,
        stage.spec.scopeId,
        stage.paths,
        stage.spec.rationale,
      );
      syntheticNodes.push(node);
      aggregateById.set(node.id, node);
      for (const path of stage.paths) {
        const output = inspected.outputByPath.get(path);
        if (output) representative.set(output.id, node.id);
      }
      continue;
    }
    for (const group of stage.groups) {
      if (expanded.has(group.nodeId)) continue;
      const node = aggregateNode(
        'output-group',
        group.nodeId,
        group.spec.label,
        stage.spec.scopeId,
        group.paths,
        group.spec.rationale,
      );
      syntheticNodes.push(node);
      aggregateById.set(node.id, node);
      for (const path of group.paths) {
        const output = inspected.outputByPath.get(path);
        if (output) representative.set(output.id, node.id);
      }
    }
  }

  const nodes = [
    ...projection.nodes.filter((node) => !representative.has(node.id)),
    ...syntheticNodes,
  ];
  const accumulators = new Map<string, EdgeAccumulator>();
  const rawOutputIds = new Set(
    [...inspected.outputByPath.values()].map((node) => node.id),
  );
  for (const edge of projection.edges) {
    const source = representative.get(edge.source) ?? edge.source;
    const target = representative.get(edge.target) ?? edge.target;
    if (source === target) continue;
    const signature = `${source}\0${target}\0${edge.kind}\0${edge.parentId ?? ''}`;
    const accumulator = accumulators.get(signature) ?? {
      source,
      target,
      kind: edge.kind,
      ...(edge.label ? { label: edge.label } : {}),
      ...(edge.parentId ? { parentId: edge.parentId } : {}),
      semanticEdgeIds: new Set<string>(),
      coveredTargetIds: new Set<string>(),
    };
    for (const id of edge.semanticEdgeIds ?? [edge.id]) {
      accumulator.semanticEdgeIds.add(id);
    }
    if (rawOutputIds.has(edge.target)) accumulator.coveredTargetIds.add(edge.target);
    accumulators.set(signature, accumulator);
  }

  const edges = [...accumulators.values()].map((accumulator, index): AstraGraphEdge => {
    const aggregateTarget = aggregateById.get(accumulator.target);
    const total = aggregateTarget?.memberPaths?.length ?? 0;
    const coverage = accumulator.kind === 'configures'
      && total > 1
      && accumulator.coveredTargetIds.size > 0
      ? `affects ${accumulator.coveredTargetIds.size}/${total}`
      : undefined;
    return {
      id: `organization-edge:${index + 1}`,
      source: accumulator.source,
      target: accumulator.target,
      kind: accumulator.kind,
      ...(coverage ?? accumulator.label
        ? { label: coverage ?? accumulator.label }
        : {}),
      ...(accumulator.parentId ? { parentId: accumulator.parentId } : {}),
      semanticEdgeIds: [...accumulator.semanticEdgeIds],
    };
  });
  return { ...projection, nodes, edges };
}

function hasPrimaryCycle(projection: AstraGraphProjectionV1): boolean {
  const ids = new Set(projection.nodes.map((node) => node.id));
  const outgoing = new Map([...ids].map((id) => [id, [] as string[]]));
  const incoming = new Map([...ids].map((id) => [id, 0]));
  for (const edge of projection.edges) {
    if (!PRIMARY_EDGE_KINDS.has(edge.kind) || !ids.has(edge.source) || !ids.has(edge.target)) {
      continue;
    }
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    if (!id) continue;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const next = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  return visited !== ids.size;
}

function organizationSafetyDiagnostics(
  projection: AstraGraphProjectionV1,
  inspected: OrganizationInspection,
): ViewerDiagnostic[] {
  if (hasPrimaryCycle(projection)) {
    return [diagnostic(
      'error',
      'graph_organization_raw_cycle',
      'The canonical lossless graph contains a provenance cycle; organization was rejected and the raw graph must remain visible.',
      'graphOrganization.stages',
    )];
  }
  const collapsed = quotientProjection(projection, inspected, new Set());
  if (hasPrimaryCycle(collapsed)) {
    return [diagnostic(
      'error',
      'graph_organization_stage_cycle',
      'Collapsing the proposed visual stages would introduce a provenance cycle.',
      'graphOrganization.stages',
    )];
  }
  const expandedStages = new Set(inspected.stages.map((stage) => stage.nodeId));
  const grouped = quotientProjection(projection, inspected, expandedStages);
  if (hasPrimaryCycle(grouped)) {
    return [diagnostic(
      'error',
      'graph_organization_group_cycle',
      'Collapsing the proposed output groups would introduce a provenance cycle.',
      'graphOrganization.stages',
    )];
  }
  return [];
}

/**
 * Applies the overlay as a reversible quotient over a lossless projection.
 * Stages collapse first; expanding one reveals its direct outputs and output
 * groups; expanding a group reveals the exact canonical output nodes.
 */
export function createAstraGraphOrganizationProjection(
  projection: AstraGraphProjectionV1,
  value: unknown,
  options: AstraGraphOrganizationProjectionOptions = {},
): AstraGraphProjectionV1 {
  const parsed = parseAstraGraphOrganization(value);
  if (!parsed.organization) {
    return {
      ...projection,
      diagnostics: [...projection.diagnostics, ...parsed.diagnostics],
    };
  }
  const organization = parsed.organization;
  const inspected = inspectOrganization(projection, organization);
  const diagnostics = [
    ...projection.diagnostics,
    ...parsed.diagnostics,
    ...inspected.diagnostics,
  ];
  if (inspected.diagnostics.some((item) => item.severity === 'error')) {
    return { ...projection, diagnostics };
  }
  const safetyDiagnostics = organizationSafetyDiagnostics(projection, inspected);
  if (safetyDiagnostics.length) {
    return {
      ...projection,
      diagnostics: [...diagnostics, ...safetyDiagnostics],
    };
  }
  const organized = quotientProjection(
    projection,
    inspected,
    new Set(options.expandedNodeIds ?? []),
  );
  if (hasPrimaryCycle(organized)) {
    return {
      ...projection,
      diagnostics: [
        ...diagnostics,
        diagnostic(
          'error',
          'graph_organization_cycle',
          'This organization would introduce a cycle in the visual quotient; the lossless graph was retained.',
          'graphOrganization.stages',
        ),
      ],
    };
  }
  return { ...organized, diagnostics };
}
