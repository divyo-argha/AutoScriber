'use client';

interface ChunkPresetButtonsProps {
  value: string;
  onSelect: (value: string) => void;
  presets: { label: string; val: string }[];
}

const presetStyle: React.CSSProperties = {
  fontSize: '10px',
  padding: '0.125rem 0.5rem',
  borderRadius: '9999px',
  border: '1px solid color-mix(in oklab, var(--white) 10%, transparent)',
  backgroundColor: 'color-mix(in oklab, var(--muted) 40%, transparent)',
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  fontWeight: 600,
};

const presetActiveStyle: React.CSSProperties = {
  ...presetStyle,
  border: '1px solid var(--brand-500)',
  backgroundColor: 'color-mix(in oklab, var(--brand-500) 15%, transparent)',
  color: 'var(--brand-400)',
};

/** Reusable pill-style preset selector used by the chunk settings card. */
export function ChunkPresetButtons({ value, onSelect, presets }: ChunkPresetButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
      {presets.map(preset => (
        <button
          key={preset.val}
          type="button"
          onClick={() => onSelect(preset.val)}
          style={value === preset.val ? presetActiveStyle : presetStyle}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
