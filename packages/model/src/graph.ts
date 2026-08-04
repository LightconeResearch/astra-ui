import {
  type AstraRecordKind,
  type DecisionOptionView,
  type DecisionRecordView,
  type FindingRecordView,
  type OutputRecordView,
  type PriorInsightRecordView,
  type ProjectRecordView,
  type ProjectScopeView,
  type ProjectViewModelV1,
  type ViewerDiagnostic,
} from './types.js';

export const ASTRA_GRAPH_PROJECTION_VERSION = 1 as const;
export const ASTRA_GRAPH_VIEW_VERSION = 1 as const;

export type AstraGraphNodeKind =
  | 'analysis'
  | 'visual-stage'
  | 'input'
  | 'input-group'
  | 'output'
  | 'output-group'
  | 'decision-cluster'
  | 'decision'
  | 'finding'
  | 'finding-group'
  | 'prior-insight'
  | 'result';

export type AstraGraphEdgeKind =
  | 'flow'
  | 'produces'
  | 'configures'
  | 'inherits'
  | 'locks'
  | 'requires'
  | 'supports'
  | 'informs'
  | 'concludes';

export type AstraGraphLane =
  | 'far-left'
  | 'left'
  | 'main'
  | 'right'
  | 'far-right';

export interface AstraGraphNodeLayout {
  order?: number;
  lane?: AstraGraphLane;
}

export interface AstraGraphNode {
  id: string;
  kind: AstraGraphNodeKind;
  label: string;
  scopeId: string;
  title?: string;
  canonicalPath?: string;
  recordId?: string;
  description?: string;
  meta: string[];
  memberPaths?: string[];
  parentId?: string;
  targetId?: string;
  selectedOptionId?: string;
  options?: DecisionOptionView[];
  synthetic?: boolean;
  layout?: AstraGraphNodeLayout;
}

export interface AstraGraphEdge {
  id: string;
  source: string;
  target: string;
  kind: AstraGraphEdgeKind;
  label?: string;
  parentId?: string;
  semanticEdgeIds?: string[];
}

export interface AstraGraphProjectionV1 {
  version: typeof ASTRA_GRAPH_PROJECTION_VERSION;
  project: ProjectViewModelV1['project'];
  universe: {
    id: string;
    source: ProjectViewModelV1['selection']['source'];
  };
  nodes: AstraGraphNode[];
  edges: AstraGraphEdge[];
  diagnostics: ViewerDiagnostic[];
}

export interface AstraGraphProjectionOptions {
  /**
   * `lossless` keeps every active canonical input, output, and finding as its
   * own node. The default `overview` mode may compact large repeated sets.
   */
  mode?: 'overview' | 'lossless';
  groupOutputs?: boolean;
  outputGroupThreshold?: number;
  maxOutputNodes?: number;
  maxInputNodes?: number;
  maxFindingNodes?: number;
  includeResult?: boolean;
  resultLabel?: string;
}

export interface AstraGraphNodeSelector {
  nodeIds?: string[];
  kinds?: AstraGraphNodeKind[];
  scopeIds?: string[];
  canonicalPaths?: string[];
}

export interface AstraGraphViewNodeSpec {
  id: string;
  kind: Exclude<AstraGraphNodeKind, 'decision' | 'decision-cluster' | 'prior-insight'>;
  select: AstraGraphNodeSelector;
  label?: string;
  title?: string;
  description?: string;
  order?: number;
  lane?: AstraGraphLane;
}

export interface AstraGraphViewEdgeSpec {
  source: string;
  target: string;
  kind?: Extract<AstraGraphEdgeKind, 'flow' | 'produces' | 'supports' | 'concludes'>;
}

export interface AstraGraphDecisionTargetSpec {
  node: string;
  kind?: Extract<AstraGraphEdgeKind, 'configures' | 'inherits'>;
}

export interface AstraGraphDecisionGroupSpec {
  id: string;
  target: string;
  members: string[];
  label?: string;
  title?: string;
  description?: string;
  scopeId?: string;
  targets?: AstraGraphDecisionTargetSpec[];
}

export interface AstraGraphViewSpecV1 {
  version: typeof ASTRA_GRAPH_VIEW_VERSION;
  nodes: AstraGraphViewNodeSpec[];
  edges?: AstraGraphViewEdgeSpec[];
  decisionGroups?: AstraGraphDecisionGroupSpec[];
}

interface ProjectionSettings {
  lossless: boolean;
  groupOutputs: boolean;
  outputGroupThreshold: number;
  maxOutputNodes: number;
  maxInputNodes: number;
  maxFindingNodes: number;
  includeResult: boolean;
  resultLabel?: string;
}

interface ProjectionIndex {
  recordById: Map<string, ProjectRecordView>;
  scopeById: Map<string, ProjectScopeView>;
  recordsByScope: Map<string, ProjectRecordView[]>;
}

const OVERVIEW_EDGE_KINDS = new Set<AstraGraphEdgeKind>([
  'flow',
  'produces',
  'supports',
  'concludes',
]);

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function graphNodeId(kind: string, value: string): string {
  return `${kind}:${value}`;
}

function buildIndex(model: ProjectViewModelV1): ProjectionIndex {
  const recordsByScope = new Map<string, ProjectRecordView[]>();
  for (const record of model.records) {
    const records = recordsByScope.get(record.scopeId) ?? [];
    records.push(record);
    recordsByScope.set(record.scopeId, records);
  }
  return {
    recordById: new Map(model.records.map((record) => [record.id, record])),
    scopeById: new Map(model.scopes.map((scope) => [scope.id, scope])),
    recordsByScope,
  };
}

