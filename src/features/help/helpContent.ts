/** Hover help: a short tip for the tooltip card, plus a verbose body for the "?" panel. */
export interface HelpEntry {
  tip: string;
  title: string;
  body: string;
}

export const HELP: Record<string, HelpEntry> = {
  // Left menu pages
  'nav.projects': {
    tip: 'Your projects and connected apps',
    title: 'Projects',
    body: 'Projects are the apps you work on. The demo project is always here; use Connect app on the canvas to add your own running web app. Pick a project to choose which app the canvas shows and which one your comments and tasks belong to.',
  },
  'nav.production': {
    tip: 'The to-do list built from your comments',
    title: 'Production',
    body: 'Every comment you pin on the canvas becomes a task here, with a record of exactly what you clicked: the element, its styles, a screenshot and the time. Open a task for details, send it back to the canvas, copy the whole plan for an AI agent, or ask the AI to review a task — it only suggests, nothing changes until you accept.',
  },
  'nav.comments': {
    tip: 'All comments across your frames',
    title: 'Comments',
    body: 'A list of every note you have pinned to the page. Comments are quick notations: click something, write the thought, pick Bug, Change or Idea. Each one also appears on the Production page as a task you can act on later.',
  },
  'nav.agents': {
    tip: 'Hand work to AI agents',
    title: 'Agents',
    body: 'Where AI helpers connect to your project. Copy the production plan and paste it to an agent, or let an agent read your tasks directly. Agents propose changes; you stay in charge of what actually gets applied.',
  },
  'nav.settings': {
    tip: 'App preferences',
    title: 'Settings',
    body: 'Application-wide preferences: how the workspace looks and behaves. These settings belong to Layers itself, not to the app you are editing on the canvas.',
  },
  'nav.about': {
    tip: 'About this app',
    title: 'About',
    body: 'Version and product information for Layers GUI Creator and Editor.',
  },

  // GUI Editor
  'gui.editor': {
    tip: 'Every visual control for the app on the canvas',
    title: 'GUI Editor',
    body: 'These folders hold every style control the app on the canvas understands: presets, colours, layout, motion and export. Changes apply live to the app in the frame and can be undone with Ctrl+Z. Hover a section and press the crosshair button to flash exactly which items on the page that section changes.',
  },
  'gui.folder.appearance': {
    tip: 'Colour, status greens, gradient, depth and glow',
    title: 'Colours and appearance',
    body: 'Everything that decides how the app looks at a glance: the accent colour and background tint, the greens used for running states, the animated background gradient, and depth effects like shadows, glow and glass.',
  },
  'gui.folder.layout': {
    tip: 'Corners, spacing, text size and card theme',
    title: 'Layout and text',
    body: 'The shape and rhythm of the interface: how round cards, fields and buttons are, how thick their edges are, how much padding and gap they have, the text size, and the card size and preview theme.',
  },
  'gui.folder.motion': {
    tip: 'Animations and page-change effects',
    title: 'Motion',
    body: 'All the movement: the burst when a page changes and ten effects such as edge chase, glow pulse, ripple and float. Each effect has its own speed, strength and colour controls, and Motion actions holds play and reset buttons.',
  },
  'gui.folder.output': {
    tip: 'Your comments and the CSS export',
    title: 'Notes and export',
    body: 'Comments and changes lists every note pinned to the page. Your settings as CSS turns everything you have dialled in into a stylesheet you can copy into your own project.',
  },
  'gui.presets': {
    tip: 'One-click complete looks',
    title: 'Presets',
    body: 'Ready-made looks such as Glass, Paper, Terminal and Aurora change many settings at once. Your own saved looks live here too. Applying a preset is one undo step, so you can always go back with Ctrl+Z.',
  },
  'gui.edges': {
    tip: 'Corner roundness and border style',
    title: 'Corners and edges',
    body: 'Controls the roundness of cards, fields and buttons separately, the corner curve (1 is round, 2 is squircle, 0 a bevel, below 0 scoops in), plus border thickness, strength, style and colour. Press the crosshair to flash every item these controls touch.',
  },
  'gui.depth': {
    tip: 'Shadows, glow and glass effects',
    title: 'Depth and glow',
    body: 'How far cards lift off the page: drop shadow and its colour, outer glow size and colour, inner light and inner shadow, and the glass effect that makes cards see-through with an adjustable blur.',
  },
  'gui.spacing': {
    tip: 'Padding, gaps and text size',
    title: 'Spacing and text',
    body: 'Card padding, the space between cards, and the base text size. Small changes here shift the whole feel of the app, so use the crosshair to see everything that will move.',
  },
  'gui.color': {
    tip: 'Accent colour and background tint',
    title: 'Colour',
    body: 'The accent hue, strength and lightness drive buttons and highlights; the background and card tints wash the whole app in a subtle colour. At zero strength the app keeps its plain black and white look.',
  },
  'gui.greens': {
    tip: 'The greens used for running states',
    title: 'Status greens',
    body: 'The two greens used for running indicators, memory meters and log levels, plus an optional glow around them. Leave a colour on Auto to follow the theme.',
  },
  'gui.grad': {
    tip: 'The animated background behind everything',
    title: 'Background gradient',
    body: 'The moving wash of colour behind the app. Pick a style (blobs, aurora, swirl, mesh or off), three colours, and how visible, large, soft and fast the movement is. Longer cycle times are calmer.',
  },
  'gui.burst': {
    tip: 'The flash when a page changes',
    title: 'Page-change burst',
    body: 'A sweep and glow that plays when the app switches pages, so transitions feel alive. Choose sweep, glow or both, set the colour, and tune how strong and how long it runs.',
  },
  'gui.view': {
    tip: 'Card size and preview theme',
    title: 'Card size and theme',
    body: 'Switches cards between their default and compact size, and previews the app in system, dark or light theme without changing your operating system setting.',
  },
  'gui.export': {
    tip: 'Copy your settings as a stylesheet',
    title: 'Your settings as CSS',
    body: 'Turns every knob you have set into a CSS file you can paste into your own project. This is the bridge between experimenting here and shipping the look in real code.',
  },
  'gui.fx-chase': { tip: 'A light that runs around card edges', title: 'Edge chase', body: 'An animated highlight that travels around the border of cards. Adjust its colour, width, arc length, glow and speed.' },
  'gui.fx-pulse': { tip: 'A breathing glow', title: 'Glow pulse', body: 'Makes the glow around cards fade in and out in a steady rhythm. Tune the colour, size and pace.' },
  'gui.fx-warp': { tip: 'A subtle distortion wave', title: 'Warp', body: 'Bends and shifts the surface in a gentle wave. Best kept slow and weak for a background feel.' },
  'gui.fx-ripple': { tip: 'Expanding rings', title: 'Ripple', body: 'Rings that spread outwards like drops in water. Control their colour, size and timing.' },
  'gui.fx-shimmer': { tip: 'A moving shine', title: 'Shimmer', body: 'A soft sheen that sweeps across surfaces, like light on brushed metal.' },
  'gui.fx-pop': { tip: 'Items spring in', title: 'Pop', body: 'Makes elements appear with a small springy scale-up when they enter.' },
  'gui.fx-shake': { tip: 'A quick shake', title: 'Shake', body: 'A short sideways shake, useful for drawing attention to something that changed or failed.' },
  'gui.fx-float': { tip: 'Gentle up and down drift', title: 'Float', body: 'Elements slowly drift up and down so the page feels alive even when idle.' },
  'gui.fx-draw': { tip: 'Borders draw themselves', title: 'Border draw', body: 'Traces the outline of cards as if being drawn with a pen.' },
  'gui.fx-enter': { tip: 'Items blur in on arrival', title: 'Blur-in entrance', body: 'New content arrives soft and out of focus, then sharpens into place.' },
  'gui.motion-actions': { tip: 'Play and reset all motion', title: 'Motion actions', body: 'Plays the motion effects on demand and resets them, so you can preview without waiting for a page change.' },
  'gui.notes': {
    tip: 'Comments pinned to the page',
    title: 'Comments and changes',
    body: 'Every note you have pinned while editing, with its replies. These same notes appear on the Production page as tasks, so a quick thought here becomes planned work there.',
  },
  'gui.highlight': {
    tip: 'Flash the items this section edits',
    title: 'Highlight what changes',
    body: 'Press this to make every item on the page that the section controls flash purple three times. It reads the app\u2019s own stylesheet, so it always shows the real affected items.',
  },

  // Canvas toolbar
  'canvas.layers': { tip: 'Show or hide the layers rail', title: 'Layers', body: 'Opens the layers rail beside the canvas so you can see and pick the parts of the page.' },
  'canvas.tool.grab': { tip: 'Pick a part of the page (V)', title: 'Grab', body: 'Click anything on the page to select it. The selected item can then be inspected and edited on its own.' },
  'canvas.tool.comment': { tip: 'Pin a note to something (C)', title: 'Comment', body: 'Click any item on the page to pin a note to it. The note records exactly what you clicked and becomes a task on the Production page.' },
  'canvas.tool.draw': { tip: 'Sketch on the canvas (D)', title: 'Draw', body: 'Draw freehand marks on the canvas to point things out. Marks sit on the canvas, not inside your app.' },
  'canvas.tool.insert': { tip: 'Place a new item', title: 'Insert', body: 'Adds a new element to the page at the spot you choose.' },
  'canvas.tool.hand': { tip: 'Pan the canvas (Space)', title: 'Hand', body: 'Drag to move around the canvas without selecting or changing anything.' },
  'canvas.zoom-out': { tip: 'Zoom out', title: 'Zoom out', body: 'Steps the canvas zoom down so you can see more of the page at once.' },
  'canvas.zoom-in': { tip: 'Zoom in', title: 'Zoom in', body: 'Steps the canvas zoom up for a closer look at detail.' },
  'canvas.fit': { tip: 'Fit the page to the window', title: 'Fit', body: 'Picks a zoom level so the whole frame fits comfortably in the visible canvas.' },
  'canvas.window': { tip: 'Open a floating tool window', title: 'Tool windows', body: 'Each button opens a floating window: Layers, Inspector, Comments, Production list, Style Lab, Motion, Code or Screens. Windows float over the canvas and can be moved and closed independently.' },
  'canvas.screens': { tip: 'Browse the screens in your project', title: 'Screens', body: 'Scans your project and lists every screen it finds, with thumbnails. Pick one to open it on the canvas.' },
  'canvas.reset': { tip: 'Back to the default layout', title: 'Reset layout', body: 'Closes all floating windows and puts the canvas panels back where they started. Your style changes are not touched.' },
  'canvas.connect': {
    tip: 'Style your own running app',
    title: 'Connect app',
    body: 'Point Layers at a web app running on your machine or a server. Once connected you can select elements, preview style changes live, and save them as change records. Your app needs a small one-time script tag; its source files are never modified.',
  },
  'canvas.add-frame': { tip: 'Open another frame on the canvas', title: 'Add frame', body: 'Adds a second frame so you can look at two screens or two apps side by side and edit each one.' },

  // Floating tool pill
  'pill.use': { tip: 'Use your app normally', title: 'Use', body: 'The page behaves exactly as it would in a browser: clicks, typing and navigation all go straight to your app.' },
  'pill.grab': { tip: 'Pick a part of the page (V)', title: 'Grab', body: 'Click anything on the page to select it for inspection and editing. Press Esc to stop.' },
  'pill.comment': { tip: 'Pin a note to something (C)', title: 'Comment', body: 'Click any item to pin a note to it. The note remembers the exact element and becomes a task on the Production page. Press Esc to stop.' },
  'pill.undo': { tip: 'Undo the last change (Ctrl+Z)', title: 'Undo', body: 'Steps back through your style edits one at a time. Slider drags count as a single step.' },
  'pill.redo': { tip: 'Redo (Ctrl+Shift+Z)', title: 'Redo', body: 'Re-applies a change you just undid.' },
  'pill.pins': { tip: 'Show or hide comment pins', title: 'Pins', body: 'Toggles the markers showing where comments are pinned on the page. The comments themselves are never deleted by hiding pins.' },
  'pill.motion': { tip: 'Motion tools (coming soon)', title: 'Motion', body: 'Quick motion controls for the floating bar. For now, use the Motion folder in the GUI Editor menu.' },
  'pill.notes': { tip: 'Your notes for the to-do list', title: 'Notes', body: 'Opens the drawer of every comment you have made. Tick notes off here or send them to the Production page as tasks.' },
};

export function helpFor(key: string): HelpEntry | undefined {
  return HELP[key];
}
