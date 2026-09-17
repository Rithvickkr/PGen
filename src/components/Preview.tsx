import { wordCount } from '../lib/generate';
import { Icon } from './Icon';
import { PromptText } from './PromptText';
import { useCopy } from './useCopy';

export function Preview({ prompt, onClose }: { prompt: string; onClose?: () => void }) {
  const { copied, copy } = useCopy();
  return (
    <div className="preview">
      <div className="preview-head">
        <div>
          <div className="preview-title">Live preview</div>
          <div className="preview-meta">{wordCount(prompt).toLocaleString()} words · updates as you type</div>
        </div>
        <div className="preview-actions">
          <button type="button" className={`btn btn-soft btn-sm${copied ? ' is-done' : ''}`} onClick={() => copy(prompt)}>
            <Icon name={copied ? 'check' : 'copy'} size={14} />
            {copied ? 'Copied' : 'Copy'}
          </button>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close preview">
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>
      <div className="preview-body">
        <PromptText text={prompt} />
      </div>
    </div>
  );
}
