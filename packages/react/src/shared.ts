import {
  createProjectViewModelIndex,
  type ProjectRecordView,
  type ProjectViewModelIndex,
  type ProjectViewModelV1,
  type RuntimeOverlayV1,
} from '@lightcone-research/astra-viewer-model';

export type ModelInput = ProjectViewModelV1 | ProjectViewModelIndex;

export function projectIndex(
  input: ModelInput,
  runtime?: RuntimeOverlayV1,
): ProjectViewModelIndex {
  return 'recordById' in input
    ? input
    : createProjectViewModelIndex(input, runtime);
}

export function recordTitle(record: ProjectRecordView): string {
  return record.label?.trim()
    || record.canonicalPath.split('.').at(-1)?.replaceAll('_', ' ')
    || record.id;
}

export function kindLabel(kind: ProjectRecordView['kind']): string {
  return kind === 'prior_insight'
    ? 'Prior insight'
    : `${kind[0]?.toUpperCase() ?? ''}${kind.slice(1)}`;
}

export const RECORD_KINDS: readonly ProjectRecordView['kind'][] = [
  'input',
  'decision',
  'output',
  'finding',
  'prior_insight',
];
