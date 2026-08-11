import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  createProjectViewModelIndex,
  type ProjectViewModelIndex,
  type ProjectViewModelV1,
} from '@astra-spec/sdk/view-model';
import type {
  RuntimeOverlayV1,
  ViewerCapabilities,
  ViewerHost,
} from './viewer-types.js';

const NO_CAPABILITIES: ViewerCapabilities = {
  preview: false,
  download: false,
  openSource: false,
  changeUniverse: false,
  execution: false,
  externalNavigation: false,
  chatReference: false,
};

export const passiveViewerHost: ViewerHost = {
  capabilities: NO_CAPABILITIES,
};

export interface AstraViewerContextValue {
  model: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  host: ViewerHost;
  index: ProjectViewModelIndex;
}

const AstraViewerContext = createContext<AstraViewerContextValue | undefined>(
  undefined,
);

export interface AstraViewerProviderProps {
  model: ProjectViewModelV1;
  runtime?: RuntimeOverlayV1;
  host?: ViewerHost;
  children: ReactNode;
}

export function AstraViewerProvider({
  model,
  runtime,
  host = passiveViewerHost,
  children,
}: AstraViewerProviderProps) {
  const value = useMemo<AstraViewerContextValue>(
    () => ({
      model,
      ...(runtime ? { runtime } : {}),
      host,
      index: createProjectViewModelIndex(model, runtime?.resources ?? []),
    }),
    [host, model, runtime],
  );
  return (
    <AstraViewerContext.Provider value={value}>
      {children}
    </AstraViewerContext.Provider>
  );
}

export function useAstraViewer(): AstraViewerContextValue {
  const value = useContext(AstraViewerContext);
  if (!value) {
    throw new Error('useAstraViewer must be used inside AstraViewerProvider.');
  }
  return value;
}

export function useOptionalAstraViewer(): AstraViewerContextValue | undefined {
  return useContext(AstraViewerContext);
}
