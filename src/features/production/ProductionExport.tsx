import { useEffect, useState } from 'react';
import { ClipboardCopy, Download, FolderOutput } from 'lucide-react';
import type { TaskNode } from '../../services/taskTracker';
import type { Project } from '../../services/types';
import { useOptionalServices } from '../../services/ServicesProvider';
import { liveStyleService } from '../../services/liveStyleService';
import { getCommentShots } from '../../services/shotStore';
import { dataUrlToBlob, downloadFile, projectFolder, supportsProjectFolders, writeFiles } from '../../services/projectFolder';
import { PROJECT_KEY } from '../canvas/CanvasStage';
import { compileProductionList, productionTasks, type ShotImages } from './compile';

export const PLAN_DIR = '.radium/production';
export const AGENT_PROMPT = `Read ${PLAN_DIR}/plan.md and implement every unticked item in order. Each item names the file and line, the element and the change; screenshots are in ${PLAN_DIR}/shots/. Tick each item in plan.md when it is done, then run the app to check it.`;

async function fullImages(tasks: TaskNode[]): Promise<Record<string, ShotImages>> {
  const out: Record<string, ShotImages> = {};
  await Promise.all(tasks.filter(t => t.source?.fullShots).map(async t => {
    const shots = await getCommentShots(t.source!.commentId);
    if (shots) out[t.source!.commentId] = { view: shots.view, element: shots.element };
  }));
  return out;
}

/** Saves the production list, with screenshots, into the app's folder for a coding agent. */
export function ProductionExport({ tasks }: { tasks: TaskNode[] }) {
  const services = useOptionalServices()?.runtime.services;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(() => { try { return localStorage.getItem(PROJECT_KEY); } catch { return null; } });
  const [status, setStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void services?.projects.list().then(setProjects).catch(() => undefined); }, [services]);
  const project = projects.find(p => p.id === projectId) ?? projects[0];
  const count = productionTasks(tasks, project?.id).length + new Set(liveStyleService.changes().map(c => c.node.rid ?? c.node.selector)).size;

  const compile = async () => {
    const own = productionTasks(tasks, project?.id);
    return compileProductionList({ project: project?.name ?? 'My app', projectId: project?.id, tasks, styleChanges: liveStyleService.changes(), images: await fullImages(own) });
  };
  const save = async (pick: boolean) => {
    setBusy(true); setStatus(''); setSaved(false);
    try {
      const list = await compile();
      const dir = await projectFolder(`project:${project?.id ?? 'none'}`, { pick });
      if (!dir) { setStatus('No folder chosen.'); return; }
      await writeFiles(dir, [
        { path: `${PLAN_DIR}/plan.md`, data: list.markdown },
        { path: `${PLAN_DIR}/plan.json`, data: JSON.stringify(list.json, null, 2) },
        ...list.shots.map(s => ({ path: `${PLAN_DIR}/${s.path}`, data: dataUrlToBlob(s.dataUrl) })),
      ]);
      setSaved(true);
      setStatus(`Saved ${list.json.items.length} item${list.json.items.length === 1 ? '' : 's'} and ${list.shots.length} screenshot${list.shots.length === 1 ? '' : 's'} to ${dir.name}/${PLAN_DIR}/plan.md`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not save the list.'); }
    finally { setBusy(false); }
  };
  const download = async () => {
    const list = await compile();
    downloadFile('plan.md', list.markdown, 'text/markdown');
    downloadFile('plan.json', JSON.stringify(list.json, null, 2), 'application/json');
    setStatus('Downloaded plan.md and plan.json. Put them in your app’s .radium/production folder.');
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(AGENT_PROMPT); setStatus('Agent prompt copied. Paste it into Claude Code in your app’s folder.'); }
    catch { window.prompt('Copy this prompt for your agent:', AGENT_PROMPT); }
  };

  return <div className="production-export" role="group" aria-label="Hand off to an agent">
    {projects.length > 1 && <select aria-label="Project to export" value={project?.id ?? ''} onChange={e => setProjectId(e.target.value)}>
      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>}
    {supportsProjectFolders()
      ? <>
        <button type="button" className="task-tree__chip" disabled={busy} onClick={() => void save(false)} title="Writes .radium/production/plan.md, plan.json and screenshots into your app's folder">
          <FolderOutput size={12} /> {busy ? 'Saving…' : `Save for agent (${count})`}
        </button>
        <button type="button" className="task-tree__chip" disabled={busy} onClick={() => void save(true)}>Choose folder…</button>
      </>
      : <button type="button" className="task-tree__chip" onClick={() => void download()}><Download size={12} /> Download list ({count})</button>}
    {saved && <button type="button" className="task-tree__chip" onClick={() => void copyPrompt()}><ClipboardCopy size={12} /> Copy agent prompt</button>}
    {status && <p className="production-export__status" role="status">{status}</p>}
  </div>;
}
