import { memo } from 'react';

function lineClass(line: string): string | undefined {
  if (/^#{1,3} /.test(line)) return 'tk-heading';
  if (/^<\/?[a-z_]+>$/.test(line)) return 'tk-tag';
  return undefined;
}

export const PromptText = memo(function PromptText({ text }: { text: string }) {
  return (
    <pre className="prompt-text">
      {text.split('\n').map((line, i) => (
        <span key={i} className={lineClass(line)}>
          {line}
          {'\n'}
        </span>
      ))}
    </pre>
  );
});
