const fs = require('fs')
const startLine = 1223
const src = fs.readFileSync('/tmp/big.js', 'utf8')
let depth = 0, line = startLine
let inS = null, inTmpl = false, inLC = false, inBC = false, inRe = false, inClass = false
let lastZeroLine = startLine
let prevToken = ''
const stack = []
function isRegexPos(t) {
  return t === '' || '(,=:[!&|?{};~+-*%<>^'.includes(t) || t === 'return' || t === 'typeof' || t === 'case' || t === 'in' || t === 'of' || t === 'do' || t === 'else' || t === '=>'
}
for (let i = 0; i < src.length; i++) {
  const c = src[i], n = src[i+1]
  if (c === '\n') { line++; if (inLC) inLC = false; continue }
  if (inLC) continue
  if (inBC) { if (c === '*' && n === '/') { inBC = false; i++ } continue }
  if (inS) { if (c === '\\') { i++; continue } if (c === inS) inS = null; continue }
  if (inTmpl) { if (c === '\\') { i++; continue } if (c === '`') inTmpl = false; continue }
  if (inRe) { if (c === '\\') { i++; continue } if (c === '[') inClass = true; else if (c === ']') inClass = false; else if (c === '/' && !inClass) inRe = false; continue }
  if (c === '/' && n === '/') { inLC = true; i++; continue }
  if (c === '/' && n === '*') { inBC = true; i++; continue }
  if (c === '/' && isRegexPos(prevToken)) { inRe = true; inClass = false; continue }
  if (c === '"' || c === "'") { inS = c; prevToken = 'str'; continue }
  if (c === '`') { inTmpl = true; prevToken = 'str'; continue }
  if (c === ' ' || c === '\t') continue
  if (c === '{') { stack.push(line); depth++ }
  else if (c === '}') { depth--; stack.pop(); if (depth === 0) lastZeroLine = line; if (depth < 0) { console.log('NEGATIVE at line', line); break } }
  // track simple word tokens for regex heuristic
  if (/[a-zA-Z_$]/.test(c)) { let j=i; let w=''; while(j<src.length && /[a-zA-Z0-9_$]/.test(src[j])){w+=src[j];j++} prevToken=w; i=j-1; continue }
  prevToken = c
}
console.log('final depth', depth)
console.log('last line depth returned to 0:', lastZeroLine)
console.log('open-brace lines still on stack (last 15):', stack.slice(-15))
