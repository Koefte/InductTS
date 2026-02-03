import * as fs from 'fs';
const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
const statements = fileContent.split('\n').filter(line => line.trim() !== ''); 
const types = [];
const relations:string[] = [];
let inductionHypothesis = "";
let currentSegment = "";


for (const statement of statements) {
    if(statement == "relations:"){
        currentSegment = "relations";
        continue;
    }
    if(statement == "induction_hypothesis:"){
        currentSegment = "induction_hypothesis";
        continue;
    }
    if(currentSegment == "relations"){
        relations.push(statement);
    }
    if(currentSegment == "induction_hypothesis"){
        inductionHypothesis = statement;
    }
}



type Tree<T> = {
    value: T,
    children: Tree<T>[]
}

type Token = {
    val:string,
    type:TokenType
}

enum TokenType{
    Call,
    Var,
    Oparen,
    Value,
    Cparen
}

function tokenize(input:string) : Token[] {
    let tokens: Token[] = [];
    for(let i = 0;i<input.length;i++){
        let char = input[i];
        if(char == ' '){
            continue;
        }
        if(char == '('){
            tokens.push({val:char,type:TokenType.Oparen});
            continue;
        }
        if(char == ')'){
            tokens.push({val:char,type:TokenType.Cparen});
            continue;
        }
        if(char >= '0' && char <= '9'){
            let number = '';
            while(i < input.length && (input[i] >= '0' && input[i] <= '9')){
                number += input[i];
                i++;
            }
            i--;
            tokens.push({val:number,type:TokenType.Value});
            continue;
        }
        // lowercase letter indicates variable
        if(char >= 'a' && char <= 'z'){
            let varName = '';
            while(i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')){
                varName += input[i];
                i++;
            }
            i--;
            tokens.push({val:varName,type:TokenType.Var});
            continue;
        }
        // uppercase letter indicates function call
        if(char >= 'A' && char <= 'Z'){
            let callName = '';
            while(i < input.length && ((input[i] >= 'a' && input[i] <= 'z') || (input[i] >= 'A' && input[i] <= 'Z') || (input[i] >= '0' && input[i] <= '9') || input[i] == '_')){
                callName += input[i];
                i++;
            }
            i--;
            tokens.push({val:callName,type:TokenType.Call});
            continue;
        }
    }
    return tokens;
}