function canonicalRecord(
  record: ProjectRecordView,
  index: ProjectionIndex,
  allowedKinds: readonly AstraRecordKind[],
  seen = new Set<string>(),
): ProjectRecordView | undefined {
  if (seen.has(record.id)) return undefined;
  seen.add(record.id);
  const alias = record.relations.find((relation) => relation.kind === 'aliases');
  if (!alias) return allowedKinds.includes(record.kind) ? record : undefined;
  const target = index.recordById.get(alias.targetRecordId);
  return target
    ? canonicalRecord(target, index, allowedKinds, seen)
    : undefined;
}

function recipeFamily(output: OutputRecordView): string | undefined {
  const command = output.recipe?.command?.trim();
  if (!command) return undefined;
  const tokens = command.replace(/\s+/g, ' ').split(' ');
  return tokens.find((token) => /\.(?:py|r|jl|sh)$/i.test(token))
    ?? tokens.slice(0, 2).join(' ');
}

function commonIdPrefix(records: readonly ProjectRecordView[]): string {
  const split = records.map((record) => record.localId.split('_'));
  const common: string[] = [];
  for (let index = 0; ; index += 1) {
    const token = split[0]?.[index];
    if (!token || split.some((parts) => parts[index] !== token)) break;
    common.push(token);
  }
  return common.join('_');
}

function commonLabelPrefix(labels: readonly string[]): string {
  if (labels.length < 2) return labels[0] ?? '';
  const split = labels.map((label) => label.split(/\s+/));
  const common: string[] = [];
  for (let index = 0; ; index += 1) {
    const token = split[0]?.[index];
    if (!token || split.some((parts) => parts[index] !== token)) break;
    common.push(token);
  }
  return common.join(' ');
}

function groupLabel(records: readonly ProjectRecordView[], fallback: string): string {
  const prefix = commonLabelPrefix(
    records.map((record) => record.label ?? humanize(record.localId)),
  );
  const useful = prefix.split(/\s+/).length >= 2 ? prefix : fallback;
  return `${useful} ×${records.length}`;
}

function pluralOutputType(value: string): string {
  const normalized = humanize(value).toLowerCase();
  if (normalized === 'data' || normalized === 'dataset') return 'Datasets';
  if (normalized.endsWith('s')) return humanize(value);
  if (normalized.endsWith('y')) return `${humanize(value).slice(0, -1)}ies`;
  return `${humanize(value)}s`;
}

function recordIdTokens(record: ProjectRecordView): string[] {
  return record.localId.split(/[_-]+/).filter(Boolean);
}

function lexicalInputGroups(
  inputs: readonly ProjectRecordView[],
): ProjectRecordView[][] {
  const remaining = new Map(inputs.map((input) => [input.id, input]));
  const groups: ProjectRecordView[][] = [];
  while (remaining.size > 1) {
    const candidates = new Map<string, ProjectRecordView[]>();
    for (const input of remaining.values()) {
      const tokens = recordIdTokens(input);
      for (let length = 2; length < tokens.length; length += 1) {
        const prefix = tokens.slice(0, length).join('_');
        const members = candidates.get(prefix) ?? [];
        members.push(input);
        candidates.set(prefix, members);
      }
    }
    const best = [...candidates.entries()]
      .filter(([, members]) => members.length > 1)
      .sort(([leftPrefix, left], [rightPrefix, right]) =>
        right.length - left.length
        || rightPrefix.split('_').length - leftPrefix.split('_').length
        || leftPrefix.localeCompare(rightPrefix))[0];
    if (!best) break;
    const members = best[1];
    groups.push(members);
    for (const member of members) remaining.delete(member.id);
  }
  return groups;
}

function inputFamily(id: string): string {
  const normalized = id.replace(/_(?:pre|post)$/i, '');
  const tokens = normalized.split('_');
  return tokens.length > 1 ? tokens.slice(0, -1).join('_') : normalized;
}

function relationTargets(
  record: ProjectRecordView,
  kind: ProjectRecordView['relations'][number]['kind'],
): string[] {
  return record.relations
    .filter((relation) => relation.kind === kind)
    .map((relation) => relation.targetRecordId);
}

function addEdge(
  edges: AstraGraphEdge[],
  seen: Set<string>,
  source: string | undefined,
  target: string | undefined,
  kind: AstraGraphEdgeKind,
  extra: Partial<Pick<AstraGraphEdge, 'label' | 'parentId' | 'semanticEdgeIds'>> = {},
): void {
  if (!source || !target || source === target) return;
  const signature = `${source}\0${target}\0${kind}\0${extra.parentId ?? ''}`;
  if (seen.has(signature)) return;
  seen.add(signature);
  edges.push({
    id: `edge:${edges.length + 1}`,
    source,
    target,
    kind,
    ...extra,
  });
}

