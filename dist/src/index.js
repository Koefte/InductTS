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
const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
const statements = fileContent.split('\n').filter(line => line.trim() !== '');
const types = [];
const relations = [];
let inductionHypothesis = "";
let currentSegment = "";
for (const statement of statements) {
    if (statement == "relations:") {
        currentSegment = "relations";
        continue;
    }
    if (statement == "induction_hypothesis:") {
        currentSegment = "induction_hypothesis";
        continue;
    }
    if (currentSegment == "relations") {
        relations.push(statement);
    }
    if (currentSegment == "induction_hypothesis") {
        inductionHypothesis = statement;
    }
}
var TokenType;
(function (TokenType) {
    TokenType[TokenType["Call"] = 0] = "Call";
    TokenType[TokenType["Var"] = 1] = "Var";
    TokenType[TokenType["Oparen"] = 2] = "Oparen";
    TokenType[TokenType["Value"] = 3] = "Value";
    TokenType[TokenType["Cparen"] = 4] = "Cparen";
})(TokenType || (TokenType = {}));
function tokenize(input) {
    let tokens = [];
    for (let i = 0; i < input.length; i++) {
        let char = input[i];
        if (char == ' ') {
            continue;
        }
        if (char == '(') {
            tokens.push({ val: char, type: TokenType.Oparen });
            continue;
        }
        if (char == ')') {
            tokens.push({ val: char, type: TokenType.Cparen });
            continue;
        }
        if (char >= '0' && char <= '9') {
            let number = '';
            while (i < input.length && (input[i] >= '0' && input[i] <= '9')) {
                number += input[i];
                i++;
            }
            i--;
            tokens.push({ val: number, type: TokenType.Value });
            continue;
        }
        // lowercase letter indicates variable
        if (char >= 'a' && char <= 'z') {
            let varName = '';
            while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')) {
                varName += input[i];
                i++;
            }
            i--;
            tokens.push({ val: varName, type: TokenType.Var });
            continue;
        }
        // uppercase letter indicates function call
        if (char >= 'A' && char <= 'Z') {
            let callName = '';
            while (i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')) {
                callName += input[i];
                i++;
            }
            i--;
            tokens.push({ val: callName, type: TokenType.Call });
            continue;
        }
    }
    return tokens;
}
function constructTree(input) {
    let tokens = tokenize(input);
    let originTree = { value: "root", children: [] };
    let currentTree = originTree;
    for (const token of tokens) {
        if (token.type == TokenType.Call) {
            currentTree.children.push({ value: token.val, children: [] });
            currentTree = currentTree.children[currentTree.children.length - 1];
        }
        if (token.type == TokenType.Var || token.type == TokenType.Value) {
            currentTree.children.push({ value: token.val, children: [] });
        }
        if (token.type == TokenType.Oparen) {
            continue;
        }
        if (token.type == TokenType.Cparen) {
            // move current tree back to parent
            // find parent by traversing from origin
            let path = [originTree];
            let found = false;
            while (path.length > 0 && !found) {
                let node = path.pop();
                for (const child of node.children) {
                    if (child == currentTree) {
                        currentTree = node;
                        found = true;
                        break;
                    }
                    path.push(child);
                }
            }
        }
    }
    return originTree;
}
function startsWithLowercase(str) {
    if (str.length == 0) {
        return false;
    }
    let firstChar = str[0];
    return firstChar >= 'a' && firstChar <= 'z';
}
function printTree(tree, depth = 0) {
    console.log(' '.repeat(depth) + tree.value);
    for (const child of tree.children) {
        printTree(child, depth + 2);
    }
}
function matches(nodeTree, patternTree) {
    // Skip root node
    let variableMap = new Map();
    if (nodeTree.value == "root") {
        nodeTree = nodeTree.children[0];
    }
    if (patternTree.value == "root") {
        patternTree = patternTree.children[0];
    }
    // If pattern is a variable (lowercase), match anything and bind it
    if (startsWithLowercase(patternTree.value)) {
        variableMap.set(patternTree.value, treeToString(nodeTree));
        return variableMap;
    }
    // Special handling for Constant and Variable wrappers
    // If pattern is Constant(x) or Variable(x), try to match against bare x
    if ((patternTree.value === "Constant" || patternTree.value === "Variable") &&
        patternTree.children.length === 1 &&
        nodeTree.children.length === 0 &&
        nodeTree.value === patternTree.children[0].value) {
        return variableMap;
    }
    // Check that values match
    if (nodeTree.value != patternTree.value) {
        throw new Error(`Value mismatch: ${nodeTree.value} != ${patternTree.value}`);
    }
    // Check structural equality - same number of children
    if (nodeTree.children.length != patternTree.children.length) {
        throw new Error("Child length mismatch");
    }
    // Recursively match children
    for (let i = 0; i < nodeTree.children.length; i++) {
        let nodeChild = nodeTree.children[i];
        let patternChild = patternTree.children[i];
        const childMatches = matches(nodeChild, patternChild);
        for (const [key, value] of childMatches.entries()) {
            variableMap.set(key, value);
        }
    }
    return variableMap;
}
function putVariables(template, variableMap) {
    let result = template;
    for (const [key, value] of variableMap.entries()) {
        let regex = new RegExp(`\\b${key}\\b`, 'g');
        result = result.replace(regex, value);
    }
    return result;
}
function cloneTree(tree) {
    return {
        value: tree.value,
        children: tree.children.map(child => cloneTree(child))
    };
}
function applyRelation(nodeTree, relation) {
    if (!relation) {
        return treeToString(nodeTree);
    }
    const [left, right] = relation.split('=').map((s) => s.trim());
    if (!left || !right) {
        return treeToString(nodeTree);
    }
    const leftTree = constructTree(left);
    const workTree = cloneTree(nodeTree);
    const originalString = treeToString(nodeTree);
    // Search for matching subtree and replace
    const findAndReplace = (subtree, depth = 0) => {
        // Try to match current subtree
        try {
            const variableMap = matches(cloneTree(subtree), cloneTree(leftTree));
            const replacedExpr = putVariables(right, variableMap);
            const replacedTree = constructTree(replacedExpr);
            // Replace the subtree with the result
            const replacement = (replacedTree.value === "root" && replacedTree.children.length > 0)
                ? replacedTree.children[0]
                : replacedTree;
            subtree.value = replacement.value;
            subtree.children = replacement.children;
            return true;
        }
        catch (e) {
            // Try children
            for (const child of subtree.children) {
                if (findAndReplace(child, depth + 1)) {
                    return true;
                }
            }
            return false;
        }
    };
    // Start search from root or first child
    if (workTree.value === "root" && workTree.children.length > 0) {
        findAndReplace(workTree.children[0]);
    }
    else {
        findAndReplace(workTree);
    }
    const resultString = treeToString(workTree);
    return resultString !== originalString ? resultString : originalString;
}
function treeToString(tree) {
    // Skip root node
    if (tree.value === "root") {
        if (tree.children.length === 0) {
            return "";
        }
        if (tree.children.length === 1) {
            return treeToString(tree.children[0]);
        }
    }
    if (tree.children.length == 0) {
        return tree.value;
    }
    let result = tree.value + '(';
    for (let i = 0; i < tree.children.length; i++) {
        result += treeToString(tree.children[i]);
        if (i < tree.children.length - 1) {
            result += ',';
        }
    }
    result += ')';
    return result;
}
function applyAllRelations(node) {
    let results = [];
    for (const relation of relations) {
        let nodeTree = constructTree(node);
        const applyResult = applyRelation(nodeTree, relation);
        if (applyResult && applyResult != node) {
            results.push(applyResult);
        }
    }
    let nodeTree = constructTree(node);
    const hypResult = applyRelation(nodeTree, inductionHypothesis);
    if (hypResult && hypResult != node) {
        results.push(hypResult);
    }
    return results;
}
function resolveSubstitutions(node) {
    for (let i = 0; i < node.length; i++) {
        if (node[i] == '\\') {
            let toRemove = node[i + 1];
            let toReplace = '';
            i = i + 2;
            let j = i - 2;
            let balance = 1;
            while (i < node.length && balance != 0) {
                if (node[i] == '(') {
                    balance++;
                }
                else if (node[i] == ')') {
                    balance--;
                }
                if (balance == 0) {
                    break;
                }
                toRemove += node[i];
                i++;
            }
            while (j >= 0 && node[j] != ',') {
                toReplace = node[j] + toReplace;
                j--;
            }
            console.log(`Removing substitution: ${toRemove} replacing with: ${toReplace}`);
            node = node.replace(toRemove, '');
            node = node.replace(toReplace, toRemove);
        }
    }
    return node;
}
const expr = "Sum(k,1,Add(Variable(n),Constant(1)))";
let rootExpr = constructTree(expr);
if (rootExpr.value === "root" && rootExpr.children.length > 0) {
    rootExpr = rootExpr.children[0];
}
// Create a separate tree for tracking derivations (not the parse tree)
let derivationTree = {
    value: rootExpr,
    children: []
};
let frontier = [derivationTree];
for (let i = 0; i < 3; i++) {
    let nextFrontier = [];
    for (const node of frontier) {
        const exprStr = treeToString(node.value);
        const derived = applyAllRelations(exprStr);
        for (const result of derived) {
            const normalized = resolveSubstitutions(result);
            const childTree = constructTree(normalized);
            const child = (childTree.value === "root" && childTree.children.length > 0)
                ? childTree.children[0]
                : childTree;
            const derivNode = {
                value: child,
                children: []
            };
            node.children.push(derivNode);
            nextFrontier.push(derivNode);
        }
    }
    frontier = nextFrontier;
}
// Display function for derivation tree
function displayDerivationTree(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const exprStr = treeToString(node.value);
    console.log(indent + exprStr);
    for (const child of node.children) {
        displayDerivationTree(child, depth + 1);
    }
}
displayDerivationTree(derivationTree);
