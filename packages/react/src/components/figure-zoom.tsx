import type { ReactNode } from 'react';
import { TransformComponent, TransformWrapper, useControls, useTransformComponent } from 'react-zoom-pan-pinch';
import { useLabels } from '../lib/labels.js';
import { Button } from '../primitives/button.js';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;

function FigureControls() {
  const { figure: labels } = useLabels();
  const { zoomIn, zoomOut, resetTransform } = useControls();
  const scale = useTransformComponent(({ state }) => state.scale);
  return (
    <div className="astra-figure-zoom__controls">
      <Button aria-label={labels.zoomOut} disabled={scale <= MIN_SCALE} onClick={() => { void zoomOut(ZOOM_STEP, 0); }}>−</Button>
      <output aria-live="polite" aria-atomic="true">{labels.zoomLevel(Math.round(scale * 100))}</output>
      <Button aria-label={labels.zoomIn} disabled={scale >= MAX_SCALE} onClick={() => { void zoomIn(ZOOM_STEP, 0); }}>+</Button>
      <Button disabled={scale <= MIN_SCALE} onClick={() => { void resetTransform(0); }}>{labels.fit}</Button>
    </div>
  );
}

/** The gesture library magnifies the host's fitted figure; the host still owns its artifact. */
export function FigureZoom({ children }: { children: ReactNode }) {
  const { figure: labels } = useLabels();
  return (
    <TransformWrapper
      minScale={MIN_SCALE}
      maxScale={MAX_SCALE}
      disablePadding
      keyboard={{ disabled: false, zoomStep: ZOOM_STEP, animationTime: 0 }}
      panning={{ velocityDisabled: true, excluded: ['button', 'a', 'input', 'select', 'textarea'] }}
      doubleClick={{ mode: 'toggle', step: 1, animationTime: 0 }}
    >
      <div className="astra-figure-zoom" role="group" aria-label={labels.controls}>
        <FigureControls />
        <TransformComponent
          wrapperClass="astra-figure-zoom__viewport"
          contentClass="astra-figure-zoom__canvas"
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
          wrapperProps={{ role: 'region', 'aria-label': labels.viewport }}
        >
          <div className="astra-output-detail__preview">{children}</div>
        </TransformComponent>
      </div>
    </TransformWrapper>
  );
}
