"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs = __importStar(require("fs"));
const index_1 = require("./index");
const app = (0, express_1.default)();
app.use(express_1.default.json({ limit: '1mb' }));
const exampleContent = fs.readFileSync('src/example.ind', 'utf-8');
const fixedInput = (0, index_1.parseInductionInput)(exampleContent);
const fixedRelations = fixedInput.relations;
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
app.get('/', (_req, res) => {
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
app.post('/induction', (req, res) => {
    var _a;
    try {
        let input;
        if (typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.inductionHypothesis) === 'string') {
            input = {
                relations: fixedRelations,
                inductionHypothesis: req.body.inductionHypothesis
            };
        }
        else {
            return res.status(400).json({ error: 'Provide inductionHypothesis.' });
        }
        const result = (0, index_1.runInduction)(input);
        return res.json({
            successfulBranchLatex: result.successfulBranchLatex,
            goalLatex: result.goalLatex
        });
    }
    catch (err) {
        return res.status(500).json({ error: String(err) });
    }
});
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
