import express, { Request, Response } from 'express';
import * as fs from 'fs';
import { parseInductionInput, runInduction, InductionInput } from './index';
import { humanToLisp } from './humanNotationParser';

const app = express();
app.use(express.json({ limit: '1mb' }));

const exampleContent = fs.readFileSync('src/example.ind', 'utf-8');
const fixedInput = parseInductionInput(exampleContent);
const fixedRelations = fixedInput.relations;

app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

app.get('/', (_req: Request, res: Response) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Induction Successful Branch</title>
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
      svg: { fontCache: 'global' }
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 2rem; }
    textarea { width: 100%; min-height: 200px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    button { margin-top: 1rem; padding: 0.6rem 1rem; }
    .output { margin-top: 2rem; }
    .equation { margin: 0.5rem 0; }
    .step { opacity: 0; animation: fadeIn 0.6s ease forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
</head>
<body>
  <h1>Induction Successful Branch</h1>
  <p>Enter your induction hypothesis below (relations are fixed by example.ind):</p>
  <textarea id="input" placeholder="e.g., Sum(f, n) = ..."></textarea>
  <br />
  <button id="run">Run</button>

  <div class="output" id="output"></div>

  <script>
    const runBtn = document.getElementById('run');
    const inputEl = document.getElementById('input');
    const outputEl = document.getElementById('output');

    runBtn.addEventListener('click', async () => {
      outputEl.innerHTML = 'Running...';
      try {
        const res = await fetch('/induction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inductionHypothesis: inputEl.value })
        });
        const data = await res.json();
        if(!res.ok){
          throw new Error(data.error || 'Request failed');
        }
        const equations = data.successfulBranchLatex || [];
        const goal = data.goalLatex ? '$$' + data.goalLatex + '$$' : '';
        outputEl.innerHTML = '';
        const status = document.createElement('div');
        status.style.marginBottom = '1rem';
        if(equations.length > 0){
          status.innerHTML = '<strong style="color: #16a34a;">Goal reached ✓</strong>';
        } else {
          status.innerHTML = '<strong style="color: #dc2626;">Goal not reached</strong>';
        }
        outputEl.appendChild(status);
        if(goal){
          const goalDiv = document.createElement('div');
          goalDiv.className = 'equation';
          goalDiv.innerHTML = '<h3>Goal</h3>' + goal;
          outputEl.appendChild(goalDiv);
        }
        if(equations.length === 0){
          const none = document.createElement('div');
          none.textContent = 'No successful branch found.';
          outputEl.appendChild(none);
        } else {
          const list = document.createElement('div');
          list.innerHTML = '<h3>Successful Branch</h3>';
          equations.forEach((eq, idx) => {
            const div = document.createElement('div');
            div.className = 'equation step';
            div.style.animationDelay = (idx * 0.2) + 's';
            div.innerHTML = '$$' + eq + ' \\\\Leftrightarrow$$';
            list.appendChild(div);
          });
          outputEl.appendChild(list);
        }
        if(window.MathJax && window.MathJax.typesetPromise){
          window.MathJax.typesetPromise();
        }
      } catch (err) {
        outputEl.textContent = String(err);
      }
    });
  </script>
</body>
</html>`);
});

app.post('/induction', (req: Request, res: Response) => {
    try {
    let input: InductionInput;
    if(typeof req.body?.inductionHypothesis === 'string'){
      // Parse human-readable notation to Lisp notation
      const hypothesisInput = req.body.inductionHypothesis.trim();
      let lispHypothesis: string;

      const isLikelyLisp = (value: string): boolean => {
        if (!value) return false;
        const lispFunctionPattern = /\b[A-Z][A-Za-z0-9_]*\s*\(/;
        const lispKeywordsPattern = /\b(Constant|Variable|Add|Subtract|Mult|Div|Sum)\s*\(/;
        return lispFunctionPattern.test(value) || lispKeywordsPattern.test(value);
      };
      
      if (isLikelyLisp(hypothesisInput)) {
        lispHypothesis = hypothesisInput;
      } else {
        // Try to parse as human notation first
        try {
          // Check if it contains '=' (an equation)
          if (hypothesisInput.includes('=')) {
            const equalsIndex = hypothesisInput.indexOf('=');
            const left = hypothesisInput.substring(0, equalsIndex).trim();
            const right = hypothesisInput.substring(equalsIndex + 1).trim();
            lispHypothesis = `${humanToLisp(left)} = ${humanToLisp(right)}`;
          } else {
            lispHypothesis = humanToLisp(hypothesisInput);
          }
        } catch (parseError) {
          // If parsing fails, assume it's already in Lisp notation
          lispHypothesis = hypothesisInput;
        }
      }
      
      input = {
        relations: fixedRelations,
        inductionHypothesis: lispHypothesis
      };
    } else {
      return res.status(400).json({ error: 'Provide inductionHypothesis.' });
    }

        const result = runInduction(input);
        return res.json({
            successfulBranchLatex: result.successfulBranchLatex,
            goalLatex: result.goalLatex
        });
    } catch (err) {
        return res.status(500).json({ error: String(err) });
    }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
