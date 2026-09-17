import type { ReactNode } from 'react';
import { TransformComponent, TransformWrapper, useControls, useTransformComponent } from 'react-zoom-pan-pinch';
import { useLabels } from '../lib/labels.js';
import { Button } from '../primitives/button.js';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;

/**
 * A step that reaches a bound disables its own button. A natively disabled
 * button cannot hold focus, so the keyboard user who pressed it would be
 * dropped to the document; `aria-disabled` keeps the button focusable and
 * announced as unavailable while the handler ignores the press.
 */
function ZoomButton({ label, unavailable, onPress, children }: {
  label: string;
  unavailable: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      aria-label={label}
      title={label}
      aria-disabled={unavailable || undefined}
      onClick={unavailable ? undefined : onPress}
    >
      {children}
    </Button>
  );
}

function FigureControls() {
  const { figure: labels } = useLabels();
  const { zoomIn, zoomOut } = useControls();
  const scale = useTransformComponent(({ state }) => state.scale);
  return (
    <div className="astra-figure-zoom__controls">
      <ZoomButton label={labels.zoomIn} unavailable={scale >= MAX_SCALE} onPress={() => { void zoomIn(ZOOM_STEP, 0); }}>+</ZoomButton>
      <ZoomButton label={labels.zoomOut} unavailable={scale <= MIN_SCALE} onPress={() => { void zoomOut(ZOOM_STEP, 0); }}>−</ZoomButton>
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
        <TransformComponent
          wrapperClass="astra-figure-zoom__viewport"
          contentClass="astra-figure-zoom__canvas"
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
          wrapperProps={{ role: 'region', 'aria-label': labels.viewport }}
        >
          <div className="astra-output-detail__preview">{children}</div>
        </TransformComponent>
        <FigureControls />
      </div>
    </TransformWrapper>
  );
}