function outputPresentation(
  outputs: readonly OutputRecordView[],
  settings: ProjectionSettings,
): { nodes: AstraGraphNode[]; nodeByRecordId: Map<string, string> } {
  interface OutputBatch {
    records: OutputRecordView[];
    fallbackLabel: string;
    key: string;
  }

  const batches: OutputBatch[] = [];
  const grouped = new Map<string, OutputRecordView[]>();
  for (const output of outputs) {
    const family = recipeFamily(output);
    const key = settings.groupOutputs && family
      ? [output.scopeId, output.outputType, family].join('\0')
      : output.id;
    const group = grouped.get(key) ?? [];
    group.push(output);
    grouped.set(key, group);
  }

  const leftovers = new Map<string, OutputRecordView[]>();
  for (const [key, group] of grouped) {
    if (settings.groupOutputs && group.length >= settings.outputGroupThreshold) {
      const prefix = commonIdPrefix(group) || group[0]?.outputType || 'output';
      batches.push({
        records: group,
        fallbackLabel: humanize(prefix),
        key: `recipe:${key}`,
      });
      continue;
    }
    for (const output of group) {
      const category = [output.scopeId, output.outputType].join('\0');
      const records = leftovers.get(category) ?? [];
      records.push(output);
      leftovers.set(category, records);
    }
  }

  for (const [category, records] of leftovers) {
    if (settings.groupOutputs && records.length >= settings.outputGroupThreshold) {
      batches.push({
        records,
        fallbackLabel: pluralOutputType(records[0]?.outputType ?? 'output'),
        key: `category:${category}`,
      });
    } else {
      batches.push(...records.map((output) => ({
        records: [output],
        fallbackLabel: output.label ?? humanize(output.localId),
        key: `record:${output.id}`,
      })));
    }
  }

  if (!settings.lossless && batches.length > settings.maxOutputNodes) {
    const byCategory = new Map<string, OutputRecordView[]>();
    for (const batch of batches) {
      const first = batch.records[0];
      if (!first) continue;
      const key = `${first.scopeId}\0${first.outputType}`;
      const members = byCategory.get(key) ?? [];
      members.push(...batch.records);
      byCategory.set(key, members);
    }
    const compacted = [...byCategory.entries()].map(([key, records]) => ({
      records,
      fallbackLabel: pluralOutputType(records[0]?.outputType ?? 'output'),
      key: `compact:${key}`,
    }));
    batches.splice(0, batches.length, ...compacted);
  }

  const nodes: AstraGraphNode[] = [];
  const nodeByRecordId = new Map<string, string>();
  for (const batch of batches) {
    const first = batch.records[0];
    if (!first) continue;
    const isGroup = batch.records.length > 1;
    const id = isGroup
      ? graphNodeId('output-group', batch.key)
      : graphNodeId('output', first.id);
    const memberPaths = batch.records.map((output) => output.canonicalPath);
    nodes.push({
      id,
      kind: isGroup ? 'output-group' : 'output',
      label: isGroup
        ? groupLabel(batch.records, batch.fallbackLabel)
        : first.label ?? humanize(first.localId),
      title: isGroup
        ? `${batch.records.length} related ${humanize(first.outputType).toLowerCase()} outputs`
        : first.label ?? humanize(first.localId),
      scopeId: first.scopeId,
      ...(!isGroup ? {
        canonicalPath: first.canonicalPath,
        recordId: first.id,
      } : {}),
      ...(isGroup ? {
        description: 'Related outputs grouped to keep the provenance overview readable.',
        memberPaths,
      } : first.description ? { description: first.description } : {}),
      meta: [
        `type: ${first.outputType}`,
        ...(first.recipe?.command ? [`recipe: ${first.recipe.command}`] : []),
        ...(isGroup ? [`${batch.records.length} records`] : []),
      ],
    });
    for (const output of batch.records) nodeByRecordId.set(output.id, id);
  }
  return { nodes, nodeByRecordId };
}

function inputPresentation(
  inputs: readonly ProjectRecordView[],
  settings: ProjectionSettings,
): { nodes: AstraGraphNode[]; nodeByRecordId: Map<string, string> } {
  const nodes: AstraGraphNode[] = [];
  const nodeByRecordId = new Map<string, string>();
  const groups = !settings.lossless && inputs.length > settings.maxInputNodes
    ? lexicalInputGroups(inputs)
    : [];
  const groupedIds = new Set(
    groups
      .flatMap((group) => group.map((record) => record.id)),
  );
  for (const group of groups) {
    const first = group[0];
    if (!first) continue;
    const family = commonIdPrefix(group) || inputFamily(first.localId);
    const id = graphNodeId('input-group', `${first.scopeId}:${family}`);
    nodes.push({
      id,
      kind: 'input-group',
      label: groupLabel(group, humanize(family)),
      title: `${group.length} related inputs`,
      scopeId: first.scopeId,
      description: 'Related inputs grouped to keep the provenance overview readable.',
      meta: [`${group.length} records`],
      memberPaths: group.map((input) => input.canonicalPath),
    });
    for (const input of group) nodeByRecordId.set(input.id, id);
  }
  for (const input of inputs) {
    if (groupedIds.has(input.id) || input.kind !== 'input') continue;
    const id = graphNodeId('input', input.id);
    nodes.push({
      id,
      kind: 'input',
      label: input.label ?? humanize(input.localId),
      title: input.label ?? humanize(input.localId),
      scopeId: input.scopeId,
      canonicalPath: input.canonicalPath,
      recordId: input.id,
      ...(input.description ? { description: input.description } : {}),
      meta: [
        `type: ${input.inputType ?? 'data'}`,
        ...(input.source ? [`source: ${input.source}`] : []),
        ...(input.reference ? [`analysis: ${input.reference}`] : []),
      ],
    });
    nodeByRecordId.set(input.id, id);
  }
  return { nodes, nodeByRecordId };
}

function selectedInsightIds(decision: DecisionRecordView): string[] {
  const selected = decision.options.find((option) => option.selected)
    ?? decision.options.find((option) => option.id === decision.selectedOptionId);
  return selected?.insightRecordIds ? [...selected.insightRecordIds] : [];
}

