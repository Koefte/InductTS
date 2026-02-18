import * as fs from 'fs';
import { parseEquation } from './humanNotationParser';
import * as math from 'mathjs';

type InductionInput = {
    relations: string[];
    inductionHypothesis: string;
};

type Relation = {
    left: string;
    right: string;
    conditions?: string[];
};

function parseRelation(relationStr: string): Relation {
    // Handle "where" clauses: "a = b where c = d, e = f" or "a = b where c = d and e = f"
    let whereIndex = relationStr.indexOf(' where ');
    let mainPart = relationStr;
    let conditions: string[] = [];
    
    if (whereIndex !== -1) {
        mainPart = relationStr.substring(0, whereIndex);
        const condPart = relationStr.substring(whereIndex + 7).trim(); // skip " where "
        // Split by both commas and "and"
        conditions = condPart.split(/\s*(?:,|\s+and\s+)\s*/).map(c => c.trim()).filter(c => c.length > 0);
    }
    
    const [left, right] = mainPart.split('=').map(s => s.trim());
    return { left, right, conditions: conditions.length > 0 ? conditions : undefined };
}

function parseInductionInput(fileContent: string): InductionInput {
    const statements = fileContent.split('\n').filter(line => line.trim() !== '');
    const relations: string[] = [];
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
            // Check if already in Lisp notation (contains backslash substitution or has uppercase function calls like Add(...), Mult(...))
            // A bare uppercase letter followed by an operator (e.g. A*n) is human notation, NOT Lisp.
            // Lisp notation requires an uppercase identifier immediately followed by '(' e.g. Add(, Mult(, Sum(
            const isLispNotation = statement.includes('\\') || /[A-Z][A-Za-z0-9_]*\s*\(/.test(statement.trim());
            
            if (isLispNotation) {
                // Already in Lisp notation, use as-is
                relations.push(statement);
            } else {
                // Parse human notation to Lisp notation, handling where clauses
                const parsed = parseRelation(statement);
                let lispNotation = '';
                if (parsed.conditions && parsed.conditions.length > 0) {
                    // Convert conditions to Lisp as well
                    const { parseEquation } = require('./humanNotationParser');
                    const conditionLisp = parsed.conditions.map((cond: string) => {
                        return parseEquation(cond);
                    }).join(', ');
                    // Reconstruct with conditions
                    const { humanToLisp } = require('./humanNotationParser');
                    const leftLisp = humanToLisp(parsed.left, { wrapVariables: false });
                    const rightLisp = humanToLisp(parsed.right, { wrapVariables: false });
                    lispNotation = `${leftLisp} = ${rightLisp} where ${conditionLisp}`;
                } else {
                    const { humanToLisp } = require('./humanNotationParser');
                    const leftLisp = humanToLisp(parsed.left, { wrapVariables: false });
                    const rightLisp = humanToLisp(parsed.right, { wrapVariables: false });
                    lispNotation = `${leftLisp} = ${rightLisp}`;
                }
                relations.push(lispNotation);
            }
        }
        if(currentSegment == "induction_hypothesis"){
            inductionHypothesis = statement;
        }
    }

    return { relations, inductionHypothesis };
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
type Result<T> = T | null;

