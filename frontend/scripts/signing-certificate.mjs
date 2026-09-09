import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function signingCertificate(output) {
  const certificates = new Set([...output.matchAll(/^.*Signer.* certificate SHA-256 digest: ([a-fA-F0-9]{64})\s*$/gm)].map(match => match[1].toLowerCase()))
  if (certificates.size !== 1) throw new Error('Expected exactly one verified APK signing certificate')
  return [...certificates][0]
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  console.log(signingCertificate(readFileSync(process.argv[2], 'utf8')))
}
