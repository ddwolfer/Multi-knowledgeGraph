import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { buildStudyServers, buildStudyHooks, initStudyProject, parseStudyArgs } from './study-init.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOOK_TEMPLATE = join(REPO, 'templates', 'claude', 'settings.json');
const toPosix = (p) => p.split('\\').join('/');

let counter = 0;
function tmpDir() {
  const dir = join(tmpdir(), `kg-study-${process.pid}-${counter++}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

test('buildStudyServers: two servers with absolute posix paths + gemini env', () => {
  const { servers } = buildStudyServers({
    engineDir: 'D:\\AI\\Multi-knowledgeGraph',
    projectDir: 'D:\\AI\\system-design-study',
    dbName: 'system-design.db',
  });

  const kg = servers['knowledge-graph'];
  assert.equal(kg.command, 'node');
  assert.deepEqual(kg.args, [
    'D:/AI/Multi-knowledgeGraph/main.js',
    '--db',
    'D:/AI/system-design-study/system-design.db',
  ]);

  const gv = servers['gemini-video'];
  assert.equal(gv.command, 'node');
  assert.equal(gv.args[0], 'D:/AI/system-design-study/mcp-gemini-video/server.js');
  assert.equal(gv.env.GEMINI_API_KEY, '${GEMINI_API_KEY}');
});

test('buildStudyHooks: substitutes KG_ROOT and binds the project db as a positional arg', () => {
  const dbPath = 'D:/AI/system-design-study/system-design.db';
  const hooks = buildStudyHooks({ engineDir: REPO, dbPath, hookTemplatePath: HOOK_TEMPLATE });

  const sessionCmd = hooks.SessionStart[0].hooks[0].command;
  assert.ok(sessionCmd.includes('/hooks/session-start.js'), 'KG_ROOT substituted into command');
  assert.ok(!sessionCmd.includes('{{KG_ROOT}}'), 'no leftover placeholder');
  assert.ok(sessionCmd.includes(dbPath), 'project db bound to the hook command');

  // Stop hook is type=agent (no command) — must be left untouched
  const stop = hooks.Stop[0].hooks[0];
  assert.equal(stop.type, 'agent');
  assert.equal(stop.command, undefined);
});

test('initStudyProject: copies templates, writes dual-server .mcp.json + hooks, idempotent', () => {
  const dir = tmpDir();
  try {
    // minimal fixture template tree
    const templates = join(dir, 'tpl');
    mkdirSync(join(templates, 'mcp-gemini-video'), { recursive: true });
    writeFileSync(join(templates, 'CLAUDE.md'), '# study coach');
    writeFileSync(join(templates, 'mcp-gemini-video', 'server.js'), '// gemini server');
    const target = join(dir, 'proj');

    const report = initStudyProject({
      target,
      engineDir: REPO,
      dbName: 'system-design.db',
      templatesStudyDir: templates,
      hookTemplatePath: HOOK_TEMPLATE,
    });

    // template files copied
    assert.ok(existsSync(join(target, 'CLAUDE.md')), 'CLAUDE.md copied');
    assert.ok(existsSync(join(target, 'mcp-gemini-video', 'server.js')), 'gemini server copied');

    // .mcp.json: two servers, KG db points at an ABSOLUTE path inside the project
    const mcp = JSON.parse(readFileSync(join(target, '.mcp.json'), 'utf8'));
    assert.ok(mcp.mcpServers['knowledge-graph'], 'kg server present');
    assert.ok(mcp.mcpServers['gemini-video'], 'gemini server present');
    const kgArgs = mcp.mcpServers['knowledge-graph'].args;
    assert.equal(kgArgs[kgArgs.length - 1], toPosix(resolve(target, 'system-design.db')));

    // hooks written, bound to the project db
    const settings = JSON.parse(readFileSync(join(target, '.claude', 'settings.json'), 'utf8'));
    assert.ok(settings.hooks.SessionStart[0].hooks[0].command.includes('system-design.db'));

    assert.equal(report.dbPath, toPosix(resolve(target, 'system-design.db')));

    // idempotent: re-run does not duplicate servers or hooks
    initStudyProject({
      target, engineDir: REPO, dbName: 'system-design.db',
      templatesStudyDir: templates, hookTemplatePath: HOOK_TEMPLATE,
    });
    const mcp2 = JSON.parse(readFileSync(join(target, '.mcp.json'), 'utf8'));
    assert.equal(Object.keys(mcp2.mcpServers).length, 2, 're-run keeps exactly 2 servers');
    const settings2 = JSON.parse(readFileSync(join(target, '.claude', 'settings.json'), 'utf8'));
    assert.equal(settings2.hooks.SessionStart.length, 2, 're-run keeps SessionStart entries stable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('initStudyProject: skips node_modules and __pycache__ when copying', () => {
  const dir = tmpDir();
  try {
    const templates = join(dir, 'tpl');
    mkdirSync(join(templates, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(templates, 'scripts', '__pycache__'), { recursive: true });
    writeFileSync(join(templates, 'node_modules', 'pkg', 'index.js'), 'x');
    writeFileSync(join(templates, 'scripts', '__pycache__', 'foo.pyc'), 'x');
    writeFileSync(join(templates, 'keep.txt'), 'k');
    const target = join(dir, 'proj');

    initStudyProject({ target, engineDir: REPO, templatesStudyDir: templates, hookTemplatePath: HOOK_TEMPLATE });

    assert.ok(existsSync(join(target, 'keep.txt')), 'normal file copied');
    assert.ok(!existsSync(join(target, 'node_modules')), 'node_modules skipped');
    assert.ok(!existsSync(join(target, 'scripts', '__pycache__')), '__pycache__ skipped');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('parseStudyArgs: --target + --db, with default db name', () => {
  const o = parseStudyArgs(['--target', 'D:\\AI\\study', '--db', 'sd.db']);
  assert.equal(o.target, 'D:\\AI\\study');
  assert.equal(o.db, 'sd.db');
  assert.equal(o.help, false);

  const d = parseStudyArgs(['--target', 'X']);
  assert.equal(d.db, 'system-design.db', 'default db name');
});

test('parseStudyArgs: -h / --help and error cases', () => {
  assert.equal(parseStudyArgs(['-h']).help, true);
  assert.equal(parseStudyArgs(['--help']).help, true);
  assert.throws(() => parseStudyArgs(['--target']), /requires a value/i);
  assert.throws(() => parseStudyArgs(['--nope']), /unknown flag/i);
});
