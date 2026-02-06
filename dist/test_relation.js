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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const index_1 = require("./src/index");
const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
const parsed = (0, index_1.parseInductionInput)(fileContent);
console.log("=== Relations with 'where' clause ===");
for (let i = 0; i < parsed.relations.length; i++) {
    if (parsed.relations[i].includes('where')) {
        console.log(`  [${i}]: ${parsed.relations[i]}`);
    }
}
// Test with sum of natural numbers: Σ(k, k=1..n) = n(n+1)/2
const input = {
    relations: parsed.relations,
    inductionHypothesis: 'Sum(k,Constant(1),Variable(n)) = Div(Mult(Variable(n),Add(Variable(n),Constant(1))),Constant(2))'
};
console.log("\n=== Running induction ===");
const result = (0, index_1.runInduction)(input);
console.log('\nSuccess:', result.successfulBranch !== null);