export function createAstraGraphProjection(
  model: ProjectViewModelV1,
  options: AstraGraphProjectionOptions = {},
): AstraGraphProjectionV1 {
  const settings: ProjectionSettings = {
    lossless: options.mode === 'lossless',
    groupOutputs: options.mode === 'lossless' ? false : options.groupOutputs ?? true,
    outputGroupThreshold: Math.max(2, options.outputGroupThreshold ?? 3),
    maxOutputNodes: Math.max(4, options.maxOutputNodes ?? 18),
    maxInputNodes: Math.max(3, options.maxInputNodes ?? 8),
    maxFindingNodes: Math.max(1, options.maxFindingNodes ?? 4),
    includeResult: options.includeResult ?? true,
    ...(options.resultLabel ? { resultLabel: options.resultLabel } : {}),
  };
  const index = buildIndex(model);
  // The inventory already surfaces project-wide loading/materialization
  // diagnostics. Keep this channel specific to graph projection and curated
  // view validation so unrelated compatibility notices do not read as graph
  // failures in every host.
  const diagnostics: ViewerDiagnostic[] = [];
  const nodes: AstraGraphNode[] = [];
  const edges: AstraGraphEdge[] = [];
  const edgeSeen = new Set<string>();
  const analysisNodeByScope = new Map<string, string>();

  for (const scope of model.scopes) {
    const id = graphNodeId('analysis', scope.id);
    const scopeRecords = index.recordsByScope.get(scope.id) ?? [];
    analysisNodeByScope.set(scope.id, id);
    nodes.push({
      id,
      kind: 'analysis',
      label: scope.name,
      title: scope.name,
      scopeId: scope.id,
      ...(scope.canonicalPath !== 'root' ? { canonicalPath: scope.canonicalPath } : {}),
      ...(scope.description ? { description: scope.description } : {}),
      meta: [
        `${scopeRecords.filter((record) => record.kind === 'input').length} inputs`,
        `${scopeRecords.filter((record) => record.kind === 'output').length} outputs`,
        `${scopeRecords.filter((record) => record.kind === 'decision').length} declared decisions`,
      ],
    });
  }

  const canonicalInputs = model.records
    .filter((record) => record.kind === 'input' && record.active !== false)
    .filter((record) => canonicalRecord(record, index, ['input'])?.id === record.id);
  const inputs = inputPresentation(canonicalInputs, settings);
  nodes.push(...inputs.nodes);

  const canonicalOutputs = model.records
    .filter((record): record is OutputRecordView =>
      record.kind === 'output' && record.active !== false)
    .filter((record) => canonicalRecord(record, index, ['output'])?.id === record.id);
  const outputs = outputPresentation(canonicalOutputs, settings);
  nodes.push(...outputs.nodes);

  for (const scope of model.scopes) {
    const stage = analysisNodeByScope.get(scope.id);
    const scopeRecords = index.recordsByScope.get(scope.id) ?? [];
    if (!settings.lossless) {
      for (const declaredInput of scopeRecords.filter((record) => record.kind === 'input')) {
        const canonical = canonicalRecord(declaredInput, index, ['input', 'output']);
        const source = canonical?.kind === 'output'
          ? outputs.nodeByRecordId.get(canonical.id)
          : canonical ? inputs.nodeByRecordId.get(canonical.id) : undefined;
        addEdge(edges, edgeSeen, source, stage, 'flow');
      }
    }
    for (const output of scopeRecords.filter(
      (record): record is OutputRecordView => record.kind === 'output' && record.active !== false,
    )) {
      const canonical = canonicalRecord(output, index, ['output']);
      if (!canonical || canonical.id !== output.id) continue;
      const target = outputs.nodeByRecordId.get(output.id);
      let hasLocalOutputDependency = false;
      let hasLosslessDependency = false;
      for (const dependencyId of relationTargets(output, 'depends_on')) {
        const dependencyRecord = index.recordById.get(dependencyId);
        const dependency = dependencyRecord
          ? canonicalRecord(dependencyRecord, index, ['input', 'output'])
          : undefined;
        if (!dependency) continue;
        const source = dependency.kind === 'output'
          ? outputs.nodeByRecordId.get(dependency.id)
          : inputs.nodeByRecordId.get(dependency.id);
        if (settings.lossless) {
          if (source && target) {
            hasLosslessDependency = true;
            addEdge(edges, edgeSeen, source, target, 'flow');
          }
          continue;
        }
        if (dependency.kind === 'output') {
          if (dependency.scopeId === output.scopeId) {
            hasLocalOutputDependency = true;
            addEdge(edges, edgeSeen, source, target, 'flow');
          } else {
            addEdge(edges, edgeSeen, source, stage, 'flow');
          }
        } else {
          addEdge(edges, edgeSeen, source, stage, 'flow');
        }
      }
      if (settings.lossless ? !hasLosslessDependency : !hasLocalOutputDependency) {
        addEdge(edges, edgeSeen, stage, target, 'produces');
      }
    }
  }

  const insightNodeByRecordId = new Map<string, string>();
  const findingNodeByRecordId = new Map<string, string>();
  for (const scope of model.scopes) {
    const scopeRecords = index.recordsByScope.get(scope.id) ?? [];
    for (const insight of scopeRecords.filter(
      (record): record is PriorInsightRecordView =>
        record.kind === 'prior_insight' && record.active !== false,
    )) {
      const id = graphNodeId('insight', insight.id);
      insightNodeByRecordId.set(insight.id, id);
      nodes.push({
        id,
        kind: 'prior-insight',
        label: insight.label ?? humanize(insight.localId),
        title: insight.label ?? humanize(insight.localId),
        scopeId: insight.scopeId,
        canonicalPath: insight.canonicalPath,
        recordId: insight.id,
        ...(insight.claim ?? insight.description ?? insight.notes
          ? { description: insight.claim ?? insight.description ?? insight.notes }
          : {}),
        meta: insight.evidence.flatMap((evidence) => [
          ...(evidence.doi ? [`DOI: ${evidence.doi}`] : []),
          ...(evidence.quote ? [`quote: ${evidence.quote}`] : []),
        ]),
      });
    }
    const findings = scopeRecords.filter(
      (record): record is FindingRecordView =>
        record.kind === 'finding' && record.active !== false,
    );
    const groupFindings = !settings.lossless && findings.length > settings.maxFindingNodes;
    const findingGroupId = graphNodeId('finding-group', scope.id);
    if (groupFindings) {
      nodes.push({
        id: findingGroupId,
        kind: 'finding-group',
        label: `Findings ×${findings.length}`,
        title: `${findings.length} findings`,
        scopeId: scope.id,
        description: findings
          .map((finding) => finding.claim ?? finding.label ?? humanize(finding.localId))
          .join(' · '),
        meta: [`${findings.length} records`],
        memberPaths: findings.map((finding) => finding.canonicalPath),
      });
    }
    for (const finding of findings) {
      const id = groupFindings ? findingGroupId : graphNodeId('finding', finding.id);
      findingNodeByRecordId.set(finding.id, id);
      if (!groupFindings) {
        nodes.push({
          id,
          kind: 'finding',
          label: finding.label ?? humanize(finding.localId),
          title: finding.label ?? humanize(finding.localId),
          scopeId: finding.scopeId,
          canonicalPath: finding.canonicalPath,
          recordId: finding.id,
          ...(finding.claim ?? finding.description ?? finding.notes
            ? { description: finding.claim ?? finding.description ?? finding.notes }
            : {}),
          meta: [],
        });
      }
      const evidenceTargets = new Set([
        ...relationTargets(finding, 'evidenced_by'),
        ...finding.evidence.flatMap((evidence) =>
          evidence.artifactRecordId ? [evidence.artifactRecordId] : []),
      ]);
      for (const evidenceTarget of evidenceTargets) {
        const artifact = index.recordById.get(evidenceTarget)
          ?? model.records.find((record) => record.canonicalPath === evidenceTarget);
        const canonical = artifact ? canonicalRecord(artifact, index, ['output']) : undefined;
        addEdge(
          edges,
          edgeSeen,
          canonical ? outputs.nodeByRecordId.get(canonical.id) : undefined,
          id,
          'supports',
        );
      }
    }
  }

  const impactsByScope = new Map<string, Map<string, DecisionRecordView>>();
  const affectedByScopeDecision = new Map<string, Set<string>>();
  const affectedOutputsByScopeDecision = new Map<string, Set<string>>();
  for (const scope of model.scopes) {
    const declared = (index.recordsByScope.get(scope.id) ?? []).filter(
      (record): record is DecisionRecordView =>
        record.kind === 'decision' && record.active !== false,
    );
    impactsByScope.set(scope.id, new Map(declared.map((decision) => [decision.id, decision])));
  }
  for (const output of canonicalOutputs) {
    for (const relation of output.relations.filter(
      (item) => item.kind === 'parameterized_by',
    )) {
      const record = index.recordById.get(relation.targetRecordId);
      const canonical = record ? canonicalRecord(record, index, ['decision']) : undefined;
      if (!canonical || canonical.kind !== 'decision') continue;
      const impacts = impactsByScope.get(output.scopeId) ?? new Map<string, DecisionRecordView>();
      impacts.set(canonical.id, canonical);
      impactsByScope.set(output.scopeId, impacts);
      const key = `${output.scopeId}\0${canonical.id}`;
      const affected = affectedByScopeDecision.get(key) ?? new Set<string>();
      const outputNode = outputs.nodeByRecordId.get(output.id);
      if (outputNode) affected.add(outputNode);
      affectedByScopeDecision.set(key, affected);
      const affectedOutputs = affectedOutputsByScopeDecision.get(key) ?? new Set<string>();
      affectedOutputs.add(output.id);
      affectedOutputsByScopeDecision.set(key, affectedOutputs);
    }
  }

  const decisionNodesByRecordId = new Map<string, AstraGraphNode[]>();
  for (const scope of model.scopes) {
    const decisions = [...(impactsByScope.get(scope.id)?.values() ?? [])];
    if (!decisions.length) continue;
    const stage = analysisNodeByScope.get(scope.id);
    const clusterId = graphNodeId('decision-cluster', scope.id);
    const memberIds: string[] = [];
    nodes.push({
      id: clusterId,
      kind: 'decision-cluster',
      label: `${decisions.length} decision${decisions.length === 1 ? '' : 's'}`,
      title: `${scope.name} decisions`,
      scopeId: scope.id,
      description: 'Methodological choices that parameterize this analysis stage and its outputs.',
      meta: [],
      memberPaths: memberIds,
      ...(stage ? { targetId: stage } : {}),
    });
    addEdge(edges, edgeSeen, clusterId, stage, 'configures');
    for (const [position, decision] of decisions.entries()) {
      const id = graphNodeId('decision', `${scope.id}:${position + 1}:${decision.id}`);
      memberIds.push(id);
      const selected = decision.options.find((option) => option.selected)
        ?? decision.options.find((option) => option.id === decision.selectedOptionId);
      const affected = affectedByScopeDecision.get(`${scope.id}\0${decision.id}`);
      const affectedOutputCount = affectedOutputsByScopeDecision
        .get(`${scope.id}\0${decision.id}`)?.size ?? 0;
      const inherited = decision.scopeId !== scope.id;
      const node: AstraGraphNode = {
        id,
        kind: 'decision',
        label: `${decision.label ?? humanize(decision.localId)}${selected ? ` = ${selected.label ?? humanize(selected.id)}` : ''}`,
        title: decision.label ?? humanize(decision.localId),
        scopeId: scope.id,
        canonicalPath: decision.canonicalPath,
        recordId: decision.id,
        ...(decision.rationale ?? decision.description
          ? { description: decision.rationale ?? decision.description }
          : {}),
        meta: [
          ...(decision.tags?.length ? [`tags: ${decision.tags.join(', ')}`] : []),
          ...(inherited
            ? [`inherited from: ${index.scopeById.get(decision.scopeId)?.name ?? decision.scopeId}`]
            : []),
          ...(affectedOutputCount
            ? [`affects ${affectedOutputCount} output${affectedOutputCount === 1 ? '' : 's'}`]
            : []),
        ],
        parentId: clusterId,
        ...(stage ? { targetId: stage } : {}),
        ...(decision.selectedOptionId ? { selectedOptionId: decision.selectedOptionId } : {}),
        options: decision.options,
      };
      nodes.push(node);
      const clones = decisionNodesByRecordId.get(decision.id) ?? [];
      clones.push(node);
      decisionNodesByRecordId.set(decision.id, clones);
      if (inherited) addEdge(edges, edgeSeen, id, stage, 'inherits', { parentId: clusterId });
      if (affected?.size) {
        for (const target of affected) {
          addEdge(edges, edgeSeen, id, target, 'configures', { parentId: clusterId });
        }
      } else {
        addEdge(edges, edgeSeen, id, stage, 'configures', { parentId: clusterId });
      }
    }
  }

  for (const decision of model.records.filter(
    (record): record is DecisionRecordView => record.kind === 'decision',
  )) {
    const decisionNode = decisionNodesByRecordId.get(decision.id)?.[0];
    for (const insightId of selectedInsightIds(decision)) {
      addEdge(
        edges,
        edgeSeen,
        insightNodeByRecordId.get(insightId),
        decisionNode?.id,
        'informs',
      );
    }
  }

  if (settings.includeResult) {
    const resultId = 'result:project';
    const resultLabel = settings.resultLabel ?? `${model.project.name} result`;
    nodes.push({
      id: resultId,
      kind: 'result',
      label: resultLabel,
      title: resultLabel,
      scopeId: model.scopes.find((scope) => !scope.parentId)?.id ?? 'root',
      description: 'Display summary assembled from the terminal findings and outputs in this project.',
      meta: [`universe: ${model.selection.universeId ?? 'not selected'}`],
      synthetic: true,
    });
    const findingNodes = new Set(findingNodeByRecordId.values());
    if (findingNodes.size) {
      for (const findingNode of findingNodes) {
        addEdge(edges, edgeSeen, findingNode, resultId, 'concludes');
      }
    } else {
      const outgoing = new Set(
        edges
          .filter((edge) => edge.kind === 'flow' || edge.kind === 'produces')
          .map((edge) => edge.source),
      );
      const terminalOutputs = outputs.nodes.filter((node) => !outgoing.has(node.id));
      const terminals = terminalOutputs.length
        ? terminalOutputs.map((node) => node.id)
        : [...analysisNodeByScope.values()];
      for (const terminal of terminals) {
        addEdge(edges, edgeSeen, terminal, resultId, 'concludes');
      }
    }
  }

  return {
    version: ASTRA_GRAPH_PROJECTION_VERSION,
    project: model.project,
    universe: {
      id: model.selection.universeId ?? 'unselected',
      source: model.selection.source,
    },
    nodes,
    edges,
    diagnostics,
  };
}

