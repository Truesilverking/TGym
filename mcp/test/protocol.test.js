import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

test('serves and validates the read-only tool schemas over the real stdio protocol', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tgym-mcp-protocol-'))
  const file = path.join(directory, 'state-synthetic.json')
  const serialized = JSON.stringify({ unit: 'kg', routines: [{ id: 'synthetic-routine', name: 'Synthetic', ex: [] }], workouts: [] })
  await writeFile(file, serialized)
  await writeFile(path.join(directory, 'db.json'), JSON.stringify({ users: [{ id: 'synthetic', name: 'Synthetic QA' }] }))
  const client = new Client({ name: 'tgym-protocol-test', version: '1.0.0' })
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../src/index.js', import.meta.url))], env: { OPENGYM_DATA: directory, OPENGYM_UID: 'synthetic' }, stderr: 'pipe' })
  try {
    await client.connect(transport)
    const listing = await client.listTools()
    const routineTool = listing.tools.find(tool => tool.name === 'get_routine')
    expect(routineTool.inputSchema.required).toContain('routine_id')
    expect(routineTool.inputSchema.properties.routine_id.type).toBe('string')
    const list = await client.callTool({ name: 'list_routines', arguments: {} })
    expect(list.isError).not.toBe(true)
    expect(JSON.parse(list.content[0].text).routines[0].id).toBe('synthetic-routine')
    const detail = await client.callTool({ name: 'get_routine', arguments: { routine_id: 'synthetic-routine' } })
    expect(JSON.parse(detail.content[0].text).name).toBe('Synthetic')
    const invalid = await client.callTool({ name: 'get_routine', arguments: { routine_id: 7 } })
    expect(invalid.isError).toBe(true)
    expect(await readFile(file, 'utf8')).toBe(serialized)
  } finally {
    await client.close()
    if (path.dirname(directory) === os.tmpdir() && path.basename(directory).startsWith('tgym-mcp-protocol-')) await rm(directory, { recursive: true, force: true })
  }
}, 15000)
