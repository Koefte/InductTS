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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toLatexString = exports.runInduction = exports.parseInductionInput = void 0;
const fs = __importStar(require("fs"));
function parseInductionInput(fileContent) {
    const statements = fileContent.split('\n').filter(line => line.trim() !== '');
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
    return { relations, inductionHypothesis };
}
exports.parseInductionInput = parseInductionInput;
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
    // Special handling for Variable(x) in pattern - should only match bare x or Variable(x), not complex expressions
    // This is used to indicate "this must be a variable, not any expression"
    if (patternTree.value === "Variable" && patternTree.children.length === 1) {
        const patternVarName = patternTree.children[0].value;
        // Match bare variable node
        if (nodeTree.children.length === 0 && nodeTree.value === patternVarName) {
            variableMap.set(patternVarName, nodeTree.value);
            return variableMap;
        }
        // Match Variable(x) node
        if (nodeTree.value === "Variable" && nodeTree.children.length === 1 &&
            nodeTree.children[0].value === patternVarName) {
            variableMap.set(patternVarName, nodeTree.children[0].value);
            return variableMap;
        }
        // Don't match complex expressions
        throw new Error(`Variable(${patternVarName}) can only match bare variable, not ${treeToString(nodeTree)}`);
    }
    // Special handling for Constant(x) in pattern - should only match that constant
    if (patternTree.value === "Constant" && patternTree.children.length === 1) {
        const patternConstValue = patternTree.children[0].value;
        // Match bare constant
        if (nodeTree.children.length === 0 && nodeTree.value === patternConstValue) {
            return variableMap;
        }
        // Match Constant(x) node
        if (nodeTree.value === "Constant" && nodeTree.children.length === 1 &&
            nodeTree.children[0].value === patternConstValue) {
            return variableMap;
        }
        throw new Error(`Constant(${patternConstValue}) does not match ${treeToString(nodeTree)}`);
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
    // For commutative operations (Mult, Add), try all permutations
    if ((nodeTree.value === "Mult" || nodeTree.value === "Add") && nodeTree.children.length === 2) {
        try {
            // Try original order first
            const map1 = new Map();
            const child0Match = matches(nodeTree.children[0], patternTree.children[0]);
            for (const [key, value] of child0Match.entries()) {
                map1.set(key, value);
            }
            const child1Match = matches(nodeTree.children[1], patternTree.children[1]);
            for (const [key, value] of child1Match.entries()) {
                // Check for conflicts
                if (map1.has(key) && map1.get(key) !== value) {
                    throw new Error(`Variable binding conflict: ${key} cannot be both ${map1.get(key)} and ${value}`);
                }
                map1.set(key, value);
            }
            return map1;
        }
        catch (e1) {
            // Try swapped order
            try {
                const map2 = new Map();
                const child0Match = matches(nodeTree.children[0], patternTree.children[1]);
                for (const [key, value] of child0Match.entries()) {
                    map2.set(key, value);
                }
                const child1Match = matches(nodeTree.children[1], patternTree.children[0]);
                for (const [key, value] of child1Match.entries()) {
                    // Check for conflicts
                    if (map2.has(key) && map2.get(key) !== value) {
                        throw new Error(`Variable binding conflict: ${key} cannot be both ${map2.get(key)} and ${value}`);
                    }
                    map2.set(key, value);
                }
                return map2;
            }
            catch (e2) {
                throw e1; // Throw original error if both fail
            }
        }
    }
    // Non-commutative: match children in order
    for (let i = 0; i < nodeTree.children.length; i++) {
        let nodeChild = nodeTree.children[i];
        let patternChild = patternTree.children[i];
        const childMatches = matches(nodeChild, patternChild);
        for (const [key, value] of childMatches.entries()) {
            // Check for conflicts
            if (variableMap.has(key) && variableMap.get(key) !== value) {
                throw new Error(`Variable binding conflict: ${key} cannot be both ${variableMap.get(key)} and ${value}`);
            }
            variableMap.set(key, value);
        }
    }
    return variableMap;
}
function putVariables(template, variableMap) {
    let result = template;
    // First, resolve substitutions: body\Add(n,Constant(1)) means substitute k in body with Add(n,Constant(1))
    // The pattern is: identifier\something(...) 
    while (result.includes('\\')) {
        const subMatch = result.match(/(\w+)\\(.+)/);
        if (!subMatch)
            break;
        const varToSubstitute = subMatch[1]; // e.g., "body" or "k"
        const substitutionPattern = subMatch[2]; // e.g., "Add(n,Constant(1))"
        // If the variable to substitute is in our map, get its value
        if (variableMap.has(varToSubstitute)) {
            const bodyExpr = variableMap.get(varToSubstitute);
            // Now we need to find what variable is being substituted in the body
            // For the sum rule, the body contains k, and we substitute k with the pattern
            // The pattern format is something like Add(n,Constant(1)), and we need to substitute
            // the iteration variable (usually 'k') in bodyExpr with this pattern
            // Extract the iteration variable from bodyExpr (usually the first letter after Sum is the body var)
            // For now, let's just do a simple replacement of 'k'
            const bodyTree = constructTree(bodyExpr);
            const replacementTree = constructTree(substitutionPattern);
            const substitutedBody = treeToString(substitute(bodyTree, "k", substitutionPattern));
            result = result.replace(subMatch[0], substitutedBody);
        }
        else {
            break;
        }
    }
    // Then replace remaining variables with their values
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
// Convert expressions to human-readable mathematical notation
function toMathString(input, parentPrecedence = 0) {
    let tree;
    // If input is a string, construct the tree first
    if (typeof input === 'string') {
        tree = constructTree(input);
    }
    else {
        tree = input;
    }
    // Simplify the tree first (flatten constant additions)
    tree = simplifyTree(tree);
    // Skip root node
    if (tree.value === "root") {
        if (tree.children.length === 0) {
            return "";
        }
        if (tree.children.length === 1) {
            return toMathString(tree.children[0], parentPrecedence);
        }
    }
    // Base case: no children, just return the value
    if (tree.children.length === 0) {
        return tree.value;
    }
    // Handle special wrapper nodes
    if (tree.value === "Constant" || tree.value === "Variable") {
        // Unwrap single-child wrappers
        if (tree.children.length === 1) {
            return toMathString(tree.children[0], parentPrecedence);
        }
    }
    // Handle Sum specially: Sum(body, from, to)
    if (tree.value === "Sum" && tree.children.length === 3) {
        const body = toMathString(tree.children[0], 0);
        const from = toMathString(tree.children[1], 0);
        const to = toMathString(tree.children[2], 0);
        return `Σ(${body}, ${from}, ${to})`;
    }
    const operators = {
        'Add': { symbol: ' + ', precedence: 1 },
        'Sub': { symbol: ' - ', precedence: 1 },
        'Subtract': { symbol: ' - ', precedence: 1 },
        'Mult': { symbol: ' * ', precedence: 2 },
        'Div': { symbol: ' / ', precedence: 2 },
        'Pow': { symbol: '^', precedence: 3 }
    };
    const opInfo = operators[tree.value];
    // If it's a binary operator
    if (opInfo && tree.children.length === 2) {
        const left = toMathString(tree.children[0], opInfo.precedence);
        const right = toMathString(tree.children[1], opInfo.precedence);
        let result = `${left}${opInfo.symbol}${right}`;
        // Add parentheses if this operator has lower precedence than parent
        if (parentPrecedence > opInfo.precedence) {
            result = `(${result})`;
        }
        return result;
    }
    // Default: render as function call with arguments
    let result = tree.value + '(';
    for (let i = 0; i < tree.children.length; i++) {
        result += toMathString(tree.children[i], 0);
        if (i < tree.children.length - 1) {
            result += ', ';
        }
    }
    result += ')';
    return result;
}
// Convert expressions to LaTeX notation
function toLatexString(input, parentPrecedence = 0) {
    let tree;
    if (typeof input === 'string') {
        tree = constructTree(input);
    }
    else {
        tree = input;
    }
    tree = simplifyTree(tree);
    if (tree.value === "root") {
        if (tree.children.length === 0) {
            return "";
        }
        if (tree.children.length === 1) {
            return toLatexString(tree.children[0], parentPrecedence);
        }
    }
    if (tree.children.length === 0) {
        return tree.value;
    }
    if (tree.value === "Constant" || tree.value === "Variable") {
        if (tree.children.length === 1) {
            return toLatexString(tree.children[0], parentPrecedence);
        }
    }
    if (tree.value === "Sum" && tree.children.length === 3) {
        const body = toLatexString(tree.children[0], 0);
        const from = toLatexString(tree.children[1], 0);
        const to = toLatexString(tree.children[2], 0);
        return `\\sum_{${from}}^{${to}} ${body}`;
    }
    const operators = {
        'Add': { symbol: ' + ', precedence: 1 },
        'Sub': { symbol: ' - ', precedence: 1 },
        'Subtract': { symbol: ' - ', precedence: 1 },
        'Mult': { symbol: ' \\cdot ', precedence: 2 },
        'Div': { symbol: '/', precedence: 2, latex: true },
        'Pow': { symbol: '^', precedence: 3, latex: true }
    };
    const opInfo = operators[tree.value];
    if (opInfo && tree.children.length === 2) {
        const left = toLatexString(tree.children[0], opInfo.precedence);
        const right = toLatexString(tree.children[1], opInfo.precedence);
        if (tree.value === 'Div') {
            return `\\frac{${left}}{${right}}`;
        }
        if (tree.value === 'Pow') {
            const base = parentPrecedence > opInfo.precedence ? `\\left(${left}\\right)` : left;
            return `${base}^{${right}}`;
        }
        let result = `${left}${opInfo.symbol}${right}`;
        if (parentPrecedence > opInfo.precedence) {
            result = `\\left(${result}\\right)`;
        }
        return result;
    }
    let result = tree.value + '\\left(';
    for (let i = 0; i < tree.children.length; i++) {
        result += toLatexString(tree.children[i], 0);
        if (i < tree.children.length - 1) {
            result += ', ';
        }
    }
    result += '\\right)';
    return result;
}
exports.toLatexString = toLatexString;
function simplifyTree(tree) {
    // Simplify children first
    tree.children = tree.children.map(child => simplifyTree(child));
    if (tree.value === "Add") {
        let newChildren = [];
        let constantSum = 0;
        for (const child of tree.children) {
            if (child.value === "Constant" && child.children.length === 1) {
                const constValue = parseInt(child.children[0].value);
                if (!isNaN(constValue)) {
                    constantSum += constValue;
                    continue;
                }
            }
            newChildren.push(child);
        }
        if (constantSum > 0) {
            newChildren.push({
                value: "Constant",
                children: [{ value: constantSum.toString(), children: [] }]
            });
        }
        // If only one child remains, return it directly
        if (newChildren.length === 1) {
            return newChildren[0];
        }
        tree.children = newChildren;
    }
    if (tree.value == "Mult") {
        let newChildren = [];
        let constantProduct = 1;
        for (const child of tree.children) {
            if (child.value === "Constant" && child.children.length === 1) {
                const constValue = parseInt(child.children[0].value);
                if (!isNaN(constValue)) {
                    constantProduct *= constValue;
                    continue;
                }
            }
            newChildren.push(child);
        }
        if (constantProduct != 1) {
            newChildren.push({
                value: "Constant",
                children: [{ value: constantProduct.toString(), children: [] }]
            });
        }
        // If only one child remains, return it directly
        if (newChildren.length === 1) {
            return newChildren[0];
        }
        tree.children = newChildren;
    }
    if (tree.value === "Subtract" || tree.value === "Sub") {
        // If both children are constants, compute the result
        if (tree.children.length === 2) {
            const left = tree.children[0];
            const right = tree.children[1];
            let leftVal = null;
            let rightVal = null;
            if (left.value === "Constant" && left.children.length === 1) {
                leftVal = parseInt(left.children[0].value);
            }
            else if (left.children.length === 0 && !isNaN(parseInt(left.value))) {
                leftVal = parseInt(left.value);
            }
            if (right.value === "Constant" && right.children.length === 1) {
                rightVal = parseInt(right.children[0].value);
            }
            else if (right.children.length === 0 && !isNaN(parseInt(right.value))) {
                rightVal = parseInt(right.value);
            }
            if (leftVal !== null && rightVal !== null) {
                const result = leftVal - rightVal;
                return {
                    value: "Constant",
                    children: [{ value: result.toString(), children: [] }]
                };
            }
            // Handle Add(..., Constant(a)) - Constant(b) => Add(..., Constant(a-b))
            if (left.value === "Add" && rightVal !== null) {
                // Find constant child in Add
                let constIndex = -1;
                let constVal = 0;
                for (let i = 0; i < left.children.length; i++) {
                    const child = left.children[i];
                    if (child.value === "Constant" && child.children.length === 1) {
                        constVal = parseInt(child.children[0].value);
                        if (!isNaN(constVal)) {
                            constIndex = i;
                            break;
                        }
                    }
                }
                if (constIndex >= 0) {
                    const newConstVal = constVal - rightVal;
                    const newChildren = [...left.children];
                    if (newConstVal === 0) {
                        // Remove the constant entirely
                        newChildren.splice(constIndex, 1);
                        if (newChildren.length === 1) {
                            return newChildren[0];
                        }
                    }
                    else {
                        newChildren[constIndex] = {
                            value: "Constant",
                            children: [{ value: newConstVal.toString(), children: [] }]
                        };
                    }
                    return {
                        value: "Add",
                        children: newChildren
                    };
                }
            }
        }
    }
    return tree;
}
function applyAllRelations(node, relations, inductionHypothesis) {
    let results = [];
    for (const relation of relations) {
        let nodeTree = constructTree(node);
        const applyResult = applyRelation(nodeTree, relation);
        if (applyResult && applyResult != node) {
            results.push(applyResult);
        }
    }
    // Apply induction hypothesis as a relation
    const [hypLeft, hypRight] = inductionHypothesis.split('=').map((s) => s.trim());
    let nodeTree = constructTree(node);
    const applyHypResult = applyRelation(nodeTree, `${hypLeft} = ${hypRight}`);
    if (applyHypResult && applyHypResult != node) {
        console.log("Got here via induction hypothesis");
        console.log("  result: " + applyHypResult);
        printTree(constructTree(applyHypResult));
        results.push(applyHypResult);
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
function substitute(tree, target, replacement) {
    const replacementTree = constructTree(replacement);
    // Helper function to perform tree-level substitution
    const substituteInTree = (node) => {
        // If this node is just the target variable (bare identifier, not wrapped in Variable())
        if (node.value === target && node.children.length === 0) {
            // Return the replacement tree (without Variable wrapper)
            return replacementTree.value === "root" && replacementTree.children.length > 0
                ? cloneTree(replacementTree.children[0])
                : cloneTree(replacementTree);
        }
        // If this node matches the target pattern wrapped in Variable(target), replace it
        if (node.value === "Variable" && node.children.length === 1 && node.children[0].value === target) {
            // Return the replacement tree (without Variable wrapper)
            return replacementTree.value === "root" && replacementTree.children.length > 0
                ? cloneTree(replacementTree.children[0])
                : cloneTree(replacementTree);
        }
        // Otherwise, recursively substitute in children
        return {
            value: node.value,
            children: node.children.map(child => substituteInTree(child))
        };
    };
    return substituteInTree(tree);
}
// Display function for derivation tree
function displayDerivationTree(node, depth = 0) {
    const indent = '  '.repeat(depth);
    const mathStr = toMathString(node.value);
    console.log(indent + mathStr);
    for (const child of node.children) {
        displayDerivationTree(child, depth + 1);
    }
}
function extractSuccessfulBranchLatex(branch) {
    if (!branch) {
        return [];
    }
    const latex = [];
    let current = branch;
    while (current) {
        latex.push(toLatexString(current.value));
        current = current.children.length > 0 ? current.children[0] : null;
    }
    return latex;
}
function runInduction(input) {
    const { relations, inductionHypothesis } = input;
    const [hypLeft, hypRightOriginal] = inductionHypothesis.split('=').map((s) => s.trim());
    const expr = treeToString(substitute(constructTree(hypLeft), "n", "Add(n,Constant(1))"));
    let rootExpr = constructTree(expr);
    if (rootExpr.value === "root" && rootExpr.children.length > 0) {
        rootExpr = rootExpr.children[0];
    }
    // Create a separate tree for tracking derivations (not the parse tree)
    let derivationTree = {
        value: rootExpr,
        children: []
    };
    // Track parents for each derivation node to reconstruct a successful branch
    const parentMap = new Map();
    parentMap.set(derivationTree, null);
    let successfulBranch = null;
    function buildSuccessfulBranch(leaf) {
        var _a;
        const path = [];
        let current = leaf;
        while (current) {
            path.push(current);
            current = (_a = parentMap.get(current)) !== null && _a !== void 0 ? _a : null;
        }
        path.reverse();
        let branchRoot = {
            value: path[0].value,
            children: []
        };
        let cursor = branchRoot;
        for (let i = 1; i < path.length; i++) {
            const nextNode = {
                value: path[i].value,
                children: []
            };
            cursor.children.push(nextNode);
            cursor = nextNode;
        }
        return branchRoot;
    }
    let frontier = [derivationTree];
    // Substitute n with n+1 in the hypothesis RHS
    const hypRightTree = constructTree(hypRightOriginal);
    const hypRightSubstituted = substitute(hypRightTree, "n", "Add(n,Constant(1))");
    const hypRightMath = toMathString(hypRightSubstituted);
    console.log("\n=== Induction Hypothesis Goal ===");
    console.log("Original RHS: " + hypRightOriginal);
    console.log("After substitution (structure): " + treeToString(hypRightSubstituted));
    console.log("After substitution (math): " + hypRightMath);
    console.log("===================================\n");
    // Normalize math strings by removing spacing differences and simplifying additions like (n+1+1) to (n+2)
    function normalizeMathString(math) {
        let result = math;
        // Replace patterns like (n + 1 + 1) with (n + 2)
        result = result.replace(/\(n \+ 1 \+ 1\)/g, "(n + 2)");
        return result;
    }
    for (let i = 0; i < 3; i++) {
        let nextFrontier = [];
        for (const node of frontier) {
            const exprStr = treeToString(node.value);
            const exprMath = toMathString(node.value);
            const normExprMath = normalizeMathString(exprMath);
            const normHypMath = normalizeMathString(hypRightMath);
            // Check if we've reached the induction hypothesis RHS (by comparing normalized math notation)
            if (normExprMath === normHypMath) {
                console.log("✓ Reached induction hypothesis goal!");
                successfulBranch = buildSuccessfulBranch(node);
                frontier = [];
                break;
            }
            const derived = applyAllRelations(exprStr, relations, inductionHypothesis);
            for (const result of derived) {
                const normalized = resolveSubstitutions(result);
                const childTree = constructTree(normalized);
                let child = (childTree.value === "root" && childTree.children.length > 0)
                    ? childTree.children[0]
                    : childTree;
                child = simplifyTree(child);
                console.log("Derived: " + toMathString(child));
                // Check if this result matches the hypothesis goal
                const childMath = toMathString(child);
                const normChildMath = normalizeMathString(childMath);
                if (normChildMath === normHypMath) {
                    console.log("✓ Reached induction hypothesis goal!");
                    const derivNode = {
                        value: child,
                        children: []
                    };
                    node.children.push(derivNode);
                    parentMap.set(derivNode, node);
                    successfulBranch = buildSuccessfulBranch(derivNode);
                    nextFrontier = []; // Stop exploring further
                    frontier = [];
                    break;
                }
                const derivNode = {
                    value: child,
                    children: []
                };
                node.children.push(derivNode);
                parentMap.set(derivNode, node);
                nextFrontier.push(derivNode);
            }
            if (frontier.length === 0)
                break;
        }
        frontier = nextFrontier;
        if (frontier.length === 0)
            break;
    }
    if (successfulBranch) {
        console.log("\n=== Successful Branch (separate) ===");
        displayDerivationTree(successfulBranch);
    }
    return {
        successfulBranch,
        successfulBranchLatex: extractSuccessfulBranchLatex(successfulBranch),
        goalLatex: toLatexString(hypRightSubstituted)
    };
}
exports.runInduction = runInduction;
if (require.main === module) {
    const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
    const input = parseInductionInput(fileContent);
    runInduction(input);
}