function globExpression(pattern: string): RegExp {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

function matchesAnyPattern(value: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => globExpression(pattern).test(value));
}

function nodePaths(node: AstraGraphNode): string[] {
  return node.memberPaths ?? (node.canonicalPath ? [node.canonicalPath] : []);
}

function selectedNodePaths(
  node: AstraGraphNode,
  selector: AstraGraphNodeSelector,
): string[] | undefined {
  if (selector.nodeIds?.length && !selector.nodeIds.includes(node.id)) return undefined;
  if (selector.kinds?.length && !selector.kinds.includes(node.kind)) return undefined;
  if (selector.scopeIds?.length && !selector.scopeIds.includes(node.scopeId)) return undefined;
  const paths = nodePaths(node);
  if (!selector.canonicalPaths?.length) return paths;
  const selected = paths.filter((path) =>
    matchesAnyPattern(path, selector.canonicalPaths ?? []));
  return selected.length ? selected : undefined;
}

function formatCountLabel(template: string, count: number): string {
  return template.replace(/\{count\}/g, String(count));
}

function semanticPath(
  projection: AstraGraphProjectionV1,
  sourceIds: ReadonlySet<string>,
  targetIds: ReadonlySet<string>,
  stopAt?: ReadonlyMap<string, string>,
  expectedTargetView?: string,
): AstraGraphEdge[] | undefined {
  const outgoing = new Map<string, AstraGraphEdge[]>();
  for (const edge of projection.edges) {
    if (!OVERVIEW_EDGE_KINDS.has(edge.kind)) continue;
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }
  const queue = [...sourceIds].map((id) => ({ id, path: [] as AstraGraphEdge[] }));
  const visited = new Set(sourceIds);
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    for (const edge of outgoing.get(current.id) ?? []) {
      const path = [...current.path, edge];
      if (targetIds.has(edge.target)) return path;
      const selectedView = stopAt?.get(edge.target);
      if (selectedView && selectedView !== expectedTargetView) continue;
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);
      queue.push({ id: edge.target, path });
    }
  }
  return undefined;
}