function solveConditions(conditions: string[], variableMap: VariableMap): VariableMap | null {
    if (!conditions || conditions.length === 0) return variableMap;
    
    try {
        const result = new Map(variableMap);
        const unknowns = new Set<string>();
        
        // First pass: substitute known variables and identify unknowns
        const processedConditions = conditions.map(condition => {
            const [left, right] = condition.split('=').map(s => s.trim());
            if (!left || !right) return null;
            
            // Convert from Lisp notation to evaluatable math expression
            let lhs = left;
            let rhs = right;
            
            // Replace Lisp operations with math operators
            const lispToMath = (expr: string): string => {
                let result = expr;
                // Replace Mult(a,b) with (a*b)
                result = result.replace(/Mult\(([^,]+),([^)]+)\)/g, '($1*$2)');
                // Replace Add(a,b) with (a+b)
                result = result.replace(/Add\(([^,]+),([^)]+)\)/g, '($1+$2)');
                // Replace Div(a,b) with (a/b)
                result = result.replace(/Div\(([^,]+),([^)]+)\)/g, '($1/$2)');
                // Replace Subtract(a,b) with (a-b)
                result = result.replace(/Subtract\(([^,]+),([^)]+)\)/g, '($1-$2)');
                // Replace Constant(n) with n
                result = result.replace(/Constant\(([^)]+)\)/g, '$1');
                return result;
            };
            
            lhs = lispToMath(lhs);
            rhs = lispToMath(rhs);
            
            // Substitute known variables
            for (const [key, value] of result.entries()) {
                const regex = new RegExp(`\\b${key}\\b`, 'g');
                lhs = lhs.replace(regex, `(${value})`);
                rhs = rhs.replace(regex, `(${value})`);
            }
            
            // Apply lispToMath again after substitution, since bound values
            // may contain Lisp wrappers like Constant(2) that need unwrapping
            lhs = lispToMath(lhs);
            rhs = lispToMath(rhs);
            
            // Extract unknowns (variables not yet in result map)
            const tokens = (lhs + ' ' + rhs).match(/\b[a-z]+\b/g) || [];
            for (const token of tokens) {
                if (!result.has(token) && !/^(sqrt|sin|cos|tan|log|ln|exp|abs)$/.test(token)) {
                    unknowns.add(token);
                }
            }
            
            return { lhs, rhs };
        }).filter(c => c !== null);
        
        // Try to solve for unknowns using mathjs
        if (unknowns.size > 0) {
            const unknownList = Array.from(unknowns);
            
           
            
            try {
                // Smart solver for systems of equations
                // Special case: Vieta's formulas for x*y = p and x+y = s
                // x and y are roots of t² - s*t + p = 0
                const solveVietas = (x: string, y: string, conditions: { lhs: string; rhs: string }[]): { [key: string]: number } | null => {
                    if (conditions.length !== 2) return null;
                    
                    let sumExpr: string | null = null;
                    let prodExpr: string | null = null;
                    
                    // Identify which condition is sum and which is product
                    for (const cond of conditions) {
                        const hasX = cond.lhs.includes(x) || cond.rhs.includes(x);
                        const hasY = cond.lhs.includes(y) || cond.rhs.includes(y);
                        if (!hasX || !hasY) continue;
                        
                        // If RHS is simpler, use that
                        const expr = cond.rhs.length <= cond.lhs.length ? cond.rhs : cond.lhs;
                        
                        // Check if it contains multiplication (likely product)
                        if (expr.includes('*') && expr.includes(x) && expr.includes(y)) {
                            prodExpr = expr;
                        } else if (expr.includes('+') && expr.includes(x) && expr.includes(y)) {
                            sumExpr = expr;
                        }
                    }
                    
                    // If we found both, try to solve
                    if (sumExpr && prodExpr) {
                        try {
                            // Evaluate expressions by substituting known variables
                            let s = sumExpr;
                            let p = prodExpr;
                            
                            // Substitute any known variables
                            for (const [key, value] of result.entries()) {
                                const regex = new RegExp(`\\b${key}\\b`, 'g');
                                s = s.replace(regex, `(${value})`);
                                p = p.replace(regex, `(${value})`);
                            }
                            
                            // Remove variables x and y from evaluation
                            const sNum = math.evaluate(s, { [x]: 0, [y]: 0 });
                            const pNum = math.evaluate(p, { [x]: 0, [y]: 0 });
                            
                            // Actually, we need to extract the coefficient of x+y and x*y
                            // For x*y = C/A, C/A is what we need
                            // For x+y = B/A, B/A is what we need
                            // Let me try a different approach: just numerically evaluate
                            
                            // Replace x with a test value to get the expression
                            const sTestX1 = s.replace(new RegExp(`\\b${x}\\b`, 'g'), '1').replace(new RegExp(`\\b${y}\\b`, 'g'), '1');
                            const sTestX2 = s.replace(new RegExp(`\\b${x}\\b`, 'g'), '2').replace(new RegExp(`\\b${y}\\b`, 'g'), '1');
                            
                            // For a linear sum like x+y or expressions involving x+y
                            // We need to be smarter. Let's try assuming it's in form "(x+y)_coeff * (...)"
                            
                            // Actually the simplest: try all small integer solutions
                            for (let xVal = -10; xVal <= 10; xVal++) {
                                for (let yVal = -10; yVal <= 10; yVal++) {
                                    const testS = s.replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`).replace(new RegExp(`\\b${y}\\b`, 'g'), `(${yVal})`);
                                    const testP = p.replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`).replace(new RegExp(`\\b${y}\\b`, 'g'), `(${yVal})`);
                                    try {
                                        const sVal = math.evaluate(testS);
                                        const pVal = math.evaluate(testP);
                                        
                                        // Check if this pair satisfies both equations
                                        if (Math.abs(sVal - (xVal + yVal)) < 1e-10 && Math.abs(pVal - (xVal * yVal)) < 1e-10) {
                                            return { [x]: xVal, [y]: yVal };
                                        }
                                    } catch (e) {
                                        // Skip
                                    }
                                }
                            }
                        } catch (e) {
                            return null;
                        }
                    }
                    
                    return null;
                };
                
                // Comprehensive solver for systems of equations
                const solveEquations = (unknowns: string[], conditions: { lhs: string; rhs: string }[]): Map<string, string> | null => {
                    // Try Vieta's formulas for 2 unknowns, 2 conditions
                    if (unknowns.length === 2 && conditions.length === 2) {
                        const [x, y] = unknowns;
                        const vietaSol = solveVietas(x, y, conditions);
                        if (vietaSol) {
                            console.log(`[DEBUG] Vieta's formula found solution: x=${vietaSol[x]}, y=${vietaSol[y]}`);
                            const sol = new Map(result);
                            for (const [varName, value] of Object.entries(vietaSol)) {
                                sol.set(varName, value.toString());
                            }
                            return sol;
                        }
                    }
                    
                    // Fallback: brute force search with very small range for speed
                    const searchRange = 10;
                    const solutions: Array<{ [key: string]: number }> = [];
                    let checked = 0;
                    const maxChecks = 100; // Safety limit to prevent timeouts
                    
                    if (unknowns.length === 1) {
                        const [x] = unknowns;
                        for (let xVal = -searchRange; xVal <= searchRange; xVal++) {
                            let allMatch = true;
                            for (const cond of conditions) {
                                const testLhs = cond.lhs.replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`);
                                const testRhs = cond.rhs.replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`);
                                try {
                                    const lhsVal = math.evaluate(testLhs);
                                    const rhsVal = math.evaluate(testRhs);
                                    if (Math.abs(lhsVal - rhsVal) > 1e-10) {
                                        allMatch = false;
                                        break;
                                    }
                                } catch (e) {
                                    allMatch = false;
                                    break;
                                }
                            }
                            if (allMatch) {
                                solutions.push({ [x]: xVal });
                            }
                        }
                    } else if (unknowns.length === 2) {
                        const [x, y] = unknowns;
                        outer: for (let xVal = -searchRange; xVal <= searchRange; xVal++) {
                            for (let yVal = -searchRange; yVal <= searchRange; yVal++) {
                                checked++;
                                if (checked > maxChecks) break outer;
                                
                                let allMatch = true;
                                for (const cond of conditions) {
                                    const testLhs = cond.lhs
                                        .replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`)
                                        .replace(new RegExp(`\\b${y}\\b`, 'g'), `(${yVal})`);
                                    const testRhs = cond.rhs
                                        .replace(new RegExp(`\\b${x}\\b`, 'g'), `(${xVal})`)
                                        .replace(new RegExp(`\\b${y}\\b`, 'g'), `(${yVal})`);
                                    try {
                                        const lhsVal = math.evaluate(testLhs);
                                        const rhsVal = math.evaluate(testRhs);
                                        if (Math.abs(lhsVal - rhsVal) > 1e-10) {
                                            allMatch = false;
                                            break;
                                        }
                                    } catch (e) {
                                        allMatch = false;
                                        break;
                                    }
                                }
                                if (allMatch) {
                                    solutions.push({ [x]: xVal, [y]: yVal });
                                }
                            }
                        }
                    }
                    
                    if (solutions.length > 0) {
                        const solution = solutions[0];
                        for (const [varName, value] of Object.entries(solution)) {
                            result.set(varName, value.toString());
                        }
                        return result;
                    }
                    return null;
                };
                
                const solved = solveEquations(unknownList, processedConditions.filter(c => c !== null) as Array<{ lhs: string; rhs: string }>);
                if (solved) {
                    console.log(`[DEBUG] Solved via equation search:`, Array.from(solved.entries()));
                    return solved;
                }
                else{
                    console.log(`[DEBUG] No solution found for unknowns: ${unknownList.join(', ')}`);
                }
            } catch (solveError) {
                console.log(`[DEBUG] Equation search failed: ${solveError}`);
                console.log(`[DEBUG] Could not find solution for unknowns: ${unknownList.join(', ')}`);
                return null;
            }
        }
        
        // If no unknowns, just verify conditions
        for (const cond of processedConditions) {
            if (!cond) continue;
            try {
                const lhsVal = math.evaluate(cond.lhs);
                const rhsVal = math.evaluate(cond.rhs);
                if (Math.abs(lhsVal - rhsVal) > 1e-10) {
                    return null;
                }
            } catch (e) {
                // Can't evaluate - assume conditions not satisfied
                return null;
            }
        }
        
        return result;
    } catch (e) {
        return null;
    }
}

function matches(nodeTree: Tree<string>, patternTree: Tree<string>) : Result<VariableMap> {
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

    // If pattern is a single uppercase letter with no children (e.g. A, B, C),
    // treat it as a pattern variable too — it matches any subtree and binds to it.
    // This distinguishes bare uppercase placeholders from multi-char Lisp function names like Add, Mult.
    if(patternTree.children.length === 0 && /^[A-Z]$/.test(patternTree.value)){
        variableMap.set(patternTree.value, treeToString(nodeTree));
        return variableMap;
    }

    // Special handling for Variable(x) in pattern - should only match bare x or Variable(x), not complex expressions
    // This is used to indicate "this must be a variable, not any expression"
    if(patternTree.value === "Variable" && patternTree.children.length === 1) {
        const patternVarName = patternTree.children[0].value;
        
        // Match bare variable node
        if(nodeTree.children.length === 0 && nodeTree.value === patternVarName) {
            variableMap.set(patternVarName, nodeTree.value);
            return variableMap;
        }
        
        // Match Variable(x) node
        if(nodeTree.value === "Variable" && nodeTree.children.length === 1 && 
           nodeTree.children[0].value === patternVarName) {
            variableMap.set(patternVarName, nodeTree.children[0].value);
            return variableMap;
        }
        
        // Don't match complex expressions
        return null;
    }

    // Special handling for Constant(x) in pattern - should only match that constant
    if(patternTree.value === "Constant" && patternTree.children.length === 1) {
        const patternConstValue = patternTree.children[0].value;
        
        // Match bare constant
        if(nodeTree.children.length === 0 && nodeTree.value === patternConstValue) {
            return variableMap;
        }
        
        // Match Constant(x) node
        if(nodeTree.value === "Constant" && nodeTree.children.length === 1 &&
           nodeTree.children[0].value === patternConstValue) {
            return variableMap;
        }
        
        return null;
    }

    // Check that values match
    if(nodeTree.value != patternTree.value){
        return null;
    }

    // Check structural equality - same number of children
    if(nodeTree.children.length != patternTree.children.length){
        return null;
    }

    // Non-commutative: match children in order
    for(let i = 0; i < nodeTree.children.length; i++){
        let nodeChild = nodeTree.children[i];
        let patternChild = patternTree.children[i];
        const childMatches = matches(nodeChild, patternChild);
        if(!childMatches) return null;
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
        // Find the backslash position
        const backslashIndex = result.indexOf('\\');
        if(backslashIndex === -1) break;
        
        // Extract the variable name before the backslash (walk backwards to find start)
        let varStart = backslashIndex - 1;
        while(varStart >= 0 && /\w/.test(result[varStart])){
            varStart--;
        }
        varStart++;
        const varToSubstitute = result.substring(varStart, backslashIndex);
        
        if(!varToSubstitute || !variableMap.has(varToSubstitute)){
            break;
        }
        
        // Extract the substitution pattern after backslash - need to balance parentheses
        let parenCount = 0;
        let patternStart = backslashIndex + 1;
        let patternEnd = patternStart;
        let started = false;
        
        for(let i = patternStart; i < result.length; i++){
            const ch = result[i];
            if(ch === '('){
                parenCount++;
                started = true;
            } else if(ch === ')'){
                parenCount--;
                if(started && parenCount === 0){
                    patternEnd = i + 1;
                    break;
                }
            }
        }
        
        const substitutionPattern = result.substring(patternStart, patternEnd);
        const fullMatch = result.substring(varStart, patternEnd);
        
        // If the variable to substitute is in our map, get its value
        const bodyExpr = variableMap.get(varToSubstitute)!;
        
        // Now we need to find what variable is being substituted in the body
        // For the sum rule, the body contains k, and we substitute k with the pattern
        // The pattern format is something like Add(n,Constant(1)), and we need to substitute
        // the iteration variable (usually 'k') in bodyExpr with this pattern
        
        // For now, let's just do a simple replacement of 'k'
        const bodyTree = constructTree(bodyExpr);
        const substitutedBody = treeToString(substitute(bodyTree, "k", substitutionPattern));
        
        result = result.substring(0, varStart) + substitutedBody + result.substring(patternEnd);
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
        console.assert(false, "UNREACHABLE")
        return treeToString(nodeTree);
    }
    
    // Extract conditions if present (handle "where" clauses)
    let mainRelation = relation;
    let conditions: string[] = [];
    const whereIndex = relation.indexOf(' where ');
    if (whereIndex !== -1) {
        mainRelation = relation.substring(0, whereIndex);
        const condStr = relation.substring(whereIndex + 7);
        // Split conditions on commas that are NOT inside parentheses
        // (Lisp expressions like Mult(x,y) contain commas we must not split on)
        const condParts: string[] = [];
        let depth = 0;
        let current = '';
        for (const ch of condStr) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                condParts.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
        if (current.trim().length > 0) condParts.push(current.trim());
        conditions = condParts;
    }
    
    const [left, right] = mainRelation.split('=').map((s:string) => s.trim());
    if(!left || !right){
        return treeToString(nodeTree);
    }
    
    const leftTree = constructTree(left);
    const workTree = cloneTree(nodeTree);
    const originalString = treeToString(nodeTree);
    
    
    // Search for matching subtree and replace
    const findAndReplace = (subtree: Tree<string>, depth: number = 0) : boolean => {
        // Try to match current subtree
        
        let variableMap = matches(cloneTree(subtree), cloneTree(leftTree));
        if(variableMap !== null){
            
            // If there are conditions, try to solve them
            if (conditions.length > 0) {
                console.log(`[DEBUG] Pattern matched at depth ${depth}, checking conditions...`);
                console.log(`[DEBUG] Raw conditions:`, conditions);
                console.log(`[DEBUG] Variable bindings:`, Array.from(variableMap.entries()));
                const solved = solveConditions(conditions, variableMap);
                if (!solved) {
                    console.log(`[DEBUG] Conditions NOT satisfied, backtracking`);
                    throw new Error("Conditions not satisfied");
                }
                console.log(`[DEBUG] Conditions SATISFIED! Solution:`, Array.from(solved.entries()));
                variableMap = solved;
            }
            
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
            // Try children
        for(const child of subtree.children){
            if(findAndReplace(child, depth + 1)){
                return true;
            }
        }
        return false;
    
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

// Convert expressions to LaTeX notation
function toLatexString(input: string | Tree<string>, parentPrecedence: number = 0): string {
    let tree: Tree<string>;

    if(typeof input === 'string'){
        tree = constructTree(input);
    } else {
        tree = input;
    }

    tree = simplifyTree(tree);

    if(tree.value === "root"){
        if(tree.children.length === 0){
            return "";
        }
        if(tree.children.length === 1){
            return toLatexString(tree.children[0], parentPrecedence);
        }
    }

    if(tree.children.length === 0){
        return tree.value;
    }

    if(tree.value === "Constant" || tree.value === "Variable"){
        if(tree.children.length === 1){
            return toLatexString(tree.children[0], parentPrecedence);
        }
    }

    if(tree.value === "Sum" && tree.children.length === 3){
        const body = toLatexString(tree.children[0], 0);
        const from = toLatexString(tree.children[1], 0);
        const to = toLatexString(tree.children[2], 0);
        return `\\sum_{${from}}^{${to}} ${body}`;
    }

    type OpInfo = { symbol: string; precedence: number; latex?: boolean };
    const operators: { [key: string]: OpInfo } = {
        'Add': { symbol: ' + ', precedence: 1 },
        'Sub': { symbol: ' - ', precedence: 1 },
        'Subtract': { symbol: ' - ', precedence: 1 },
        'Mult': { symbol: ' \\cdot ', precedence: 2 },
        'Div': { symbol: '/', precedence: 2, latex: true },
        'Pow': { symbol: '^', precedence: 3, latex: true }
    };

    const opInfo = operators[tree.value];
    if(opInfo && tree.children.length === 2){
        const left = toLatexString(tree.children[0], opInfo.precedence);
        const right = toLatexString(tree.children[1], opInfo.precedence);

        if(tree.value === 'Div'){
            return `\\frac{${left}}{${right}}`;
        }
        if(tree.value === 'Pow'){
            const base = parentPrecedence > opInfo.precedence ? `\\left(${left}\\right)` : left;
            return `${base}^{${right}}`;
        }

        let result = `${left}${opInfo.symbol}${right}`;
        if(parentPrecedence > opInfo.precedence){
            result = `\\left(${result}\\right)`;
        }
        return result;
    }

    let result = tree.value + '\\left(';
    for(let i = 0; i < tree.children.length; i++){
        result += toLatexString(tree.children[i], 0);
        if(i < tree.children.length - 1){
            result += ', ';
        }
    }
    result += '\\right)';
    return result;
}

function simplifyTree(tree: Tree<string>) : Tree<string> {
    // Simplify children first
    tree.children = tree.children.map(child => simplifyTree(child));

    if(tree.value === "Add"){
        let newChildren: Tree<string>[] = [];
        let constantSum = 0;
        for(const child of tree.children){
            if(child.value === "Constant" && child.children.length === 1){
                const constValue = parseInt(child.children[0].value);
                if(!isNaN(constValue)){
                    constantSum += constValue;
                    continue;
                }
            }
            newChildren.push(child);
        }
        if(constantSum !== 0){
            newChildren.push({
                value: "Constant",
                children: [{value: constantSum.toString(), children: []}]
            });
        }
        // If no non-constant children remain, return the constant sum
        if(newChildren.length === 0){
            return {
                value: "Constant",
                children: [{value: constantSum.toString(), children: []}]
            };
        }
        // If only one child remains, return it directly
        if(newChildren.length === 1){
            return newChildren[0];
        }
        tree.children = newChildren;
    }
    // Skip simplification for Mult to preserve order (commutativity is handled by relations)
    // Multiplications like Mult(Constant(2),k) should not be reordered to Mult(k,Constant(2))
    // Let the relations handle commutativity instead
    if(tree.value === "Subtract" || tree.value === "Sub"){
        // If both children are constants, compute the result
        if(tree.children.length === 2){
            const left = tree.children[0];
            const right = tree.children[1];
            
            let leftVal: number | null = null;
            let rightVal: number | null = null;
            
            if(left.value === "Constant" && left.children.length === 1){
                leftVal = parseInt(left.children[0].value);
            } else if(left.children.length === 0 && !isNaN(parseInt(left.value))){
                leftVal = parseInt(left.value);
            }
            
            if(right.value === "Constant" && right.children.length === 1){
                rightVal = parseInt(right.children[0].value);
            } else if(right.children.length === 0 && !isNaN(parseInt(right.value))){
                rightVal = parseInt(right.value);
            }
            
            if(leftVal !== null && rightVal !== null){
                const result = leftVal - rightVal;
                return {
                    value: "Constant",
                    children: [{value: result.toString(), children: []}]
                };
            }
            
            // Handle Add(..., Constant(a)) - Constant(b) => Add(..., Constant(a-b))
            if(left.value === "Add" && rightVal !== null){
                // Find constant child in Add
                let constIndex = -1;
                let constVal = 0;
                for(let i = 0; i < left.children.length; i++){
                    const child = left.children[i];
                    if(child.value === "Constant" && child.children.length === 1){
                        constVal = parseInt(child.children[0].value);
                        if(!isNaN(constVal)){
                            constIndex = i;
                            break;
                        }
                    }
                }
                if(constIndex >= 0){
                    const newConstVal = constVal - rightVal;
                    const newChildren = [...left.children];
                    if(newConstVal === 0){
                        // Remove the constant entirely
                        newChildren.splice(constIndex, 1);
                        if(newChildren.length === 1){
                            return newChildren[0];
                        }
                    } else {
                        newChildren[constIndex] = {
                            value: "Constant",
                            children: [{value: newConstVal.toString(), children: []}]
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


function applyAllRelations(node: string, relations: string[], inductionHypothesis: string) : string[] {
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
        console.log("Got here via induction hypothesis");
        console.log(`Induction hypothesis: ${hypLeft} = ${hypRight}`);
        console.log("  result: " + applyHypResult);
        printTree(constructTree(applyHypResult));
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



// Display function for derivation tree
function displayDerivationTree(node: Tree<Tree<string>>, depth: number = 0) {
    const indent = '  '.repeat(depth);
    const mathStr = toMathString(node.value);
    console.log(indent + mathStr);
    for (const child of node.children) {
        displayDerivationTree(child, depth + 1);
    }
}

function extractSuccessfulBranchLatex(branch: Tree<Tree<string>> | null): string[] {
    if(!branch){
        return [];
    }
    const latex: string[] = [];
    
    // Recursively collect all nodes in the branch (depth-first)
    function collectNodes(node: Tree<Tree<string>>): void {
        latex.push(toLatexString(node.value));
        // Process all children (though typically there should only be one in a successful branch)
        for (const child of node.children) {
            collectNodes(child);
        }
    }
    
    collectNodes(branch);
    return latex;
}

function runInduction(input: InductionInput): {
    successfulBranch: Tree<Tree<string>> | null;
    successfulBranchLatex: string[];
    goalLatex: string;
} {
    const { relations, inductionHypothesis } = input;

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

    // Track parents for each derivation node to reconstruct a successful branch
    const parentMap = new Map<Tree<Tree<string>>, Tree<Tree<string>> | null>();
    parentMap.set(derivationTree, null);

    let successfulBranch: Tree<Tree<string>> | null = null;

    function buildSuccessfulBranch(leaf: Tree<Tree<string>>): Tree<Tree<string>> {
        const path: Tree<Tree<string>>[] = [];
        let current: Tree<Tree<string>> | null = leaf;
        while(current){
            path.push(current);
            current = parentMap.get(current) ?? null;
        }
        path.reverse();

        let branchRoot: Tree<Tree<string>> = {
            value: path[0].value,
            children: []
        };
        let cursor = branchRoot;
        for(let i = 1; i < path.length; i++){
            const nextNode: Tree<Tree<string>> = {
                value: path[i].value,
                children: []
            };
            cursor.children.push(nextNode);
            cursor = nextNode;
        }
        return branchRoot;
    }

    let frontier: Tree<Tree<string>>[] = [derivationTree];
    
    // Track visited expressions to avoid cycles and merge branches
    const visited = new Map<string, Tree<Tree<string>>>();
    const rootExprStr = treeToString(rootExpr);
    visited.set(rootExprStr, derivationTree);

    // Substitute n with n+1 in the hypothesis RHS
    const hypRightTree = constructTree(hypRightOriginal);
    const hypRightSubstituted = substitute(hypRightTree, "n", "Add(n,Constant(1))");
    const hypRightMath = toMathString(hypRightSubstituted);
    
    // Helper function to check if two expressions are mathematically equivalent
    const areEquivalent = (expr1Str: string, expr2Str: string): boolean => {
        try {
            // Parse both expressions
            const expr1 = math.parse(expr1Str);
            const expr2 = math.parse(expr2Str);
            // Simplify both
            const simplified1 = math.simplify(expr1).toString();
            const simplified2 = math.simplify(expr2).toString();
            // Compare
            return simplified1 === simplified2;
        } catch (e) {
            // If parsing/simplifying fails, fall back to string comparison
            return expr1Str === expr2Str;
        }
    };

    console.log("\n=== Induction Hypothesis Goal ===");
    console.log("Original RHS: " + hypRightOriginal);
    console.log("After substitution (structure): " + treeToString(hypRightSubstituted));
    console.log("After substitution (math): " + hypRightMath);
    console.log("LHS after substitution (math): " + toMathString(hypLeft));
    console.log("===================================\n");


    for(let i = 0; i < 100; i++){
        let nextFrontier: Tree<Tree<string>>[] = [];
        const seenInThisIteration = new Set<string>();
        
        for (const node of frontier) {
            const exprStr = treeToString(node.value);
            
            const derived = applyAllRelations(exprStr, relations, inductionHypothesis);
            for (const result of derived) {
                const normalized = resolveSubstitutions(result);
                const childTree = constructTree(normalized);
                let child = (childTree.value === "root" && childTree.children.length > 0) 
                    ? childTree.children[0] 
                    : childTree;
                child = simplifyTree(child);
                
                const childStr = treeToString(child);
                
                // Skip if we've already visited this expression (cycle detection)
                if (visited.has(childStr)) {
                    continue;
                }
                
                // Skip if we've seen this expression in this iteration (deduplication)
                if (seenInThisIteration.has(childStr)) {
                    continue;
                }
                
                console.log("Derived: " + toMathString(child));
                seenInThisIteration.add(childStr);
                
                // Check if this result matches the hypothesis goal
                const childMath = toMathString(child);
                if(childMath === hypRightMath || areEquivalent(childMath, hypRightMath)){
                    console.log("✓ Reached induction hypothesis goal!");
                    const derivNode: Tree<Tree<string>> = {
                        value: child,
                        children: []
                    };
                    node.children.push(derivNode);
                    parentMap.set(derivNode, node);
                    visited.set(childStr, derivNode);
                    successfulBranch = buildSuccessfulBranch(derivNode);
                    nextFrontier = [];  // Stop exploring further
                    frontier = [];
                    break;
                }
                const derivNode: Tree<Tree<string>> = {
                    value: child,
                    children: []
                };
                node.children.push(derivNode);
                parentMap.set(derivNode, node);
                visited.set(childStr, derivNode);
                nextFrontier.push(derivNode);
            }
            
            if(frontier.length === 0) break;
        }
        frontier = nextFrontier;
        if(frontier.length === 0) break;
    }

    if(successfulBranch){
        console.log("\n=== Successful Branch (separate) ===");
        displayDerivationTree(successfulBranch);
    }

    return {
        successfulBranch,
        successfulBranchLatex: extractSuccessfulBranchLatex(successfulBranch),
        goalLatex: toLatexString(hypRightSubstituted)
    };
}

if(require.main === module){
    if(process.argv.length > 2){
        // Command line argument provided - use it as the induction hypothesis
        const hypothesisInput = process.argv[2];
        let lispHypothesis: string;
        
        // Check if it's already in Lisp notation
        const isLikelyLisp = (value: string): boolean => {
            if (!value) return false;
            const lispKeywordsPattern = /\b(Constant|Variable|Add|Subtract|Mult|Div|Sum)\s*\(/;
            return lispKeywordsPattern.test(value);
        };
        
        if (isLikelyLisp(hypothesisInput)) {
            // Already Lisp notation, use directly
            lispHypothesis = hypothesisInput;
        } else {
            // Try to parse as human notation
            try {
                const { humanToLisp } = require('./humanNotationParser');
                
                if (hypothesisInput.includes('=')) {
                    const equalsIndex = hypothesisInput.indexOf('=');
                    const left = hypothesisInput.substring(0, equalsIndex).trim();
                    const right = hypothesisInput.substring(equalsIndex + 1).trim();
                    lispHypothesis = `${humanToLisp(left)} = ${humanToLisp(right)}`;
                } else {
                    lispHypothesis = humanToLisp(hypothesisInput);
                }
            } catch (parseError) {
                // If parsing fails, assume it's Lisp notation
                lispHypothesis = hypothesisInput;
            }
        }
        
        // Load relations from example.ind
        const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
        const parsedFile = parseInductionInput(fileContent);
        
        const input: InductionInput = {
            relations: parsedFile.relations,
            inductionHypothesis: lispHypothesis
        };
        
        runInduction(input);
    } else {
        // No argument - use example.ind
        const fileContent = fs.readFileSync('src/example.ind', 'utf-8');
        const input = parseInductionInput(fileContent);
        runInduction(input);
    }
}

export { parseInductionInput, runInduction, toLatexString };
export type { InductionInput };