function constructTree(input:string) : Tree<string> {
    let tokens = tokenize(input)
    let originTree: Tree<string> = {value:"root",children:[]}
    let currentTree = originTree;
    for(const token of tokens){
        if(token.type == TokenType.Call){
            currentTree.children.push({value:token.val,children:[]});
            currentTree = currentTree.children[currentTree.children.length - 1];
        }
        if(token.type == TokenType.Var || token.type == TokenType.Value){
            currentTree.children.push({value:token.val,children:[]});
        }
        if(token.type == TokenType.Oparen){
            continue;
        }
        if(token.type == TokenType.Cparen){
            // move current tree back to parent
            // find parent by traversing from origin
            let path: Tree<string>[] = [originTree];
            let found = false;
            while(path.length > 0 && !found){
                let node = path.pop()!;
                for(const child of node.children){
                    if(child == currentTree){
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

function startsWithLowercase(str: string) : boolean {
    if(str.length == 0){
        return false;
    }
    let firstChar = str[0];
    return firstChar >= 'a' && firstChar <= 'z';
}

function printTree(tree: Tree<string>, depth: number = 0) {
    console.log(' '.repeat(depth) + tree.value);
    for (const child of tree.children) {
        printTree(child, depth + 2);
    }
}

type VariableMap = Map<string,string>;

function matches(nodeTree: Tree<string>, patternTree: Tree<string>) : VariableMap {
    // Skip root node
    let variableMap: VariableMap = new Map<string,string>();
    if(nodeTree.value == "root"){
        nodeTree = nodeTree.children[0];
    }
    if(patternTree.value == "root"){
        patternTree = patternTree.children[0];
    }

    // If pattern is a variable (lowercase), match anything and bind it
    if(startsWithLowercase(patternTree.value)){
        variableMap.set(patternTree.value, treeToString(nodeTree));
        return variableMap;
    }

    // Special handling for Constant and Variable wrappers
    // If pattern is Constant(x) or Variable(x), try to match against bare x
    if((patternTree.value === "Constant" || patternTree.value === "Variable") && 
       patternTree.children.length === 1 &&
       nodeTree.children.length === 0 &&
       nodeTree.value === patternTree.children[0].value) {
        return variableMap;
    }

    // Check that values match
    if(nodeTree.value != patternTree.value){
        throw new Error(`Value mismatch: ${nodeTree.value} != ${patternTree.value}`);
    }

    // Check structural equality - same number of children
    if(nodeTree.children.length != patternTree.children.length){
        throw new Error("Child length mismatch");
    }

    // Recursively match children
    for(let i = 0; i < nodeTree.children.length; i++){
        let nodeChild = nodeTree.children[i];
        let patternChild = patternTree.children[i];
        const childMatches = matches(nodeChild, patternChild);
        for(const [key, value] of childMatches.entries()){
            variableMap.set(key, value);
        }
    }

    return variableMap;
}

function putVariables(template:string, variableMap: VariableMap) : string {
    let result = template;
    
    // First, resolve substitutions: body\Add(n,Constant(1)) means substitute k in body with Add(n,Constant(1))
    // The pattern is: identifier\something(...) 
    while(result.includes('\\')){
        const subMatch = result.match(/(\w+)\\(.+)/);
        if(!subMatch) break;
        
        const varToSubstitute = subMatch[1];  // e.g., "body" or "k"
        const substitutionPattern = subMatch[2];  // e.g., "Add(n,Constant(1))"
        
        // If the variable to substitute is in our map, get its value
        if(variableMap.has(varToSubstitute)){
            const bodyExpr = variableMap.get(varToSubstitute)!;
            
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
        } else {
            break;
        }
    }
    
    // Then replace remaining variables with their values
    for(const [key, value] of variableMap.entries()){
        let regex = new RegExp(`\\b${key}\\b`, 'g');
        result = result.replace(regex, value);
    }
    
    return result;
}

function cloneTree(tree: Tree<string>) : Tree<string> {
    return {
        value: tree.value,
        children: tree.children.map(child => cloneTree(child))
    };
}

function applyRelation(nodeTree:Tree<string>,relation:string) : string {
    if(!relation){
        return treeToString(nodeTree);
    }
    
    const [left, right] = relation.split('=').map((s:string) => s.trim());
    if(!left || !right){
        return treeToString(nodeTree);
    }
    
    const leftTree = constructTree(left);
    const workTree = cloneTree(nodeTree);
    const originalString = treeToString(nodeTree);
    
    // Search for matching subtree and replace
    const findAndReplace = (subtree: Tree<string>, depth: number = 0) : boolean => {
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
        } catch(e) {
            // Try children
            for(const child of subtree.children){
                if(findAndReplace(child, depth + 1)){
                    return true;
                }
            }
            return false;
        }
    };
    
    // Start search from root or first child
    if(workTree.value === "root" && workTree.children.length > 0){
        findAndReplace(workTree.children[0]);
    } else {
        findAndReplace(workTree);
    }
    
    const resultString = treeToString(workTree);
    return resultString !== originalString ? resultString : originalString;
}

function treeToString(tree: Tree<string>) : string {
    // Skip root node
    if(tree.value === "root"){
        if(tree.children.length === 0){
            return "";
        }
        if(tree.children.length === 1){
            return treeToString(tree.children[0]);
        }
    }
    
    if(tree.children.length == 0){
        return tree.value;
    }
    let result = tree.value + '(';
    for(let i = 0;i<tree.children.length;i++){
        result += treeToString(tree.children[i]);
        if(i < tree.children.length - 1){
            result += ',';
        }
    }
    result += ')';
    return result;
}

// Convert expressions to human-readable mathematical notation
function toMathString(input: string | Tree<string>, parentPrecedence: number = 0): string {
    let tree: Tree<string>;
    
    // If input is a string, construct the tree first
    if(typeof input === 'string'){
        tree = constructTree(input);
    } else {
        tree = input;
    }
    
    // Simplify the tree first (flatten constant additions)
    tree = simplifyTree(tree);
    
    // Skip root node
    if(tree.value === "root"){
        if(tree.children.length === 0){
            return "";
        }
        if(tree.children.length === 1){
            return toMathString(tree.children[0], parentPrecedence);
        }
    }
    
    // Base case: no children, just return the value
    if(tree.children.length === 0){
        return tree.value;
    }
    
    // Handle special wrapper nodes
    if(tree.value === "Constant" || tree.value === "Variable"){
        // Unwrap single-child wrappers
        if(tree.children.length === 1){
            return toMathString(tree.children[0], parentPrecedence);
        }
    }
    
    // Handle Sum specially: Sum(body, from, to)
    if(tree.value === "Sum" && tree.children.length === 3){
        const body = toMathString(tree.children[0], 0);
        const from = toMathString(tree.children[1], 0);
        const to = toMathString(tree.children[2], 0);
        return `Σ(${body}, ${from}, ${to})`;
    }
    
    // Define operator mappings and precedence
    type OpInfo = { symbol: string; precedence: number; };
    const operators: { [key: string]: OpInfo } = {
        'Add': { symbol: ' + ', precedence: 1 },
        'Sub': { symbol: ' - ', precedence: 1 },
        'Subtract': { symbol: ' - ', precedence: 1 },
        'Mult': { symbol: ' * ', precedence: 2 },
        'Div': { symbol: ' / ', precedence: 2 },
        'Pow': { symbol: '^', precedence: 3 }
    };
    
    const opInfo = operators[tree.value];
    
    // If it's a binary operator
    if(opInfo && tree.children.length === 2){
        const left = toMathString(tree.children[0], opInfo.precedence);
        const right = toMathString(tree.children[1], opInfo.precedence);
        
        let result = `${left}${opInfo.symbol}${right}`;
        
        // Add parentheses if this operator has lower precedence than parent
        if(parentPrecedence > opInfo.precedence){
            result = `(${result})`;
        }
        
        return result;
    }
    
 
    // Default: render as function call with arguments
    let result = tree.value + '(';
    for(let i = 0; i < tree.children.length; i++){
        result += toMathString(tree.children[i], 0);
        if(i < tree.children.length - 1){
            result += ', ';
        }
    }
    result += ')';
    return result;
}

// Simplify tree by flattening constant additions and combining constants
function simplifyTree(tree: Tree<string>): Tree<string> {
    if(tree.children.length === 0) return tree;
    
    // Recursively simplify children first
    tree = {
        value: tree.value,
        children: tree.children.map(child => simplifyTree(child))
    };
    
    // Helper to extract numeric value from a Constant tree
    function getConstantValue(t: Tree<string>): number | null {
        if(t.value === "Constant" && t.children.length === 1){
            const val = parseInt(t.children[0].value);
            if(!isNaN(val)) return val;
        }
        return null;
    }
    
    // If this is Add with Constant children, try to combine them
    if(tree.value === "Add" && tree.children.length === 2){
        const left = tree.children[0];
        const right = tree.children[1];
        
        const rightVal = getConstantValue(right);
        
        // If right is a constant and left is Add(..., Constant(a)), combine the constants
        if(rightVal !== null && left.value === "Add" && left.children.length === 2){
            const leftRightVal = getConstantValue(left.children[1]);
            if(leftRightVal !== null){
                const combined = leftRightVal + rightVal;
                const newConst = {
                    value: "Constant",
                    children: [{
                        value: String(combined),
                        children: []
                    }]
                };
                return {
                    value: "Add",
                    children: [left.children[0], newConst]
                };
            }
        }
    }
    
    return tree;
}


function applyAllRelations(node: string) : string[] {
    let results: string[] = [];
    for (const relation of relations) {
        let nodeTree = constructTree(node);
        const applyResult = applyRelation(nodeTree,relation);
        if(applyResult && applyResult != node){
            results.push(applyResult);
        }
    }
    // Apply induction hypothesis as a relation
    const [hypLeft, hypRight] = inductionHypothesis.split('=').map((s:string) => s.trim());
    let nodeTree = constructTree(node);
    const applyHypResult = applyRelation(nodeTree, `${hypLeft} = ${hypRight}`);
    if(applyHypResult && applyHypResult != node){
        results.push(applyHypResult);
    }
    
    return results;

}

function resolveSubstitutions(node:string):string{
    for(let i = 0;i<node.length;i++){
        if(node[i] == '\\'){
            let toRemove = node[i+1];
            let toReplace = '';
            i = i + 2;
            let j = i - 2;
            let balance = 1
            while(i < node.length && balance != 0){
                if(node[i] == '('){
                    balance++;
                }
                else if(node[i] == ')'){
                    balance--;
                }
                if(balance == 0){
                    break;
                }
                toRemove += node[i];
                i++;
            }
            while(j >= 0 && node[j] != ','){
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


function substitute(tree: Tree<string>, target: string, replacement: string) : Tree<string> {
    const replacementTree = constructTree(replacement);
    
    // Helper function to perform tree-level substitution
    const substituteInTree = (node: Tree<string>): Tree<string> => {
        // If this node is just the target variable (bare identifier, not wrapped in Variable())
        if(node.value === target && node.children.length === 0) {
            // Return the replacement tree (without Variable wrapper)
            return replacementTree.value === "root" && replacementTree.children.length > 0
                ? cloneTree(replacementTree.children[0])
                : cloneTree(replacementTree);
        }
        
        // If this node matches the target pattern wrapped in Variable(target), replace it
        if(node.value === "Variable" && node.children.length === 1 && node.children[0].value === target) {
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



const [hypLeft, hypRightOriginal] = inductionHypothesis.split('=').map((s:string) => s.trim());
const expr = treeToString(substitute(constructTree(hypLeft), "n", "Add(n,Constant(1))"));
let rootExpr = constructTree(expr);
if(rootExpr.value === "root" && rootExpr.children.length > 0){
    rootExpr = rootExpr.children[0];
}




// Create a separate tree for tracking derivations (not the parse tree)
let derivationTree: Tree<Tree<string>> = {
    value: rootExpr,
    children: []
};



let frontier: Tree<Tree<string>>[] = [derivationTree];

// Extract the right-hand side of the induction hypothesis

// Substitute n with n+1 in the hypothesis RHS
const hypRightTree = constructTree(hypRightOriginal);
const hypRightSubstituted = substitute(hypRightTree, "n", "Add(n,Constant(1))");
const hypRight = treeToString(hypRightSubstituted);
const hypRightMath = toMathString(hypRightSubstituted);

console.log("\n=== Induction Hypothesis Goal ===");
console.log("Original RHS: " + hypRightOriginal);
console.log("After substitution (structure): " + hypRight);
console.log("After substitution (math): " + hypRightMath);
console.log("===================================\n");

// Normalize math strings by removing spacing differences and simplifying additions like (n+1+1) to (n+2)
function normalizeMathString(math: string): string {
    let result = math;
    // Replace patterns like (n + 1 + 1) with (n + 2)
    result = result.replace(/\(n \+ 1 \+ 1\)/g, "(n + 2)");
    return result;
}

for(let i = 0; i < 5; i++){
    let nextFrontier: Tree<Tree<string>>[] = [];
    for (const node of frontier) {
        const exprStr = treeToString(node.value);
        const exprMath = toMathString(node.value);
        const normExprMath = normalizeMathString(exprMath);
        const normHypMath = normalizeMathString(hypRightMath);
        
        // Check if we've reached the induction hypothesis RHS (by comparing normalized math notation)
        if(normExprMath === normHypMath){
            console.log("✓ Reached induction hypothesis goal!");
            frontier = [];
            break;
        }
        
        const derived = applyAllRelations(exprStr);
        for (const result of derived) {
            const normalized = resolveSubstitutions(result);
            const childTree = constructTree(normalized);
            const child = (childTree.value === "root" && childTree.children.length > 0) 
                ? childTree.children[0] 
                : childTree;
            
            // Check if this result matches the hypothesis goal
            const childStr = treeToString(child);
            const childMath = toMathString(child);
            const normChildMath = normalizeMathString(childMath);
            if(normChildMath === normHypMath){
                console.log("✓ Reached induction hypothesis goal!");
                const derivNode: Tree<Tree<string>> = {
                    value: child,
                    children: []
                };
                node.children.push(derivNode);
                nextFrontier = [];  // Stop exploring further
                frontier = [];
                break;
            }
            const derivNode: Tree<Tree<string>> = {
                value: child,
                children: []
            };
            node.children.push(derivNode);
            nextFrontier.push(derivNode);
        }
        
        if(frontier.length === 0) break;
    }
    frontier = nextFrontier;
    if(frontier.length === 0) break;
}

// Display function for derivation tree
function displayDerivationTree(node: Tree<Tree<string>>, depth: number = 0) {
    const indent = '  '.repeat(depth);
    const mathStr = toMathString(node.value);
    console.log(indent + mathStr);
    for (const child of node.children) {
        displayDerivationTree(child, depth + 1);
    }
}


displayDerivationTree(derivationTree);
