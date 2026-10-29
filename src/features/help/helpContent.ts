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
    body: 'Projects are the apps you work on, and every comment, task and style change you make belongs to whichever project is selected. The demo project (Radium Ollama) is always here so you can experiment freely without touching anything real. To work on your own app, press Connect app on the canvas and point Layers at its address — your app needs a small one-time script tag added to its page, and its source files are never modified. Picking a project here decides which app the canvas shows and which project new comments and production tasks are filed under, so if a comment seems to have gone missing, check that you are looking at the project you made it in.',
  },
  'nav.production': {
    tip: 'The to-do list built from your comments',
    title: 'Production',
    body: 'Production is the planning page: every comment you pin on the canvas arrives here as a task, carrying a full record of exactly what you clicked — the element and its text, where it sat on screen, the styles it had at the time, a before-screenshot and the date and time. Open a task to see all of that detail, or press Show on canvas to jump straight back to the element it was pinned to. Tasks can be given a kind (bug, change, idea, question), a priority and sub-tasks, and ticked off as work is completed. Copy plan for agent turns the whole list into a text brief you can paste to an AI agent so it can work through your requests. Review by AI Agent asks the AI to improve a task — rewriting it clearly, suggesting sub-tasks, priority or a done-check, or asking you questions — but it only ever suggests: nothing changes until you press Accept.',
  },
  'nav.comments': {
    tip: 'All comments across your frames',
    title: 'Comments',
    body: 'A flat list of every note you have pinned to the page, across all frames. Comments are meant to be quick notations: while you are editing you click the exact thing you are looking at, type the thought, pick Bug, Change or Idea, and move on. Because each comment records the precise element it was pinned to, there is never any ambiguity later about which button, card or setting you meant. Every comment also appears on the Production page as a task, so this page is for reviewing and replying, while Production is for planning the work.',
  },
  'nav.agents': {
    tip: 'Hand work to AI agents',
    title: 'Agents',
    body: 'This is where AI helpers connect to your project. The simplest way to use it is Copy plan for agent on the Production page: that turns your task list — including the element details and screenshots recorded with each comment — into a brief you can paste to any agent. Agents can also read your tasks directly through the project\u2019s agent interface. The golden rule is that agents propose and you dispose: an agent can suggest changes, rewrite tasks or draft fixes, but nothing is applied to your app or your plan until you accept it.',
  },
  'nav.settings': {
    tip: 'App preferences',
    title: 'Settings',
    body: 'Application-wide preferences for Layers itself: how the workspace looks and behaves. These settings belong to the editor, not to the app sitting on the canvas — changing something here never changes the app you are editing. If you want to change how your own app looks, use the GUI Editor folders instead; if you want to change how Layers looks, this is the place.',
  },
  'nav.about': {
    tip: 'About this app',
    title: 'About',
    body: 'Version and product information for Layers GUI Creator and Editor, including which build you are running. Useful when reporting a problem or checking whether an update has arrived.',
  },

  // GUI Editor
  'gui.editor': {
    tip: 'Every visual control for the app on the canvas',
    title: 'GUI Editor',
    body: 'The GUI Editor holds every style control the app on the canvas understands, grouped into folders: Presets for one-click looks, Colours and appearance for hue, gradient and depth, Layout and text for shape and rhythm, Motion for animation, and Notes and export for comments and the CSS export. Every change applies live to the app in the frame the moment you move a control, and the whole session is undoable with Ctrl+Z (redo with Ctrl+Shift+Z). If you are ever unsure what a section actually changes, hover it and press the small crosshair button: every item on the page that the section controls flashes purple three times. Nothing here edits your app\u2019s source files — when you are happy, Your settings as CSS in Notes and export gives you a stylesheet to take away.',
  },
  'gui.folder.appearance': {
    tip: 'Colour, status greens, gradient, depth and glow',
    title: 'Colours and appearance',
    body: 'Everything that decides how the app looks at a glance. Colour sets the accent hue, strength and lightness that drive buttons and highlights, plus the background and card tints that wash the whole app. Status greens controls the two greens used for running indicators, memory meters and log levels. Background gradient is the animated wash of colour behind everything. Depth and glow handles shadows, outer glow, inner light and the glass effect. Open the folder, then hover any section and press its crosshair button to flash exactly which items on the page it touches.',
  },
  'gui.folder.layout': {
    tip: 'Corners, spacing, text size and card theme',
    title: 'Layout and text',
    body: 'The shape and rhythm of the interface. Corners and edges sets how round cards, fields and buttons are, the corner curve style, and border thickness, strength, style and colour. Spacing and text controls card padding, the gaps between cards and the base text size. Card size and theme switches cards between default and compact and previews the app in system, dark or light theme. Small changes here shift the whole feel of the app, so use the crosshair button on a section to see everything that will move before you commit.',
  },
  'gui.folder.motion': {
    tip: 'Animations and page-change effects',
    title: 'Motion',
    body: 'All the movement in the app. Page-change burst is the sweep and glow that plays when the app switches pages. The ten effects — edge chase, glow pulse, warp, ripple, shimmer, pop, shake, float, border draw and blur-in entrance — each have their own speed, strength and colour controls inside their section. Motion actions holds play and reset buttons so you can preview effects on demand without waiting for a page change. As a rule of thumb, slow and weak settings feel premium; fast and strong settings feel playful but tire quickly.',
  },
  'gui.folder.output': {
    tip: 'Your comments and the CSS export',
    title: 'Notes and export',
    body: 'The output end of the editor. Comments and changes lists every note you have pinned to the page, with its replies — the same notes that appear on the Production page as tasks. Your settings as CSS turns everything you have dialled in across all the other folders into a stylesheet you can copy straight into your own project, which is the bridge between experimenting here and shipping the look in real code.',
  },
  'gui.presets': {
    tip: 'One-click complete looks',
    title: 'Presets',
    body: 'Presets change many settings at once to give the app a complete look — for example Glass, Paper, Terminal or Aurora. They are the fastest way to explore: apply a few, keep the one closest to your taste, then refine it with the other folders. Your own saved looks live here too, so once you have dialled in something you love you can save it and come back to it later. Applying a preset counts as a single undo step, so Ctrl+Z always takes you straight back to exactly how things were before you clicked.',
  },
  'gui.edges': {
    tip: 'Corner roundness and border style',
    title: 'Corners and edges',
    body: 'Controls the shape of every surface in the app. Corner roundness can be set separately for cards, fields and buttons, and the corner curve changes the flavour of the rounding: 1 is a normal round corner, 2 is a squircle (the smooth Apple-style curve), 0 cuts the corner into a bevel, and negative values scoop the corner inwards. Borders have their own thickness, strength, style and colour controls. Press the crosshair button next to the section name to flash every item these controls touch — corners affect almost everything, so it is a good way to see the reach of a change before you make it.',
  },
  'gui.depth': {
    tip: 'Shadows, glow and glass effects',
    title: 'Depth and glow',
    body: 'How far cards lift off the page. The drop shadow and its colour set the basic elevation; the outer glow adds a coloured halo with adjustable size; inner light and inner shadow model light falling across the surface; and the glass effect makes cards see-through with an adjustable blur of whatever sits behind them. These controls stack, so a card can have a shadow, a glow and glass all at once. Subtlety wins here: a soft shadow and a faint glow read as quality, while strong values quickly look heavy.',
  },
  'gui.spacing': {
    tip: 'Padding, gaps and text size',
    title: 'Spacing and text',
    body: 'Card padding is the breathing room inside each card, the gap control sets the space between cards, and the text size scales the app\u2019s base font. These three together decide whether the app feels dense and businesslike or airy and relaxed. Because padding and gaps affect every card at once, even a small nudge shifts the whole page — use the crosshair button to flash everything that will move, and remember Ctrl+Z undoes a whole slider drag as one step.',
  },
  'gui.color': {
    tip: 'Accent colour and background tint',
    title: 'Colour',
    body: 'The accent hue, strength and lightness drive everything interactive: buttons, links, selected states and highlights all take their colour from here. The background and card tints wash the whole app in a subtle version of the same colour, which is what makes a theme feel designed rather than default. At zero strength the app keeps its plain black and white look, so strength is the master dial for how colourful the app feels. If you only change one thing in the whole editor, change the accent hue — it has the biggest effect for the least effort.',
  },
  'gui.greens': {
    tip: 'The greens used for running states',
    title: 'Status greens',
    body: 'The two greens used wherever the app reports that something is running or healthy: status indicators, memory meters and log levels. You can also add an optional glow around them so active states stand out in the corner of your eye. Leave a colour on Auto and it follows the theme automatically, which is usually the right choice unless you are matching a specific brand palette.',
  },
  'gui.grad': {
    tip: 'The animated background behind everything',
    title: 'Background gradient',
    body: 'The moving wash of colour that sits behind the entire app. Pick a style — blobs, aurora, swirl or mesh — or turn it off completely for a flat background. Three colour slots let you build the palette, and separate controls set how visible the effect is, how large the shapes are, how soft their edges are and how fast they move. Longer cycle times are calmer and suit professional tools; shorter cycles feel energetic. Keep visibility low if the app shows a lot of text, so the background never competes with the content.',
  },
  'gui.burst': {
    tip: 'The flash when a page changes',
    title: 'Page-change burst',
    body: 'A sweep and glow that plays the moment the app switches pages, so transitions feel alive instead of abrupt. You can choose the sweep, the glow, or both together, set the colour (the accent colour usually looks best), and tune how strong the effect is and how long it runs. A short, subtle burst makes navigation feel snappy and polished; a long, strong one turns every page change into an event. Use Motion actions to replay it on demand while you tune.',
  },
  'gui.view': {
    tip: 'Card size and preview theme',
    title: 'Card size and theme',
    body: 'Two preview conveniences. Card size switches every card between its default and compact layout, which is handy for seeing how much information density the app can handle. The theme switch previews the app in system, dark or light theme without changing your operating system setting, so you can check both appearances while you design. Neither control changes your real system preferences — they only affect the preview inside the frame.',
  },
  'gui.export': {
    tip: 'Copy your settings as a stylesheet',
    title: 'Your settings as CSS',
    body: 'Turns every knob you have set across all the editor folders into a CSS file you can copy and paste into your own project. This is the bridge between experimenting here and shipping the look in real code: design visually, then take the stylesheet away. The export reflects the current state of the controls, so if you tweak something afterwards, export again to get the updated values.',
  },
  'gui.fx-chase': { tip: 'A light that runs around card edges', title: 'Edge chase', body: 'An animated highlight that travels around the border of cards, like a light running along a track. You can adjust its colour, width, arc length, glow and speed. A thin, slow chase in the accent colour adds a quiet sense of activity; a wide, fast one is attention-grabbing and best saved for states that genuinely need it.' },
  'gui.fx-pulse': { tip: 'A breathing glow', title: 'Glow pulse', body: 'Makes the glow around cards fade in and out in a steady rhythm, like breathing. Tune the colour, the size of the glow and the pace of the pulse. Slow pulses feel calm and alive; fast pulses read as urgent and can be tiring, so keep the pace gentle for anything that stays on screen for a long time.' },
  'gui.fx-warp': { tip: 'A subtle distortion wave', title: 'Warp', body: 'Bends and shifts the surface in a gentle wave, as if the page were made of fabric. Warp is the most theatrical of the effects and is best kept slow and weak for a background feel — at high strength it can make text hard to read, so treat it as an ambient effect rather than a feature.' },
  'gui.fx-ripple': { tip: 'Expanding rings', title: 'Ripple', body: 'Rings that spread outwards like drops landing in water. You control their colour, size and timing. Ripples work well as feedback — a quiet confirmation that something happened — and are most effective when they are brief and infrequent.' },
  'gui.fx-shimmer': { tip: 'A moving shine', title: 'Shimmer', body: 'A soft sheen that sweeps across surfaces, like light moving across brushed metal. Shimmer is a good way to make a page feel polished without obvious animation, and it pairs well with the glass effect from Depth and glow.' },
  'gui.fx-pop': { tip: 'Items spring in', title: 'Pop', body: 'Makes elements appear with a small springy scale-up when they enter the page. Pop gives interfaces a friendly, physical feel; keep the scale small so items feel eager rather than bouncy.' },
  'gui.fx-shake': { tip: 'A quick shake', title: 'Shake', body: 'A short sideways shake, useful for drawing attention to something that changed or failed — the classic example is a form field shaking when its input is rejected. Because it is inherently alarming, shake is best reserved for moments that genuinely need the user\u2019s attention.' },
  'gui.fx-float': { tip: 'Gentle up and down drift', title: 'Float', body: 'Elements slowly drift up and down so the page feels alive even when idle. Float works best on decorative elements rather than content the user is trying to read or click, and a small drift distance keeps it pleasant instead of distracting.' },
  'gui.fx-draw': { tip: 'Borders draw themselves', title: 'Border draw', body: 'Traces the outline of cards as if their borders were being drawn with a pen. It is a charming entrance effect for cards and panels, and pairs naturally with the corner and border settings in Corners and edges.' },
  'gui.fx-enter': { tip: 'Items blur in on arrival', title: 'Blur-in entrance', body: 'New content arrives soft and out of focus, then sharpens into place. Blur-in is a gentle, modern entrance that works well for lists and panels appearing one after another, and it complements the glass effect nicely.' },
  'gui.motion-actions': { tip: 'Play and reset all motion', title: 'Motion actions', body: 'Plays the motion effects on demand and resets them, so you can preview and tune without waiting for a real page change. Use this while adjusting any effect in the Motion folder: change a setting, press play, judge the result, repeat.' },
  'gui.notes': {
    tip: 'Comments pinned to the page',
    title: 'Comments and changes',
    body: 'Every note you have pinned while editing, with its replies, collected in one place. Comments are quick notations: click the exact thing you are looking at, write the thought, pick Bug, Change or Idea. Each note records the precise element it was pinned to, its styles at the time and a screenshot, and the same notes appear on the Production page as tasks — so a quick thought here becomes planned work there, with no re-typing.',
  },

  // Canvas toolbar
  'canvas.layers': { tip: 'Show or hide the layers rail', title: 'Layers', body: 'Opens the layers rail beside the canvas so you can see the structure of the page and pick individual parts of it. Selecting a layer is another way to choose what to inspect or edit, and it is often easier than clicking a small element directly, especially when elements overlap.' },
  'canvas.tool.grab': { tip: 'Pick a part of the page (V)', title: 'Grab', body: 'Click anything on the page to select it. The selected item can then be inspected and edited on its own, and the selection is what the Inspector and the style controls act upon. Press V to switch to Grab from the keyboard, and Esc to drop the selection.' },
  'canvas.tool.comment': { tip: 'Pin a note to something (C)', title: 'Comment', body: 'Click any item on the page to pin a note to it. The note records exactly what you clicked — the element, its styles, a screenshot and the time — and becomes a task on the Production page, so a quick thought while editing turns into planned work with no extra effort. Press C to switch to Comment from the keyboard.' },
  'canvas.tool.draw': { tip: 'Sketch on the canvas (D)', title: 'Draw', body: 'Draw freehand marks on the canvas to point things out — circle a problem, arrow toward a spot, scribble a margin note. Marks sit on the canvas layer, not inside your app, so they never affect the real page and can be cleared without touching anything.' },
  'canvas.tool.insert': { tip: 'Add a component or icon', title: 'Insert', body: 'Opens the Assets window, where you can try shadcn/ui components and Lucide icons live. Choose Insert into app, then click a spot in your app: near the top or bottom edge of an element places it before or after, the middle places it inside (hold Alt for small items). It appears as a preview, and a Production task records where it goes and the code to add, so your agent can build it for real.' },
  'canvas.tool.hand': { tip: 'Pan the canvas (Space)', title: 'Hand', body: 'Drag to move around the canvas without selecting or changing anything. The hand is the safe tool: when it is active you cannot accidentally click, move or edit something in your app. Hold Space at any time to pan temporarily, whatever tool is selected.' },
  'canvas.zoom-out': { tip: 'Zoom out', title: 'Zoom out', body: 'Steps the canvas zoom down so you can see more of the page at once. Useful for checking the overall balance of a layout after working up close on a detail.' },
  'canvas.zoom-in': { tip: 'Zoom in', title: 'Zoom in', body: 'Steps the canvas zoom up for a closer look at detail — handy before pinning a comment to a small icon or checking that two edges really line up.' },
  'canvas.fit': { tip: 'Fit the page to the window', title: 'Fit', body: 'Picks a zoom level so the whole frame fits comfortably in the visible canvas. A good first step after resizing the window or opening a new frame, and a quick way back to an overview after zooming in on details.' },
  'canvas.window': { tip: 'Open a floating tool window', title: 'Tool windows', body: 'Each button opens a floating window: Layers, Inspector, Comments, Production list, Assets, Style Lab, Motion, Code or Screens. Windows float over the canvas and can be moved, resized and closed independently, so you can arrange the workspace around whatever you are doing. Reset layout puts everything back if the arrangement gets messy.' },
  'canvas.screens': { tip: 'Browse the screens in your project', title: 'Screens', body: 'Scans your project and lists every screen it finds, with thumbnails so you can recognise them at a glance. Pick one to open it on the canvas. This is the fastest way to jump between parts of a larger app without navigating the app itself.' },
  'canvas.reset': { tip: 'Back to the default layout', title: 'Reset layout', body: 'Closes all floating windows and puts the canvas panels back where they started. Your style changes, comments and tasks are not touched — only the arrangement of the workspace is reset.' },
  'canvas.connect': {
    tip: 'Style your own running app',
    title: 'Connect app',
    body: 'Points Layers at a web app running on your machine or on a server, so you can style the real thing instead of the demo. Once connected you can select elements, preview style changes live, and save them as change records — all without touching the app\u2019s source files. The one requirement is a small one-time script tag added to your app\u2019s page so the two can talk; the connection dialog shows you exactly what to paste and where. The demo project is always available if you want to practise first.',
  },
  'canvas.add-frame': { tip: 'Open another frame on the canvas', title: 'Add frame', body: 'Adds a second frame so you can look at two screens or two apps side by side and edit each one independently. Useful for comparing pages, checking that a style change looks right in more than one place, or keeping a reference screen visible while you work on another.' },

  // Floating tool pill
  'pill.use': { tip: 'Use your app normally', title: 'Use', body: 'The page behaves exactly as it would in a browser: clicks, typing, scrolling and navigation all go straight to your app. Switch to Use whenever you want to try the app itself — test a flow, reach the screen you want to comment on, or simply check that everything still works after your style changes.' },
  'pill.grab': { tip: 'Pick a part of the page (V)', title: 'Grab', body: 'Click anything on the page to select it for inspection and editing. The selection is what the Inspector and the style controls act upon, and it is also what a comment attaches to if you pin one while something is selected. Press V to switch to Grab from the keyboard and Esc to stop.' },
  'pill.comment': { tip: 'Pin a note to something (C)', title: 'Comment', body: 'Click any item to pin a note to it. The note remembers the exact element you clicked — its name, text, position, styles and a screenshot — and becomes a task on the Production page, so the thought you had while editing is never lost and never ambiguous. Press C to switch to Comment from the keyboard and Esc to stop.' },
  'pill.undo': { tip: 'Undo the last change (Ctrl+Z)', title: 'Undo', body: 'Steps back through your style edits one at a time, most recent first. A whole slider drag counts as a single step, so one undo takes you back to where the drag started rather than to some midpoint. Undo covers style changes made through the editor; it never touches your comments or tasks.' },
  'pill.redo': { tip: 'Redo (Ctrl+Shift+Z)', title: 'Redo', body: 'Re-applies a change you just undid, stepping forward through the same history Undo walks back through. Handy when you undo one step too many, or when you want to flip back and forth between two versions of a look to compare them.' },
  'pill.pins': { tip: 'Show or hide comment pins', title: 'Pins', body: 'Toggles the markers that show where comments are pinned on the page. Hiding pins is purely visual — the comments themselves are never deleted — so you can clear the clutter while taking a screenshot or judging a design, then bring the pins back when you want to work through the notes.' },
  'pill.motion': { tip: 'Motion tools (coming soon)', title: 'Motion', body: 'Quick motion controls for the floating bar, planned for a future update. For now, all motion settings live in the Motion folder of the GUI Editor menu, and Motion actions there can play and reset the effects while you tune them.' },
  'pill.notes': { tip: 'Your notes for the to-do list', title: 'Notes', body: 'Opens the drawer of every comment you have made. From here you can review your notes, tick them off, or send them to the Production page as tasks. It is the quick-capture inbox: dump thoughts here while you edit, then process them into planned work when you are ready.' },
};

export function helpFor(key: string): HelpEntry | undefined {
  return HELP[key];
}