function inferredOverviewEdgeKind(
  source: AstraGraphNode,
  target: AstraGraphNode,
  semanticKinds: readonly AstraGraphEdgeKind[],
): AstraGraphEdgeKind {
  if (semanticKinds.includes('concludes') || target.kind === 'result') return 'concludes';
  if (
    semanticKinds.includes('supports')
    || target.kind === 'finding'
    || target.kind === 'finding-group'
  ) return 'supports';
  return source.kind === 'analysis' ? 'produces' : 'flow';
}

function viewDiagnostic(
  code: string,
  message: string,
  canonicalPath: string,
): ViewerDiagnostic {
  return { severity: 'warning', code, message, canonicalPath };
}

export function createAstraGraphViewProjection(
  projection: AstraGraphProjectionV1,
  spec: AstraGraphViewSpecV1,
): AstraGraphProjectionV1 {
  if (spec.version !== ASTRA_GRAPH_VIEW_VERSION) {
    throw new Error(`Unsupported ASTRA graph view version: ${spec.version}`);
  }
  const diagnostics = [...projection.diagnostics];
  const nodes: AstraGraphNode[] = [];
  const edges: AstraGraphEdge[] = [];
  const edgeSeen = new Set<string>();
  const sourceToView = new Map<string, string>();
  const sourcesByView = new Map<string, Set<string>>();
  const viewBySpecId = new Map<string, AstraGraphNode>();
  const contentSources = projection.nodes.filter((node) =>
    node.kind !== 'decision'
    && node.kind !== 'decision-cluster'
    && node.kind !== 'prior-insight');

  for (const nodeSpec of spec.nodes) {
    const selected: Array<{ node: AstraGraphNode; paths: string[] }> = [];
    for (const source of contentSources) {
      const paths = selectedNodePaths(source, nodeSpec.select);
      if (paths !== undefined) selected.push({ node: source, paths });
    }
    if (!selected.length) {
      diagnostics.push(viewDiagnostic(
        'graph_view_unmatched_node',
        `View node "${nodeSpec.id}" did not match any semantic records.`,
        `graphView.nodes.${nodeSpec.id}`,
      ));
      continue;
    }
    const first = selected[0]?.node;
    if (!first) continue;
    const id = `view:${nodeSpec.id}`;
    const sourceIds = new Set(selected.map((item) => item.node.id));
    const memberPaths = [...new Set(selected.flatMap((item) => item.paths))];
    const count = memberPaths.length || selected.length;
    const isGroup = nodeSpec.kind.endsWith('-group');
    const canonicalPath = !isGroup && memberPaths.length === 1
      ? memberPaths[0]
      : undefined;
    const label = nodeSpec.label
      ? formatCountLabel(nodeSpec.label, count)
      : first.label;
    const node: AstraGraphNode = {
      ...first,
      id,
      kind: nodeSpec.kind,
      label,
      title: nodeSpec.title ? formatCountLabel(nodeSpec.title, count) : label,
      ...(nodeSpec.description ? { description: nodeSpec.description } : {}),
      ...(canonicalPath
        ? { canonicalPath }
        : { memberPaths }),
      ...((nodeSpec.order !== undefined || nodeSpec.lane)
        ? {
            layout: {
              ...(nodeSpec.order !== undefined ? { order: nodeSpec.order } : {}),
              ...(nodeSpec.lane ? { lane: nodeSpec.lane } : {}),
            },
          }
        : {}),
      meta: [
        ...new Set(selected.flatMap((item) => item.node.meta)),
        ...(memberPaths.length > 1 ? [`${memberPaths.length} records`] : []),
      ],
    };
    delete node.parentId;
    delete node.targetId;
    if (isGroup || memberPaths.length > 1) delete node.recordId;
    nodes.push(node);
    viewBySpecId.set(nodeSpec.id, node);
    sourcesByView.set(id, sourceIds);
    for (const sourceId of sourceIds) {
      if (sourceToView.has(sourceId)) {
        diagnostics.push(viewDiagnostic(
          'graph_view_duplicate_selection',
          `Semantic node ${sourceId} is selected by more than one overview node.`,
          `graphView.nodes.${nodeSpec.id}`,
        ));
      } else {
        sourceToView.set(sourceId, id);
      }
    }
  }

  if (spec.edges?.length) {
    for (const edgeSpec of spec.edges) {
      const source = viewBySpecId.get(edgeSpec.source);
      const target = viewBySpecId.get(edgeSpec.target);
      if (!source || !target) {
        diagnostics.push(viewDiagnostic(
          'graph_view_missing_edge_node',
          `View edge ${edgeSpec.source} → ${edgeSpec.target} references a missing overview node.`,
          `graphView.edges.${edgeSpec.source}.${edgeSpec.target}`,
        ));
        continue;
      }
      const path = semanticPath(
        projection,
        sourcesByView.get(source.id) ?? new Set<string>(),
        sourcesByView.get(target.id) ?? new Set<string>(),
      );
      if (!path) {
        diagnostics.push(viewDiagnostic(
          'graph_view_unsupported_edge',
          `No semantic provenance path supports ${edgeSpec.source} → ${edgeSpec.target}; the overview edge was omitted.`,
          `graphView.edges.${edgeSpec.source}.${edgeSpec.target}`,
        ));
        continue;
      }
      addEdge(
        edges,
        edgeSeen,
        source.id,
        target.id,
        edgeSpec.kind ?? inferredOverviewEdgeKind(
          source,
          target,
          path.map((edge) => edge.kind),
        ),
        { semanticEdgeIds: path.map((edge) => edge.id) },
      );
    }
  } else {
    for (const [sourceViewId, sourceIds] of sourcesByView) {
      const source = nodes.find((node) => node.id === sourceViewId);
      if (!source) continue;
      for (const [targetViewId, targetIds] of sourcesByView) {
        if (sourceViewId === targetViewId) continue;
        const target = nodes.find((node) => node.id === targetViewId);
        if (!target) continue;
        const path = semanticPath(
          projection,
          sourceIds,
          targetIds,
          sourceToView,
          targetViewId,
        );
        if (!path) continue;
        addEdge(
          edges,
          edgeSeen,
          sourceViewId,
          targetViewId,
          inferredOverviewEdgeKind(source, target, path.map((edge) => edge.kind)),
          { semanticEdgeIds: path.map((edge) => edge.id) },
        );
      }
    }
  }

  const insights = projection.nodes.filter((node) => node.kind === 'prior-insight');
  nodes.push(...insights);
  const semanticDecisionsByPath = new Map<string, AstraGraphNode[]>();
  for (const node of projection.nodes) {
    if (node.kind !== 'decision' || !node.canonicalPath) continue;
    const matches = semanticDecisionsByPath.get(node.canonicalPath) ?? [];
    matches.push(node);
    semanticDecisionsByPath.set(node.canonicalPath, matches);
  }
  const viewDecisionByPath = new Map<string, AstraGraphNode>();
  for (const group of spec.decisionGroups ?? []) {
    const target = viewBySpecId.get(group.target);
    if (!target) {
      diagnostics.push(viewDiagnostic(
        'graph_view_missing_decision_target',
        `Decision group target "${group.target}" is missing.`,
        `graphView.decisionGroups.${group.id}`,
      ));
      continue;
    }
    const paths = [...semanticDecisionsByPath.keys()]
      .filter((path) => matchesAnyPattern(path, group.members))
      .sort((left, right) => {
        const leftPattern = group.members.findIndex((pattern) => globExpression(pattern).test(left));
        const rightPattern = group.members.findIndex((pattern) => globExpression(pattern).test(right));
        return leftPattern - rightPattern || left.localeCompare(right);
      });
    if (!paths.length) {
      diagnostics.push(viewDiagnostic(
        'graph_view_unmatched_decision_group',
        `Decision group "${group.id}" did not match any decisions.`,
        `graphView.decisionGroups.${group.id}`,
      ));
      continue;
    }
    const clusterId = `view:decision-cluster:${group.id}`;
    const memberIds: string[] = [];
    const cluster: AstraGraphNode = {
      id: clusterId,
      kind: 'decision-cluster',
      label: group.label
        ? formatCountLabel(group.label, paths.length)
        : `${paths.length} decision${paths.length === 1 ? '' : 's'}`,
      title: group.title ?? `${target.label} decisions`,
      scopeId: group.scopeId ?? target.scopeId,
      description: group.description
        ?? 'Methodological choices that parameterize this overview stage or artifact.',
      meta: [],
      memberPaths: memberIds,
      targetId: target.id,
      ...(target.layout ? { layout: target.layout } : {}),
    };
    nodes.push(cluster);
    addEdge(edges, edgeSeen, cluster.id, target.id, 'configures');
    const targets = group.targets?.length
      ? group.targets
      : [{ node: group.target, kind: 'configures' as const }];
    for (const [position, path] of paths.entries()) {
      const candidates = semanticDecisionsByPath.get(path) ?? [];
      const semantic = candidates.find((node) => node.scopeId === group.scopeId)
        ?? candidates[0];
      if (!semantic) continue;
      const id = `view:decision:${group.id}:${position + 1}`;
      const decision: AstraGraphNode = {
        ...semantic,
        id,
        scopeId: group.scopeId ?? semantic.scopeId,
        parentId: cluster.id,
        targetId: target.id,
      };
      delete decision.layout;
      nodes.push(decision);
      memberIds.push(id);
      viewDecisionByPath.set(path, decision);
      for (const targetSpec of targets) {
        const decisionTarget = viewBySpecId.get(targetSpec.node);
        if (!decisionTarget) continue;
        addEdge(
          edges,
          edgeSeen,
          decision.id,
          decisionTarget.id,
          targetSpec.kind ?? 'configures',
          { parentId: cluster.id },
        );
      }
    }
  }

  for (const edge of projection.edges) {
    if (edge.kind !== 'informs' && edge.kind !== 'locks' && edge.kind !== 'requires') continue;
    const semanticSource = projection.nodes.find((node) => node.id === edge.source);
    const semanticTarget = projection.nodes.find((node) => node.id === edge.target);
    const source = semanticSource?.kind === 'prior-insight'
      ? semanticSource
      : semanticSource?.canonicalPath
        ? viewDecisionByPath.get(semanticSource.canonicalPath)
        : undefined;
    const target = semanticTarget?.canonicalPath
      ? viewDecisionByPath.get(semanticTarget.canonicalPath)
      : undefined;
    if (!source || !target) continue;
    addEdge(edges, edgeSeen, source.id, target.id, edge.kind, {
      semanticEdgeIds: [edge.id],
    });
  }

  return {
    ...projection,
    nodes,
    edges,
    diagnostics,
  };
}
