// @ts-check
/** Writes a planned file list into the target directory without clobbering existing work. */
import fs from 'node:fs';
import path from 'node:path';

const BLOCK_START = '# >>> app-dev-playbook';
const BLOCK_END = '# <<< app-dev-playbook';

/**
 * @typedef {'created' | 'unchanged' | 'skipped' | 'overwritten' | 'appended' | 'updated'} Action
 * @param {import('./assemble.js').PlannedFile[]} files
 * @param {{targetDir: string, force?: boolean, dryRun?: boolean, now?: Date}} opts
 * @returns {{target: string, action: Action, backup?: string}[]}
 */
export function install(files, { targetDir, force = false, dryRun = false, now = new Date() }) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  /** @type {{target: string, action: Action, backup?: string}[]} */
  const results = [];
  for (const file of files) {
    const dest = path.join(targetDir, ...file.target.split('/'));
    const exists = fs.existsSync(dest);
    /** @param {string} content */
    const write = (content) => {
      if (dryRun) return;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
    };

    if (file.mode === 'append') {
      const current = exists ? fs.readFileSync(dest, 'utf8') : '';
      const start = current.indexOf(BLOCK_START);
      if (start === -1) {
        const sep = current === '' || current.endsWith('\n') ? '' : '\n';
        write(`${current}${sep}${current ? '\n' : ''}${file.content.trimEnd()}\n`);
        results.push({ target: file.target, action: exists ? 'appended' : 'created' });
      } else if (force) {
        const end = current.indexOf(BLOCK_END, start);
        const tail = end === -1 ? '' : current.slice(end + BLOCK_END.length).replace(/^\n/, '');
        write(`${current.slice(0, start)}${file.content.trimEnd()}\n${tail}`);
        results.push({ target: file.target, action: 'updated' });
      } else {
        results.push({ target: file.target, action: 'skipped' });
      }
      continue;
    }

    if (!exists) {
      write(file.content);
      results.push({ target: file.target, action: 'created' });
    } else if (fs.readFileSync(dest, 'utf8') === file.content) {
      results.push({ target: file.target, action: 'unchanged' });
    } else if (force) {
      const backup = `${file.target}.bak-${stamp}`;
      if (!dryRun) fs.copyFileSync(dest, path.join(targetDir, ...backup.split('/')));
      write(file.content);
      results.push({ target: file.target, action: 'overwritten', backup });
    } else {
      results.push({ target: file.target, action: 'skipped' });
    }
  }
  return results;
}
