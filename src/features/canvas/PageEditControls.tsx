import { useState } from 'react';

export type PageEditSection = 'presets' | 'edges' | 'depth' | 'spacing' | 'colour' | 'gradient' | 'burst' | 'theme';
type Slider = [string, number, number, number, number, string];
const sliders: Partial<Record<PageEditSection, Slider[]>> = {
  edges: [['Card corners', 0, 40, 1, 10, 'px'], ['Field corners', 0, 24, 1, 8, 'px'], ['Button corners', 0, 20, 1, 20, 'px'], ['Corner curve', -4, 6, 0.1, 1, ''], ['Edge thickness', 0, 6, 0.5, 1, 'px'], ['Edge strength', 0, 100, 1, 14, '%']],
  depth: [['Shadow', 0, 1, 0.05, 0, ''], ['Edge glow', 0, 1, 0.05, 0, ''], ['Glow size', 0, 60, 1, 18, 'px'], ['Inner light', 0, 1, 0.05, 0, ''], ['Inner shadow', 0, 1, 0.05, 0, ''], ['Card lift from page', 0, 0.1, 0.005, 0.025, ''], ['Glass', 0, 1, 0.05, 0, ''], ['Glass blur', 0, 40, 1, 16, '']],
  spacing: [['Card padding', 6, 40, 1, 16, 'px'], ['Space between cards', 2, 40, 1, 16, 'px'], ['Text size', 11, 17, 0.5, 14, 'px']],
  colour: [['Accent hue', 0, 360, 1, 250, '°'], ['Accent strength', 0, 0.3, 0.005, 0, ''], ['Accent lightness', -0.25, 0.25, 0.01, 0, ''], ['Background tint hue', 0, 360, 1, 250, '°'], ['Background tint', 0, 0.06, 0.002, 0.004, ''], ['Card tint', 0, 0.06, 0.002, 0, '']],
  gradient: [['Visibility', 0, 1, 0.01, 0.18, ''], ['Size', 20, 140, 1, 70, ''], ['Softness', 0, 160, 2, 60, 'px'], ['Cycle length', 10, 300, 5, 140, 's'], ['Movement', 0, 2.5, 0.05, 1, '']],
  burst: [['Strength', 0, 1, 0.05, 0.7, ''], ['Duration', 0.3, 3, 0.1, 1.1, 's']],
};
const options: Partial<Record<PageEditSection, [string, string[]][]>> = {
  presets: [['Preset', ['Radium today', 'Soft', 'Crisp', 'Glass', 'Squircle', 'Midnight', 'Paper', 'Neon', 'Frost', 'Warm', 'Terminal', 'Brutal', 'Pastel', 'Aurora', 'Mono']]],
  edges: [['Edge style', ['Solid', 'Dashed', 'Dotted', 'Double', 'Groove', 'Ridge']]],
  gradient: [['Gradient style', ['Blobs', 'Aurora', 'Swirl', 'Mesh', 'Off']]],
  burst: [['Burst style', ['Sweep and glow', 'Sweep', 'Glow', 'Off']]],
  theme: [['Card size', ['Default', 'Small']], ['Theme', ['System', 'Dark', 'Light']]],
};

export function PageEditControls({ section, onAddTask }: { section: PageEditSection; onAddTask: (text: string) => void }) {
  const [values, setValues] = useState<Record<string, number | string>>({});
  const currentSliders = sliders[section] ?? [];
  const currentOptions = options[section] ?? [];
  const valueFor = (label: string, fallback: number | string) => values[`${section}:${label}`] ?? fallback;
  const change = (label: string, value: number | string) => setValues(previous => ({ ...previous, [`${section}:${label}`]: value }));
  return <section className="ribbon__group" aria-label="Page edit settings">
    {currentOptions.map(([label, choices]) => <label className="ribbon__edit-choice" key={label}>
      <span>{label}</span>
      <select aria-label={label} value={valueFor(label, choices[0])} onChange={event => change(label, event.target.value)}>
        {choices.map(choice => <option key={choice}>{choice}</option>)}
      </select>
    </label>)}
    {currentSliders.map(([label, min, max, step, initial, unit]) => <label className="ribbon__slider" key={label}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={valueFor(label, initial)} onChange={event => change(label, Number(event.target.value))} />
      <output>{valueFor(label, initial)}{unit}</output>
    </label>)}
    <div className="ribbon__actions"><button type="button" onClick={() => onAddTask(`Set ${section}: ${[...currentOptions.map(([label, choices]) => `${label}: ${valueFor(label, choices[0])}`), ...currentSliders.map(([label, , , , initial, unit]) => `${label}: ${valueFor(label, initial)}${unit}`)].join(', ')}`)}>Add to tasks</button></div>
  </section>;
}